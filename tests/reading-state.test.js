/**
 * Derivations over per-verse progress: ranges, aliyah stats, reading pointer.
 *
 * Fixture: 20 verses crossing a chapter boundary — chapterLengths [12, 15],
 * range [0,3] -> [1,10] — split into three aliyah blocks of 7 / 6 / 7.
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import * as lib from '../src/lib/progressMath.js'
import { useReadingState } from '../src/composables/useReadingState.js'
import {
  PHASES,
  verseKey,
  parseKey,
  isVerseComplete,
  rangeKeys,
  aliyahStats,
  nextUnread,
  isRouteComplete,
  dailyGuide,
  urgency
} from '../src/lib/progressMath.js'

const CHAPTER_LENGTHS = [12, 15]

const BLOCKS = [
  rangeKeys([0, 3], [0, 9], CHAPTER_LENGTHS),
  rangeKeys([0, 10], [1, 3], CHAPTER_LENGTHS),
  rangeKeys([1, 4], [1, 10], CHAPTER_LENGTHS)
]
const ALL_KEYS = BLOCKS.flat()

/** Storage-contract record: exactly the three booleans. */
function rec(phases = {}) {
  return { hebrew1: false, hebrew2: false, targum: false, ...phases }
}

/** Build a progress map: `{ [key]: { ...phases } }` for the given keys. */
function mark(keys, phases) {
  const progress = {}
  for (const key of keys) progress[key] = rec(phases)
  return progress
}

describe('fixture', () => {
  it('is 20 verses across a chapter boundary in three blocks', () => {
    expect(ALL_KEYS).toHaveLength(20)
    expect(BLOCKS.map((b) => b.length)).toEqual([7, 6, 7])
    expect(ALL_KEYS[0]).toBe('0:3')
    expect(ALL_KEYS.at(-1)).toBe('1:10')
    expect(new Set(ALL_KEYS).size).toBe(20)
  })
})

describe('verseKey / parseKey', () => {
  it('round-trips 0-indexed positions', () => {
    expect(verseKey(0, 0)).toBe('0:0')
    expect(verseKey(3, 12)).toBe('3:12')
    expect(parseKey('3:12')).toEqual([3, 12])
    expect(parseKey(verseKey(11, 4))).toEqual([11, 4])
  })

  it('throws on malformed input', () => {
    expect(() => verseKey(-1, 0)).toThrow()
    expect(() => verseKey(1.5, 0)).toThrow()
    expect(() => parseKey('bereshit')).toThrow()
    expect(() => parseKey('1:2:3')).toThrow()
  })
})

describe('rangeKeys', () => {
  it('is ordered and crosses chapter boundaries', () => {
    expect(rangeKeys([0, 29], [1, 1], [31, 25])).toEqual(['0:29', '0:30', '1:0', '1:1'])
  })

  it('is inclusive of both endpoints inside a single chapter', () => {
    expect(rangeKeys([1, 4], [1, 6], CHAPTER_LENGTHS)).toEqual(['1:4', '1:5', '1:6'])
    expect(rangeKeys([1, 4], [1, 4], CHAPTER_LENGTHS)).toEqual(['1:4'])
  })

  it('fills whole intermediate chapters', () => {
    expect(rangeKeys([0, 2], [2, 0], [4, 3, 5])).toEqual([
      '0:2', '0:3', '1:0', '1:1', '1:2', '2:0'
    ])
  })

  it('throws when end is before start', () => {
    expect(() => rangeKeys([1, 5], [1, 4], CHAPTER_LENGTHS)).toThrow(/end is before start/)
    expect(() => rangeKeys([1, 0], [0, 11], CHAPTER_LENGTHS)).toThrow(/end is before start/)
  })

  it('throws when a perek or pasuk is out of range', () => {
    expect(() => rangeKeys([0, 0], [2, 0], CHAPTER_LENGTHS)).toThrow()
    expect(() => rangeKeys([0, 0], [1, 15], CHAPTER_LENGTHS)).toThrow()
    expect(() => rangeKeys([0, 0], [1, 0], [])).toThrow()
  })
})

describe('aliyahStats', () => {
  const block = BLOCKS[0] // 7 keys

  it('counts each phase independently; missing records count as all-false', () => {
    const progress = {
      ...mark(block.slice(0, 5), { hebrew1: true }),
      ...mark(block.slice(0, 3), { hebrew1: true, hebrew2: true }),
      ...mark(block.slice(0, 1), { hebrew1: true, hebrew2: true, targum: true })
    }
    const stats = aliyahStats(progress, block)
    expect(stats).toEqual({
      hebrew1: 5,
      hebrew2: 3,
      targum: 1,
      complete: 1,
      total: 7,
      percent: 14 // 1/7 = 14.28 -> 14
    })
  })

  it('complete === total only when every phase of every key is true', () => {
    const almost = {
      ...mark(block, { hebrew1: true, hebrew2: true, targum: true }),
      [block.at(-1)]: rec({ hebrew1: true, hebrew2: true })
    }
    const almostStats = aliyahStats(almost, block)
    expect(almostStats.complete).toBe(6)
    expect(almostStats.complete).not.toBe(almostStats.total)
    expect(almostStats.percent).toBe(86) // 6/7 = 85.7 -> 86

    const done = aliyahStats(mark(block, { hebrew1: true, hebrew2: true, targum: true }), block)
    expect(done.complete).toBe(done.total)
    expect(done.percent).toBe(100)
  })

  it('rounds percent to the nearest integer', () => {
    const three = mark(block.slice(0, 3), { hebrew1: true, hebrew2: true, targum: true })
    expect(aliyahStats(three, block).percent).toBe(43) // 3/7 = 42.86 -> 43
    const oneOfTwenty = mark(ALL_KEYS.slice(0, 1), { hebrew1: true, hebrew2: true, targum: true })
    expect(aliyahStats(oneOfTwenty, ALL_KEYS).percent).toBe(5)
  })

  it('returns zeros for an empty key list', () => {
    expect(aliyahStats({}, [])).toEqual({
      hebrew1: 0, hebrew2: 0, targum: 0, complete: 0, total: 0, percent: 0
    })
  })

  it('ignores progress entries outside the key list', () => {
    const progress = mark(BLOCKS[1], { hebrew1: true, hebrew2: true, targum: true })
    expect(aliyahStats(progress, BLOCKS[0])).toEqual({
      hebrew1: 0, hebrew2: 0, targum: 0, complete: 0, total: 7, percent: 0
    })
  })

  it('does not mutate the progress map', () => {
    const progress = mark(block, { hebrew1: true })
    const snapshot = JSON.parse(JSON.stringify(progress))
    aliyahStats(progress, block)
    expect(progress).toEqual(snapshot)
  })
})

describe('nextUnread', () => {
  const firstKey = ALL_KEYS[0]
  const secondKey = ALL_KEYS[1]

  it('returns the first key hebrew1 on empty progress, in both styles', () => {
    for (const style of ['verse', 'aliyah']) {
      expect(nextUnread({}, BLOCKS, style)).toEqual({ key: firstKey, phase: 'hebrew1' })
    }
  })

  it('agrees when the whole first block has only hebrew1 done', () => {
    const progress = mark(BLOCKS[0], { hebrew1: true })
    expect(nextUnread(progress, BLOCKS, 'verse')).toEqual({ key: firstKey, phase: 'hebrew2' })
    expect(nextUnread(progress, BLOCKS, 'aliyah')).toEqual({ key: firstKey, phase: 'hebrew2' })
  })

  it('diverges: first key hebrew1+hebrew2, second key untouched', () => {
    const progress = { [firstKey]: rec({ hebrew1: true, hebrew2: true }) }
    expect(nextUnread(progress, BLOCKS, 'verse')).toEqual({ key: firstKey, phase: 'targum' })
    expect(nextUnread(progress, BLOCKS, 'aliyah')).toEqual({ key: secondKey, phase: 'hebrew1' })
  })

  it('returns null when every key has all three phases, in both styles', () => {
    const progress = mark(ALL_KEYS, { hebrew1: true, hebrew2: true, targum: true })
    expect(nextUnread(progress, BLOCKS, 'verse')).toBeNull()
    expect(nextUnread(progress, BLOCKS, 'aliyah')).toBeNull()
  })

  it("'aliyah' style crosses into block 2 only after block 1 is exhausted", () => {
    // Block 1 done except the last key's targum: aliyah style stays in block 1.
    const partial = {
      ...mark(BLOCKS[0], { hebrew1: true, hebrew2: true, targum: true }),
      [BLOCKS[0].at(-1)]: rec({ hebrew1: true, hebrew2: true })
    }
    expect(nextUnread(partial, BLOCKS, 'aliyah')).toEqual({
      key: BLOCKS[0].at(-1), phase: 'targum'
    })

    // Block 1 fully done, block 2's first key has hebrew1: now we cross over.
    const crossed = {
      ...mark(BLOCKS[0], { hebrew1: true, hebrew2: true, targum: true }),
      [BLOCKS[1][0]]: rec({ hebrew1: true })
    }
    expect(nextUnread(crossed, BLOCKS, 'aliyah')).toEqual({
      key: BLOCKS[1][1], phase: 'hebrew1'
    })
    expect(nextUnread(crossed, BLOCKS, 'verse')).toEqual({
      key: BLOCKS[1][0], phase: 'hebrew2'
    })
  })

  it("'verse' style ignores block membership", () => {
    const progress = mark(BLOCKS[0], { hebrew1: true })
    const flat = [ALL_KEYS]
    // Same keys in the same order => same answer, however they are grouped.
    expect(nextUnread(progress, flat, 'verse')).toEqual(nextUnread(progress, BLOCKS, 'verse'))
    expect(nextUnread(progress, flat, 'verse')).toEqual({ key: firstKey, phase: 'hebrew2' })
    // ...while aliyah style is entirely defined by the grouping.
    expect(nextUnread(progress, BLOCKS, 'aliyah')).toEqual({ key: firstKey, phase: 'hebrew2' })
    expect(nextUnread(progress, flat, 'aliyah')).toEqual({ key: BLOCKS[1][0], phase: 'hebrew1' })
  })

  it('handles no blocks at all', () => {
    expect(nextUnread({}, [], 'verse')).toBeNull()
    expect(nextUnread({}, [], 'aliyah')).toBeNull()
  })

  it('throws on an unknown style', () => {
    expect(() => nextUnread({}, BLOCKS, 'chapter')).toThrow(/unknown style/)
    expect(() => nextUnread({}, BLOCKS, undefined)).toThrow(/unknown style/)
  })
})

describe('isVerseComplete', () => {
  it('is false for undefined and partial records, true only when all three are true', () => {
    expect(isVerseComplete(undefined)).toBe(false)
    expect(isVerseComplete(null)).toBe(false)
    expect(isVerseComplete(rec())).toBe(false)
    expect(isVerseComplete(rec({ hebrew1: true }))).toBe(false)
    expect(isVerseComplete(rec({ hebrew1: true, hebrew2: true }))).toBe(false)
    expect(isVerseComplete(rec({ hebrew1: true, targum: true }))).toBe(false)
    expect(isVerseComplete(rec({ hebrew1: true, hebrew2: true, targum: true }))).toBe(true)
  })

  it('requires real booleans, not truthy values', () => {
    expect(isVerseComplete({ hebrew1: 1, hebrew2: 1, targum: 1 })).toBe(false)
  })
})

describe('PHASES', () => {
  it('is the three phases in reading order', () => {
    expect(PHASES).toEqual(['hebrew1', 'hebrew2', 'targum'])
  })
})

/**
 * Anti-gating invariant: nothing here may return a handle for hiding,
 * disabling, locking or gating content. Every object returned by any export
 * must have keys inside the documented whitelist.
 */
describe('anti-gating invariant', () => {
  const WHITELIST = new Set([
    // aliyahStats
    'hebrew1', 'hebrew2', 'targum', 'complete', 'total', 'percent',
    // nextUnread
    'key', 'phase',
    // dailyGuide
    'aliyot', 'review'
  ])
  const FORBIDDEN = [
    'hidden', 'hide', 'disabled', 'disable', 'locked', 'lock', 'allowed', 'allow',
    'gated', 'gate', 'canRead', 'canView', 'blocked', 'block', 'visible', 'enabled',
    'restricted', 'readonly', 'available', 'unlocked'
  ]

  const shabbat = new Date(2026, 8, 12)
  const sampleReturns = [
    aliyahStats({}, ALL_KEYS),
    aliyahStats(mark(ALL_KEYS, { hebrew1: true, hebrew2: true, targum: true }), ALL_KEYS),
    aliyahStats({}, []),
    nextUnread({}, BLOCKS, 'verse'),
    nextUnread({}, BLOCKS, 'aliyah'),
    nextUnread(mark(ALL_KEYS, { hebrew1: true, hebrew2: true, targum: true }), BLOCKS, 'verse'),
    dailyGuide(1, 7),
    dailyGuide(6, 5),
    urgency(new Date(2026, 8, 10), shabbat),
    urgency(new Date(2026, 8, 20), shabbat),
    verseKey(0, 0),
    parseKey('0:0'),
    isVerseComplete(rec()),
    rangeKeys([0, 3], [1, 10], CHAPTER_LENGTHS)
  ]

  it('every returned object exposes only whitelisted keys', () => {
    for (const value of sampleReturns) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) continue
      for (const key of Object.keys(value)) {
        expect(WHITELIST.has(key), `unexpected returned key ${key}`).toBe(true)
      }
    }
  })

  it('no returned value carries a gating flag, at any depth', () => {
    const seen = JSON.stringify(sampleReturns).toLowerCase()
    for (const flag of FORBIDDEN) {
      expect(seen.includes(`"${flag.toLowerCase()}"`), `found gating key ${flag}`).toBe(false)
    }
  })

  it('every export is a function or the PHASES constant, and nothing else', () => {
    const names = Object.keys(lib).sort()
    expect(names).toEqual([
      'PHASES', 'aliyahStats', 'dailyGuide', 'isRouteComplete', 'isVerseComplete',
      'nextUnread', 'parseKey', 'rangeKeys', 'urgency', 'verseKey'
    ])
    for (const [name, value] of Object.entries(lib)) {
      if (name === 'PHASES') continue
      expect(typeof value, `${name} should be a function`).toBe('function')
    }
  })

  it('dailyGuide.aliyot holds plain numbers only', () => {
    for (let day = 0; day <= 6; day++) {
      for (const n of dailyGuide(day, 7).aliyot) expect(typeof n).toBe('number')
    }
  })
})

/**
 * Scoped pointer: displayMode 'aliyah' shows ONE aliyah, so the pointer has to
 * be computed over that block alone or it lands outside the verses on screen
 * (no marker, a seed that falls back to verse 0, an advance that sticks).
 * The whole-parsha pointer stays the truth; this is a second, narrower view.
 */
describe('nextUnread scoped to one aliyah (opts.only)', () => {
  it('stays inside the requested block instead of returning the parsha pointer', () => {
    // Everything in block 0 is read; the unscoped pointer is in block 1.
    const progress = mark(BLOCKS[0], { hebrew1: true, hebrew2: true, targum: true })
    expect(nextUnread(progress, BLOCKS, 'verse')).toEqual({ key: BLOCKS[1][0], phase: 'hebrew1' })
    expect(nextUnread(progress, BLOCKS, 'verse', { only: 2 }))
      .toEqual({ key: BLOCKS[2][0], phase: 'hebrew1' })
    expect(nextUnread(progress, BLOCKS, 'verse', { only: 0 })).toBe(null)
  })

  it('keeps the aliyah traversal order within the scoped block', () => {
    // First pass over block 1 done: the scoped pointer goes back to its top for hebrew2.
    const progress = mark(BLOCKS[1], { hebrew1: true })
    expect(nextUnread(progress, BLOCKS, 'aliyah', { only: 1 }))
      .toEqual({ key: BLOCKS[1][0], phase: 'hebrew2' })
    // ... and verse style still walks the same block phase-by-phase per verse.
    expect(nextUnread(progress, BLOCKS, 'verse', { only: 1 }))
      .toEqual({ key: BLOCKS[1][0], phase: 'hebrew2' })
  })

  it('accepts several block indexes, in block order', () => {
    const progress = mark(BLOCKS[1], { hebrew1: true, hebrew2: true, targum: true })
    expect(nextUnread(progress, BLOCKS, 'verse', { only: [1, 2] }))
      .toEqual({ key: BLOCKS[2][0], phase: 'hebrew1' })
  })

  it('is null (never a throw) for an out-of-range or finished scope', () => {
    expect(nextUnread({}, BLOCKS, 'verse', { only: 9 })).toBe(null)
    expect(nextUnread({}, BLOCKS, 'aliyah', { only: -1 })).toBe(null)
    const all = mark(ALL_KEYS, { hebrew1: true, hebrew2: true, targum: true })
    expect(nextUnread(all, BLOCKS, 'aliyah', { only: 1 })).toBe(null)
  })

  it('throws on a non-integer scope', () => {
    expect(() => nextUnread({}, BLOCKS, 'verse', { only: 'first' })).toThrow(/opts.only/)
    expect(() => nextUnread({}, BLOCKS, 'verse', { only: [0, 1.5] })).toThrow(/opts.only/)
  })

  it('leaves the unscoped result untouched', () => {
    for (const style of ['verse', 'aliyah']) {
      expect(nextUnread({}, BLOCKS, style, {})).toEqual(nextUnread({}, BLOCKS, style))
      expect(nextUnread({}, BLOCKS, style, { only: null })).toEqual(nextUnread({}, BLOCKS, style))
    }
  })
})

/**
 * Route completeness WITHOUT the chumash: the aliyot entry knows how many
 * verses the parsha has, so counting complete records inside its ranges is
 * exact. This is what lets the default week stay on last week's parsha while
 * it is unfinished, before any chapter data has been fetched.
 */
describe('isRouteComplete', () => {
  const ENTRY = {
    book: 'test',
    aliyot: [
      { n: 1, start: [0, 3], end: [0, 9], verseCount: 7 },
      { n: 2, start: [0, 10], end: [1, 3], verseCount: 6 },
      { n: 3, start: [1, 4], end: [1, 10], verseCount: 7 }
    ],
    total: 20
  }
  const ALL_DONE = mark(ALL_KEYS, { hebrew1: true, hebrew2: true, targum: true })

  it('is true only when every verse of the parsha is complete', () => {
    expect(isRouteComplete(ALL_DONE, ENTRY)).toBe(true)
    const oneShort = { ...ALL_DONE, [ALL_KEYS.at(-1)]: rec({ hebrew1: true, hebrew2: true }) }
    expect(isRouteComplete(oneShort, ENTRY)).toBe(false)
    expect(isRouteComplete({}, ENTRY)).toBe(false)
  })

  it('does not let verses outside the parsha make up the count', () => {
    const short = { ...ALL_DONE }
    delete short[ALL_KEYS[0]]
    const padded = {
      ...short,
      ...mark(['9:9', '8:1'], { hebrew1: true, hebrew2: true, targum: true })
    }
    expect(isRouteComplete(padded, ENTRY)).toBe(false)
  })

  it('ignores malformed keys instead of throwing', () => {
    const noisy = { ...ALL_DONE, bereshit: rec({ hebrew1: true, hebrew2: true, targum: true }) }
    expect(isRouteComplete(noisy, ENTRY)).toBe(true)
  })

  it('falls back to the sum of verseCount when total is missing', () => {
    const noTotal = { book: ENTRY.book, aliyot: ENTRY.aliyot }
    expect(isRouteComplete(ALL_DONE, noTotal)).toBe(true)
    const oneShort = { ...ALL_DONE, [ALL_KEYS[0]]: rec({ hebrew1: true }) }
    expect(isRouteComplete(oneShort, noTotal)).toBe(false)
  })

  it('is false when the entry is missing or unusable', () => {
    expect(isRouteComplete(ALL_DONE, null)).toBe(false)
    expect(isRouteComplete(ALL_DONE, {})).toBe(false)
    expect(isRouteComplete(ALL_DONE, { aliyot: [] })).toBe(false)
    expect(isRouteComplete(ALL_DONE, { aliyot: ENTRY.aliyot, total: 0 })).toBe(false)
  })

  it('returns a bare boolean (nothing that could gate content)', () => {
    expect(typeof isRouteComplete(ALL_DONE, ENTRY)).toBe('boolean')
    expect(typeof isRouteComplete({}, ENTRY)).toBe('boolean')
  })
})

/**
 * scopeComplete: WHY the scoped pointer is null.
 *
 * A null pointer means either "everything on screen is read" or "nothing is
 * derived yet". ParshaDisplay's seed has to tell them apart: parking the
 * selection at verse 0 / phase 1 when the scope is finished lands on an
 * already-read phase, and the next Space un-marks it and persists that.
 */
describe('useReadingState: scopeComplete', () => {
  const ENTRY = {
    book: 'test',
    aliyot: [
      { n: 1, start: [0, 3], end: [0, 9], verseCount: 7 },
      { n: 2, start: [0, 10], end: [1, 3], verseCount: 6 },
      { n: 3, start: [1, 4], end: [1, 10], verseCount: 7 }
    ],
    total: 20
  }
  const DONE = { hebrew1: true, hebrew2: true, targum: true }

  const setup = ({ progress = {}, scope = null, lengths = CHAPTER_LENGTHS } = {}) => {
    const prog = ref(progress)
    const scopeN = ref(scope)
    const lens = ref(lengths)
    const state = useReadingState({
      aliyotEntry: () => ENTRY,
      chapterLengths: () => lens.value,
      loadedChumash: () => ENTRY.book,
      progress: () => prog.value,
      style: () => 'verse',
      scope: () => scopeN.value
    })
    return { prog, scopeN, lens, state }
  }

  it('is false while there is still something to read', () => {
    const { state } = setup()
    expect(state.scopedPointer.value).toEqual({ key: ALL_KEYS[0], phase: 'hebrew1' })
    expect(state.scopeComplete.value).toBe(false)
  })

  it('is true when the whole parsha is read (the focus-mode exit case)', () => {
    const { state } = setup({ progress: mark(ALL_KEYS, DONE) })
    expect(state.scopedPointer.value).toBe(null)
    expect(state.scopeComplete.value).toBe(true)
  })

  it('is true for a finished displayed aliyah even though the parsha is not done', () => {
    const { state } = setup({ progress: mark(BLOCKS[1], DONE), scope: 2 })
    expect(state.scopedPointer.value).toBe(null)
    expect(state.pointer.value).toEqual({ key: BLOCKS[0][0], phase: 'hebrew1' })
    expect(state.scopeComplete.value).toBe(true)
  })

  it('stays false when nothing is derived yet (no chapter lengths)', () => {
    const { state } = setup({ progress: mark(ALL_KEYS, DONE), lengths: [] })
    expect(state.scopedPointer.value).toBe(null)
    expect(state.scopeComplete.value).toBe(false)
  })

  it('stays false for a scope naming an aliyah this parsha does not have', () => {
    const { state } = setup({ scope: 9 })
    expect(state.scopedPointer.value).toBe(null)
    expect(state.scopeComplete.value).toBe(false)
  })

  it('follows progress reactively, in both directions', () => {
    const { prog, state } = setup({ scope: 3 })
    expect(state.scopeComplete.value).toBe(false)
    prog.value = mark(BLOCKS[2], DONE)
    expect(state.scopeComplete.value).toBe(true)
    prog.value = { ...prog.value, [BLOCKS[2][0]]: rec({ hebrew1: true, hebrew2: true }) }
    expect(state.scopeComplete.value).toBe(false)
    expect(state.scopedPointer.value).toEqual({ key: BLOCKS[2][0], phase: 'targum' })
  })

  it('carries no gating flag', () => {
    const { state } = setup({ progress: mark(ALL_KEYS, DONE) })
    expect(typeof state.scopeComplete.value).toBe('boolean')
  })
})
