import { describe, it, expect } from 'vitest'
import { routeProgressState, rangeKeys } from '../src/lib/progressMath.js'

// The marks in the parsha picker: finished, partly read, or nothing.
const CHAPTER_LENGTHS = [12, 15]
const ENTRY = {
  book: 'test',
  aliyot: [
    { n: 1, start: [0, 3], end: [0, 9], verseCount: 7 },
    { n: 2, start: [0, 10], end: [1, 3], verseCount: 6 },
    { n: 3, start: [1, 4], end: [1, 10], verseCount: 7 }
  ],
  total: 20
}
const KEYS = rangeKeys([0, 3], [1, 10], CHAPTER_LENGTHS)
const DONE = { hebrew1: true, hebrew2: true, targum: true }
const all = (rec) => Object.fromEntries(KEYS.map((k) => [k, { ...rec }]))

describe('routeProgressState', () => {
  it('is complete only when every verse has all three pieces', () => {
    expect(routeProgressState(all(DONE), ENTRY)).toBe('complete')
  })

  it('is partial when at least one piece of one verse is marked', () => {
    expect(routeProgressState({ [KEYS[4]]: { hebrew1: true } }, ENTRY)).toBe('partial')
    const oneShort = { ...all(DONE), [KEYS[0]]: { hebrew1: true, hebrew2: true } }
    expect(routeProgressState(oneShort, ENTRY)).toBe('partial')
  })

  it('is none for empty progress or all-false records', () => {
    expect(routeProgressState({}, ENTRY)).toBe('none')
    expect(routeProgressState(undefined, ENTRY)).toBe('none')
    expect(routeProgressState({ [KEYS[0]]: { hebrew1: false, hebrew2: false, targum: false } }, ENTRY)).toBe('none')
  })

  it('ignores marks outside the parsha and malformed keys', () => {
    expect(routeProgressState({ '9:9': { hebrew1: true }, bereshit: { hebrew1: true } }, ENTRY)).toBe('none')
  })

  it('is null (unknown) when the aliyot entry is missing or unusable', () => {
    expect(routeProgressState(all(DONE), null)).toBeNull()
    expect(routeProgressState(all(DONE), {})).toBeNull()
    expect(routeProgressState(all(DONE), { aliyot: [] })).toBeNull()
  })

  it('returns a plain label string, never an object that could gate content', () => {
    expect(typeof routeProgressState(all(DONE), ENTRY)).toBe('string')
  })
})
