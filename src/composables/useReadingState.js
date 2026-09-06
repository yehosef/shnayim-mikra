import { computed, toValue } from 'vue'
import { rangeKeys, aliyahStats, nextUnread, parseKey } from '../lib/progressMath'
import { aliyahFor } from './useAliyot'

/**
 * Everything derived from per-verse progress: aliyah rollups, the reading
 * pointer, and the containing aliyah. All `computed`, nothing stored — the
 * pointer is recomputed from progress on every change, so it can never freeze.
 *
 * @param {object} src
 * @param {() => object|null} src.aliyotEntry   aliyot.json entry for the route
 * @param {() => number[]}    src.chapterLengths verse count per chapter of the chumash
 * @param {() => string|null} src.loadedChumash  which chumash chapterLengths belong to
 * @param {() => object}      src.progress       progress map for this parsha ({ key: {hebrew1,hebrew2,targum} })
 * @param {() => string}      src.style          'verse' | 'aliyah'
 */
export function useReadingState({ aliyotEntry, chapterLengths, loadedChumash, progress, style }) {
  const blocks = computed(() => {
    const entry = toValue(aliyotEntry)
    const lens = toValue(chapterLengths)
    if (!entry || !lens || lens.length === 0) return []
    // While a different chumash is (still) loaded, the lengths don't apply
    if (loadedChumash && toValue(loadedChumash) !== entry.book) return []
    return entry.aliyot.map(a => rangeKeys(a.start, a.end, lens))
  })

  const aliyahStatsList = computed(() => {
    const entry = toValue(aliyotEntry)
    const prog = toValue(progress) || {}
    return blocks.value.map((keys, i) => ({
      n: entry.aliyot[i].n,
      ...aliyahStats(prog, keys)
    }))
  })

  const parshaStats = computed(() => {
    const prog = toValue(progress) || {}
    return aliyahStats(prog, blocks.value.flat())
  })

  /** { key, phase } of the next unread step in the active style, or null when done. */
  const pointer = computed(() => {
    if (blocks.value.length === 0) return null
    return nextUnread(toValue(progress) || {}, blocks.value, toValue(style) || 'verse')
  })

  /** Aliyah number the pointer sits in; last aliyah when everything is read. */
  const currentAliyahN = computed(() => {
    const entry = toValue(aliyotEntry)
    if (!entry) return null
    if (!pointer.value) return entry.aliyot[entry.aliyot.length - 1].n
    const [p, v] = parseKey(pointer.value.key)
    return aliyahFor(entry, p, v)?.n ?? null
  })

  const isPointer = (perek, pasuk) => {
    const ptr = pointer.value
    return !!ptr && ptr.key === `${perek}:${pasuk}`
  }

  const inCurrentAliyah = (perek, pasuk) => {
    const entry = toValue(aliyotEntry)
    const n = currentAliyahN.value
    if (!entry || n == null) return false
    return aliyahFor(entry, perek, pasuk)?.n === n
  }

  return {
    blocks,
    aliyahStatsList,
    parshaStats,
    pointer,
    currentAliyahN,
    isPointer,
    inCurrentAliyah
  }
}
