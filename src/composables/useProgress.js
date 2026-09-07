import { ref, watch } from 'vue'
import { getItem, createPersister, onExternalWrite, onVisible } from '../lib/storage'

const KEY = 'shnayim-progress'

function parseProgress(raw) {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch (e) {
    console.warn('Could not parse saved progress, starting fresh:', e)
    return {}
  }
}

const emptyVerse = () => ({ hebrew1: false, hebrew2: false, targum: false })

// Parshiyot cleared in this tab since the last write. Without this the merge
// below would resurrect them from disk and clearing would never stick.
const clearedRoutes = new Set()

// Verse fields this tab actually changed since its last write:
// route -> verseKey -> Set(field). A write lays only these on top of what is on
// disk, so a tab that is behind — it missed a `storage` event while frozen or
// in the bfcache — can never overwrite a field it did not touch. Tracking the
// changed *fields* rather than OR-ing the booleans is what keeps un-marking a
// verse working: an OR merge could only ever move a verse forwards.
const dirtyFields = new Map()

function markDirty(route, verseKey, field) {
  let keys = dirtyFields.get(route)
  if (!keys) {
    keys = new Map()
    dirtyFields.set(route, keys)
  }
  let fields = keys.get(verseKey)
  if (!fields) {
    fields = new Set()
    keys.set(verseKey, fields)
  }
  fields.add(field)
}

/**
 * The map this tab should hold and store: whatever is on disk, minus the
 * parshiyot cleared here, plus the individual fields changed here.
 *
 * Used on both directions of the wire — the write path (disk is another tab's
 * newer map) and the read-back path (a `storage` event or a return to the
 * foreground) — so an incoming map never discards an unflushed mark, and an
 * unflushed mark never discards the rest of an incoming map.
 */
function mergeProgress(disk, mem) {
  const out = {}
  for (const [route, verses] of Object.entries(disk)) {
    if (clearedRoutes.has(route)) continue
    if (!verses || typeof verses !== 'object') continue
    out[route] = {}
    for (const [verseKey, record] of Object.entries(verses)) {
      out[route][verseKey] = { ...record }
    }
  }
  for (const [route, keys] of dirtyFields) {
    for (const [verseKey, fields] of keys) {
      const memRecord = mem[route]?.[verseKey]
      if (!memRecord) continue
      if (!out[route]) out[route] = {}
      const record = out[route][verseKey] || emptyVerse()
      for (const field of fields) record[field] = memRecord[field] === true
      out[route][verseKey] = record
    }
  }
  return out
}

const progress = ref(parseProgress(getItem(KEY)))

const persister = createPersister(KEY, (raw) => {
  const merged = mergeProgress(parseProgress(raw), progress.value)
  const serialized = JSON.stringify(merged)
  // Adopt the merged map so the next change is made on top of the other tab's
  // verses instead of on top of a map that is already behind disk.
  if (serialized !== JSON.stringify(progress.value)) progress.value = merged
  dirtyFields.clear()
  clearedRoutes.clear()
  return serialized
})

watch(progress, () => persister.schedule(), { deep: true })

/**
 * Fold a map that came from outside this tab into what this tab holds. Marks
 * made inside the debounce window and a not-yet-written clear both survive
 * (mergeProgress re-applies them), and the watcher below re-schedules the write
 * that persists them.
 */
// Bumped every time a map from outside this tab is adopted, so views can
// re-seed a selection that was derived from the pre-adoption pointer.
const externalRevision = ref(0)

function adoptExternal(raw) {
  const merged = mergeProgress(parseProgress(raw), progress.value)
  if (JSON.stringify(merged) === JSON.stringify(progress.value)) return
  progress.value = merged
  externalRevision.value++
}

// Another tab wrote while this one was open.
onExternalWrite(KEY, adoptExternal)
// This tab came back from the bfcache / a frozen background, where `storage`
// events are not delivered and are not replayed. Re-read disk or the next mark
// would be written on top of a map that is behind.
onVisible(() => adoptExternal(getItem(KEY)))

export function useProgress() {
  const getVerseProgress = (parasha, verseKey) => {
    return progress.value[parasha]?.[verseKey] || {
      hebrew1: false,
      hebrew2: false,
      targum: false
    }
  }

  const setVerseProgress = (parasha, verseKey, field, value) => {
    if (!progress.value[parasha]) {
      progress.value[parasha] = {}
    }
    if (!progress.value[parasha][verseKey]) {
      progress.value[parasha][verseKey] = emptyVerse()
    }
    progress.value[parasha][verseKey][field] = value
    markDirty(parasha, verseKey, field)
  }

  const getParshaStats = (parasha, totalVerses) => {
    const parshaProgress = progress.value[parasha] || {}
    let completed = 0
    Object.values(parshaProgress).forEach(verse => {
      if (verse.hebrew1 && verse.hebrew2 && verse.targum) {
        completed++
      }
    })
    return {
      completed,
      total: totalVerses,
      percentage: totalVerses > 0 ? Math.round((completed / totalVerses) * 100) : 0
    }
  }

  const clearParshaProgress = (parasha) => {
    if (progress.value[parasha]) {
      clearedRoutes.add(parasha)
      // The clear supersedes every unflushed field change in this parsha.
      dirtyFields.delete(parasha)
      delete progress.value[parasha]
    }
  }

  return {
    progress,
    externalRevision,
    getVerseProgress,
    setVerseProgress,
    getParshaStats,
    clearParshaProgress
  }
}
