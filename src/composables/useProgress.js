import { ref, watch } from 'vue'
import { getItem, createPersister, onExternalWrite, onVisible } from '../lib/storage'
import { routesForVerse, clearTargets, partialClearWrites } from '../lib/overlap'
import { hasMarks } from '../lib/cycleStore'

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

// True after the backing store rejected the last write (quota, blocked
// storage). The marks still live in memory for this session, but they will
// not survive a reload, and nothing else in the UI can tell. Cleared again by
// the next write that succeeds.
const persistFailed = ref(false)

const persister = createPersister(KEY, (raw) => {
  const merged = mergeProgress(parseProgress(raw), progress.value)
  const serialized = JSON.stringify(merged)
  // Adopt the merged map so the next change is made on top of the other tab's
  // verses instead of on top of a map that is already behind disk.
  if (serialized !== JSON.stringify(progress.value)) progress.value = merged
  dirtyFields.clear()
  clearedRoutes.clear()
  return serialized
}, 300, (ok) => { persistFailed.value = !ok })

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

/** Write one field into one route and record it as changed here. */
function writeField(route, verseKey, field, value) {
  if (!progress.value[route]) progress.value[route] = {}
  if (!progress.value[route][verseKey]) progress.value[route][verseKey] = emptyVerse()
  progress.value[route][verseKey][field] = value
  markDirty(route, verseKey, field)
}

/** Drop a whole route; the clear wins over this tab's unflushed changes in it. */
function clearWholeRoute(route) {
  if (!progress.value[route]) return
  clearedRoutes.add(route)
  dirtyFields.delete(route)
  delete progress.value[route]
}

// Called with the routes that just received their first mark, so the cycle
// bookkeeping (useCycles.js) can label them with the current cycle. Not set
// until the one-time upgrade steps have run, so the fill-in they do is labelled
// by the upgrade rule instead.
let firstMarkHandler = null

/** Register (or with null, remove) the first-mark callback. */
export function setFirstMarkHandler(fn) {
  firstMarkHandler = typeof fn === 'function' ? fn : null
}

/**
 * Write the pending map to storage now instead of after the debounce, folding
 * in what other tabs wrote. The cycle move needs this to keep its
 * archive -> clear -> label order on disk.
 */
export function flushProgress() {
  persister.flush()
}

export function useProgress() {
  const getVerseProgress = (parasha, verseKey) => {
    return progress.value[parasha]?.[verseKey] || {
      hebrew1: false,
      hebrew2: false,
      targum: false
    }
  }

  // A verse shared by a combined route and its singles (e.g. matot-masei and
  // matot) is written to all of them, mark and un-mark alike, so reading it
  // under one counts under the others. Each write is an ordinary dirty field,
  // so the cross-tab merge treats it like any other change.
  const setVerseProgress = (parasha, verseKey, field, value) => {
    const routes = routesForVerse(parasha, verseKey)
    const fresh = value === true && firstMarkHandler
      ? routes.filter(r => !hasMarks(progress.value[r]))
      : []
    for (const route of routes) writeField(route, verseKey, field, value)
    if (fresh.length) firstMarkHandler(fresh)
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

  // Clears `parasha` and the same verses in overlapping routes; otherwise the
  // shared credit would bring them straight back. Routes lying entirely inside
  // it (combined -> both singles) are cleared whole; a route that only partly
  // overlaps (single -> the combined route) gets its shared verses written
  // false field by field, so the merge keeps the rest of that route.
  const clearParshaProgress = (parasha) => {
    // Pick up keys another tab wrote, so the partial clear covers them too.
    adoptExternal(getItem(KEY))
    for (const [route, verseKey, field] of partialClearWrites(progress.value, parasha)) {
      writeField(route, verseKey, field, false)
    }
    for (const route of clearTargets(parasha).whole) clearWholeRoute(route)
  }

  return {
    progress,
    externalRevision,
    persistFailed,
    getVerseProgress,
    setVerseProgress,
    getParshaStats,
    clearParshaProgress
  }
}
