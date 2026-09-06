/**
 * Derivations over per-verse progress: ranges, aliyah stats, reading pointer.
 *
 * Fixture: 20 verses crossing a chapter boundary — chapterLengths [12, 15],
 * range [0,3] -> [1,10] — split into three aliyah blocks of 7 / 6 / 7.
 */
import { describe, it, expect } from 'vitest'
import * as lib from '../src/lib/progressMath.js'
import {
  PHASES,
  verseKey,
  parseKey,
  isVerseComplete,
  rangeKeys,
  aliyahStats,
  nextUnread,
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
      'PHASES', 'aliyahStats', 'dailyGuide', 'isVerseComplete',
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
