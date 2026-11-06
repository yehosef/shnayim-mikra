/**
 * One-reading view rules (src/lib/layerStep.js): an aliyah read one reading
 * at a time — every pasuk in the first reading, then the second, then the
 * counted translation — with a "Finished this reading" button and its Undo.
 */
import { describe, it, expect } from 'vitest'
import {
  READINGS,
  FIELD_OF,
  firstUnread,
  readingOnScreen,
  firstUnreadStep,
  showReading,
  nextInReading,
  stepInReading,
  finishReadingKeys,
  undoFinishWrites,
  readingEnd,
  translationLayerFor,
  translationLayout
} from '../src/lib/layerStep.js'
import { nextUnread, rangeKeys } from '../src/lib/progressMath.js'

const T = true
const F = false
const all = (n, v) => Array(n).fill(v)

describe('readings and fields', () => {
  it('numbers the readings as the list view does', () => {
    expect(READINGS).toEqual([1, 2, 3])
    expect(FIELD_OF).toEqual({ 1: 'hebrew1', 2: 'hebrew2', 3: 'targum' })
  })
})

describe('firstUnread', () => {
  it('finds the first false, -1 when all are read or the list is empty', () => {
    expect(firstUnread([T, T, F, F])).toBe(2)
    expect(firstUnread([T, T])).toBe(-1)
    expect(firstUnread([])).toBe(-1)
    expect(firstUnread(undefined)).toBe(-1)
  })
})

describe('readingOnScreen', () => {
  it('is the selected reading while there is one', () => {
    expect(readingOnScreen({ selectedPhase: 1, lastReading: 3 })).toBe(1)
    expect(readingOnScreen({ selectedPhase: 2, lastReading: null })).toBe(2)
  })

  it('parked: the reading the reader was last on', () => {
    expect(readingOnScreen({ selectedPhase: 0, lastReading: 1 })).toBe(1)
  })

  it('parked with no reading yet (a finished aliyah opened): the translation', () => {
    expect(readingOnScreen({ selectedPhase: 0, lastReading: null })).toBe(3)
    expect(readingOnScreen({ selectedPhase: 0, lastReading: 0 })).toBe(3)
  })
})

describe('firstUnreadStep — the aliyah-style pointer over one aliyah', () => {
  it('walks reading 1, then 2, then 3', () => {
    expect(firstUnreadStep({ 1: [T, F, F], 2: [F, F, F], 3: [F, F, F] })).toEqual({ index: 1, phase: 1 })
    expect(firstUnreadStep({ 1: [T, T, T], 2: [T, T, F], 3: [F, F, F] })).toEqual({ index: 2, phase: 2 })
    expect(firstUnreadStep({ 1: [T, T, T], 2: [T, T, T], 3: [T, F, T] })).toEqual({ index: 1, phase: 3 })
  })

  it('parks on the last pasuk with no reading when everything is read', () => {
    expect(firstUnreadStep({ 1: all(4, T), 2: all(4, T), 3: all(4, T) })).toEqual({ index: 3, phase: 0 })
    expect(firstUnreadStep({ 1: [], 2: [], 3: [] })).toEqual({ index: 0, phase: 0 })
  })

  it('agrees with progressMath.nextUnread in aliyah style for the same aliyah', () => {
    const keys = rangeKeys([0, 0], [0, 4], [5])
    const reads = { 1: [T, T, T, T, T], 2: [T, F, T, F, F], 3: [F, F, F, F, F] }
    const progress = {}
    keys.forEach((k, i) => {
      progress[k] = { hebrew1: reads[1][i], hebrew2: reads[2][i], targum: reads[3][i] }
    })
    const ptr = nextUnread(progress, [keys], 'aliyah', { only: 0 })
    const step = firstUnreadStep(reads)
    expect(keys[step.index]).toBe(ptr.key)
    expect(FIELD_OF[step.phase]).toBe(ptr.phase)
  })
})

describe('showReading — a reading tab or the 1 / 2 / 3 key', () => {
  it('lands on the first unread pasuk of that reading', () => {
    expect(showReading({ phase: 2, read: [T, T, F, F] })).toEqual({ index: 2, phase: 2 })
  })

  it('lands on the first pasuk when that reading is all read', () => {
    expect(showReading({ phase: 1, read: [T, T, T] })).toEqual({ index: 0, phase: 1 })
  })
})

describe('nextInReading — Space, or a tap that marked', () => {
  it('moves to the next unread pasuk of the same reading', () => {
    const readsByPhase = { 1: [T, T, F, T, F], 2: all(5, F), 3: all(5, F) }
    expect(nextInReading({ index: 1, phase: 1, readsByPhase })).toEqual({ index: 2, phase: 1 })
    expect(nextInReading({ index: 2, phase: 1, readsByPhase })).toEqual({ index: 4, phase: 1 })
  })

  it('skips pesukim already read in this reading', () => {
    const readsByPhase = { 1: all(5, T), 2: [T, T, T, T, F], 3: all(5, F) }
    expect(nextInReading({ index: 0, phase: 2, readsByPhase })).toEqual({ index: 4, phase: 2 })
  })

  it('goes back to a pasuk skipped earlier in the same reading before leaving it', () => {
    const readsByPhase = { 1: [T, F, T, T, T], 2: all(5, F), 3: all(5, F) }
    expect(nextInReading({ index: 4, phase: 1, readsByPhase })).toEqual({ index: 1, phase: 1 })
  })

  it('stays in the reading on screen for a pasuk skipped earlier, even while an earlier reading is unfinished', () => {
    // The 1st reading still lacks pasuk 0, but Space in the 2nd reading goes
    // back to the 2nd reading's skipped pasuk 1, not out to the 1st reading.
    const readsByPhase = { 1: [F, T, T], 2: [T, F, T], 3: all(3, F) }
    expect(nextInReading({ index: 2, phase: 2, readsByPhase })).toEqual({ index: 1, phase: 2 })
  })

  it('a finished reading moves on to the next reading, from its first unread pasuk', () => {
    const readsByPhase = { 1: all(5, T), 2: [T, F, F, F, F], 3: all(5, F) }
    expect(nextInReading({ index: 4, phase: 1, readsByPhase })).toEqual({ index: 1, phase: 2 })
  })

  it('reading out of order: a finished 2nd reading goes back to what the 1st still lacks', () => {
    const readsByPhase = { 1: [T, F, T], 2: all(3, T), 3: all(3, F) }
    expect(nextInReading({ index: 2, phase: 2, readsByPhase })).toEqual({ index: 1, phase: 1 })
  })

  it('parks when the whole aliyah is read', () => {
    const readsByPhase = { 1: all(4, T), 2: all(4, T), 3: all(4, T) }
    expect(nextInReading({ index: 3, phase: 3, readsByPhase })).toEqual({ index: 3, phase: 0 })
    expect(nextInReading({ index: 0, phase: 3, readsByPhase })).toEqual({ index: 3, phase: 0 })
  })
})

describe('stepInReading — the arrow keys', () => {
  it('moves one pasuk within the reading and stops at both ends', () => {
    expect(stepInReading({ index: 2, delta: 1, phase: 2, maxIndex: 4 })).toEqual({ index: 3, phase: 2 })
    expect(stepInReading({ index: 2, delta: -1, phase: 2, maxIndex: 4 })).toEqual({ index: 1, phase: 2 })
    expect(stepInReading({ index: 4, delta: 1, phase: 2, maxIndex: 4 })).toEqual({ index: 4, phase: 2 })
    expect(stepInReading({ index: 0, delta: -1, phase: 2, maxIndex: 4 })).toEqual({ index: 0, phase: 2 })
  })

  it('a parked selection steps into the reading on screen (never phase 0)', () => {
    // parked on the last pasuk; the translation is on screen
    expect(stepInReading({ index: 4, delta: -1, phase: 3, maxIndex: 4 })).toEqual({ index: 3, phase: 3 })
    expect(stepInReading({ index: 4, delta: 1, phase: 3, maxIndex: 4 })).toEqual({ index: 4, phase: 3 })
  })

  it('an empty list stays at 0', () => {
    expect(stepInReading({ index: 0, delta: 1, phase: 1, maxIndex: -1 })).toEqual({ index: 0, phase: 1 })
  })
})

describe('finishReadingKeys / undoFinishWrites — "Finished this reading" and its Undo', () => {
  const keys = ['3:0', '3:1', '3:2', '3:3']

  it('marks only the pesukim of this reading that are not read yet', () => {
    expect(finishReadingKeys({ keys, read: [T, F, T, F] })).toEqual(['3:1', '3:3'])
    expect(finishReadingKeys({ keys, read: all(4, F) })).toEqual(keys)
    expect(finishReadingKeys({ keys, read: all(4, T) })).toEqual([])
  })

  it('the Undo un-marks exactly those keys, so pesukim read before the press stay read', () => {
    const changed = finishReadingKeys({ keys, read: [T, F, T, F] })
    expect(undoFinishWrites({ keys: changed, field: 'hebrew2' })).toEqual([
      { key: '3:1', field: 'hebrew2', value: false },
      { key: '3:3', field: 'hebrew2', value: false }
    ])
    expect(undoFinishWrites({ keys: [], field: 'targum' })).toEqual([])
  })
})

describe('readingEnd — what the end of the text offers', () => {
  it("'finish' while the reading on screen has unread pesukim", () => {
    expect(readingEnd({ phase: 1, readsByPhase: { 1: [T, F], 2: [F, F], 3: [F, F] } }))
      .toEqual({ state: 'finish', nextPhase: 1 })
  })

  it("'read' with the next reading that still has unread pesukim", () => {
    expect(readingEnd({ phase: 1, readsByPhase: { 1: [T, T], 2: [T, F], 3: [F, F] } }))
      .toEqual({ state: 'read', nextPhase: 2 })
    // out of order: the translation is done, the 1st reading is not
    expect(readingEnd({ phase: 3, readsByPhase: { 1: [F, T], 2: [T, T], 3: [T, T] } }))
      .toEqual({ state: 'read', nextPhase: 1 })
  })

  it("'aliyah-read' when every reading is read", () => {
    expect(readingEnd({ phase: 3, readsByPhase: { 1: [T], 2: [T], 3: [T] } }))
      .toEqual({ state: 'aliyah-read', nextPhase: 0 })
  })
})

describe('translationLayerFor / translationLayout', () => {
  it('uses the counted layer where the pasuk has it, Onkelos otherwise', () => {
    expect(translationLayerFor({ type: 'onkelos', hasRashi: true, hasEnglish: true })).toBe('onkelos')
    expect(translationLayerFor({ type: 'rashi', hasRashi: true, hasEnglish: false })).toBe('rashi')
    expect(translationLayerFor({ type: 'rashi', hasRashi: false, hasEnglish: true })).toBe('onkelos')
    expect(translationLayerFor({ type: 'english', hasRashi: false, hasEnglish: true })).toBe('english')
    expect(translationLayerFor({ type: 'english', hasRashi: true, hasEnglish: false })).toBe('onkelos')
  })

  it('Onkelos is one paragraph', () => {
    expect(translationLayout({ type: 'onkelos', layers: ['onkelos', 'onkelos'] })).toEqual({ layout: 'onkelos', note: false })
  })

  it('Rashi is per-pasuk blocks and English one paragraph, with per-pasuk Onkelos where missing', () => {
    expect(translationLayout({ type: 'rashi', layers: ['rashi', 'onkelos'] })).toEqual({ layout: 'rashi', note: false })
    expect(translationLayout({ type: 'english', layers: ['onkelos', 'english'] })).toEqual({ layout: 'english', note: false })
  })

  it('a layer missing from every pasuk (failed to load) becomes one Onkelos paragraph with one note', () => {
    expect(translationLayout({ type: 'english', layers: ['onkelos', 'onkelos'] })).toEqual({ layout: 'onkelos', note: true })
    expect(translationLayout({ type: 'rashi', layers: ['onkelos'] })).toEqual({ layout: 'onkelos', note: true })
  })
})

describe('anti-gating: returned shapes carry no gating words', () => {
  const FORBIDDEN = /hidden|hide|disabled|disable|locked|lock|visible|enabled|available|allowed|allow|block|gate/i
  it('no returned key uses a gating word', () => {
    const samples = [
      firstUnreadStep({ 1: [F], 2: [F], 3: [F] }),
      showReading({ phase: 1, read: [F] }),
      nextInReading({ index: 0, phase: 1, readsByPhase: { 1: [T], 2: [F], 3: [F] } }),
      stepInReading({ index: 0, delta: 1, phase: 1, maxIndex: 2 }),
      ...undoFinishWrites({ keys: ['0:0'], field: 'hebrew1' }),
      readingEnd({ phase: 1, readsByPhase: { 1: [F], 2: [F], 3: [F] } }),
      translationLayout({ type: 'rashi', layers: ['rashi'] })
    ]
    for (const s of samples) {
      for (const k of Object.keys(s)) expect(FORBIDDEN.test(k), `key ${k}`).toBe(false)
    }
  })
})
