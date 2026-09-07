import { computed, toValue } from 'vue'
import { rangeKeys, aliyahStats, nextUnread, parseKey } from '../lib/progressMath'
import { aliyahFor } from './useAliyot'

/**
 * Everything derived from per-verse progress: aliyah rollups, the reading
 * pointer, and the containing aliyah. All `computed`, nothing stored — the
 * pointer is recomputed from progress on every change, so it can never freeze.
 *
 * There are two pointers, and the whole-parsha one is the truth:
 *  - `pointer`       — the next unread step of the WHOLE parsha (AliyahBar's
 *                      current-aliyah chip, focus mode, the default seed).
 *  - `scopedPointer` — the same computation restricted to the aliyah `scope`
 *                      names, so that when only one aliyah is displayed the
 *                      pointer marker, the seed and the advance all land inside
 *                      the verses actually on screen. Equals `pointer` when
 *                      `scope` is null, and is null when the scoped aliyah is
 *                      already finished — `scopeComplete` says which of the
 *                      two reasons for a null pointer applies.
 *
 * @param {object} src
 * @param {() => object|null} src.aliyotEntry   aliyot.json entry for the route
 * @param {() => number[]}    src.chapterLengths verse count per chapter of the chumash
 * @param {() => string|null} src.loadedChumash  which chumash chapterLengths belong to
 * @param {() => object}      src.progress       progress map for this parsha ({ key: {hebrew1,hebrew2,targum} })
 * @param {() => string}      src.style          'verse' | 'aliyah'
 * @param {() => number|null} [src.scope]        aliyah number (1-based) the view is limited to
 */
export function useReadingState({ aliyotEntry, chapterLengths, loadedChumash, progress, style, scope }) {
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

  /** Index of aliyah `n` in `blocks`, or -1. */
  const blockIndexOf = (n) => {
    const entry = toValue(aliyotEntry)
    if (!entry || !Number.isInteger(n)) return -1
    return entry.aliyot.findIndex(a => a.n === n)
  }

  /** The next unread step inside aliyah `n` only, or null (done / unknown aliyah). */
  const nextUnreadIn = (n) => {
    const i = blockIndexOf(n)
    if (i < 0 || blocks.value.length === 0) return null
    return nextUnread(toValue(progress) || {}, blocks.value, toValue(style) || 'verse', { only: i })
  }

  /** The scope aliyah number, or null when the whole parsha is displayed. */
  const scopeN = computed(() => {
    const n = scope ? toValue(scope) : null
    return Number.isInteger(n) ? n : null
  })

  /** Pointer restricted to the displayed aliyah; the global pointer when unscoped. */
  const scopedPointer = computed(() => {
    if (scopeN.value == null) return pointer.value
    return nextUnreadIn(scopeN.value)
  })

  /**
   * Why `scopedPointer` is null, which callers must tell apart:
   *  - true  — everything in the displayed scope is read (nothing left to mark)
   *  - false — nothing is derived yet (aliyot.json or the chumash still
   *            loading, or a scope naming an aliyah this parsha does not have)
   * Seeding the selection at verse 0 / phase 1 is right in the second case and
   * wrong in the first, where it parks on an already-read phase that the next
   * Space would silently un-mark. Advisory only: nothing gates on it.
   */
  const scopeComplete = computed(() => {
    if (blocks.value.length === 0) return false
    if (scopeN.value != null && blockIndexOf(scopeN.value) < 0) return false
    return scopedPointer.value === null
  })

  /** Aliyah number the pointer sits in; last aliyah when everything is read. */
  const currentAliyahN = computed(() => {
    const entry = toValue(aliyotEntry)
    if (!entry) return null
    if (!pointer.value) return entry.aliyot[entry.aliyot.length - 1].n
    const [p, v] = parseKey(pointer.value.key)
    return aliyahFor(entry, p, v)?.n ?? null
  })

  /**
   * Aliyah the *scoped* pointer sits in — the displayed aliyah while scoped,
   * so the in-scope highlight follows what is on screen. Falls back to the
   * whole-parsha answer when unscoped.
   */
  const scopedAliyahN = computed(() => {
    if (scopeN.value == null) return currentAliyahN.value
    return scopeN.value
  })

  const isPointer = (perek, pasuk) => {
    const ptr = scopedPointer.value
    return !!ptr && ptr.key === `${perek}:${pasuk}`
  }

  const inCurrentAliyah = (perek, pasuk) => {
    const entry = toValue(aliyotEntry)
    const n = scopedAliyahN.value
    if (!entry || n == null) return false
    return aliyahFor(entry, perek, pasuk)?.n === n
  }

  return {
    blocks,
    aliyahStatsList,
    parshaStats,
    pointer,
    scopedPointer,
    scopeComplete,
    nextUnreadIn,
    currentAliyahN,
    scopedAliyahN,
    isPointer,
    inCurrentAliyah
  }
}
