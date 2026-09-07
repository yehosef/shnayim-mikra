import { ref, watch } from 'vue'
import { getItem, createPersister, onExternalWrite } from '../lib/storage'

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

// Parshiyot cleared in this tab since the last write. Without this the merge
// below would resurrect them from disk and clearing would never stick.
const clearedRoutes = new Set()

/**
 * Merge what is on disk into what this tab holds. Another tab may have written
 * verses this tab never saw, and every persist rewrites the whole map, so
 * without this a write silently discards the other tab's marks.
 *
 * Per verse key the in-memory record wins — this is the tab that just changed
 * it — and every key only the other tab has is kept.
 */
function mergeProgress(disk, mem) {
  const out = {}
  for (const [route, verses] of Object.entries(disk)) {
    if (clearedRoutes.has(route)) continue
    if (verses && typeof verses === 'object') out[route] = { ...verses }
  }
  for (const [route, verses] of Object.entries(mem)) {
    out[route] = { ...(out[route] || {}), ...verses }
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
  clearedRoutes.clear()
  return serialized
})

watch(progress, () => persister.schedule(), { deep: true })

// Another tab wrote: adopt its map wholesale. `adopt` marks it as already
// persisted so the watcher this assignment wakes does not write it back.
onExternalWrite(KEY, (raw) => {
  const incoming = parseProgress(raw)
  const serialized = JSON.stringify(incoming)
  if (serialized === JSON.stringify(progress.value)) return
  clearedRoutes.clear()
  persister.adopt(serialized)
  progress.value = incoming
})

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
      progress.value[parasha][verseKey] = { hebrew1: false, hebrew2: false, targum: false }
    }
    progress.value[parasha][verseKey][field] = value
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
      delete progress.value[parasha]
    }
  }

  return {
    progress,
    getVerseProgress,
    setVerseProgress,
    getParshaStats,
    clearParshaProgress
  }
}
