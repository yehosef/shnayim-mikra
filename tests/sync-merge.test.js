/**
 * The pure half of sign-in sync (src/lib/syncMerge.js): which routes have
 * cloud documents, which year a route syncs into, the per-field three-way
 * merge, and the ownership decision. No storage, no network.
 */
import { describe, it, expect } from 'vitest'
import parshiyot from '../src/data/parshiyot.js'
import {
  FIELDS,
  isSingleRoute,
  singleRoutes,
  yearForRoute,
  baseVersesFor,
  mergeRoute,
  advanceBase,
  countFields,
  normalizeSync,
  planOwnership
} from '../src/lib/syncMerge.js'

const T = () => ({ hebrew1: true, hebrew2: true, targum: true })

describe('single routes', () => {
  it('are the 54 parshiyot with one hebcal name; combined routes have no cloud document', () => {
    const singles = singleRoutes()
    expect(singles).toHaveLength(54)
    for (const route of ['matot-masei', 'vayakhel-pekudei', 'nitzavim-vayeilech', 'tazria-metzora']) {
      expect(isSingleRoute(route)).toBe(false)
      expect(singles).not.toContain(route)
    }
    expect(isSingleRoute('matot')).toBe(true)
    expect(isSingleRoute('vzot-haberachah')).toBe(true)
    expect(isSingleRoute('no-such-route')).toBe(false)
    expect(Object.keys(parshiyot).length - singles.length).toBe(7)
  })
})

describe('year for a route', () => {
  const now = () => 5787
  it('a route with marks uses its label, a route without marks the current cycle', () => {
    expect(yearForRoute('noach', { noach: { '5:8': T() } }, { noach: 5787 }, now)).toBe(5787)
    expect(yearForRoute('noach', {}, { noach: 5786 }, now)).toBe(5787)
    expect(yearForRoute('noach', { noach: { '5:8': { hebrew1: false } } }, { noach: 5786 }, now)).toBe(5787)
    // Marks without a label (made before the cycle bookkeeping labelled them).
    expect(yearForRoute('noach', { noach: { '5:8': T() } }, {}, now)).toBe(5787)
  })

  it('a label older than the current cycle means the yearly move has not run: skip', () => {
    expect(yearForRoute('noach', { noach: { '5:8': T() } }, { noach: 5786 }, now)).toBe(null)
  })

  it('Vezot Haberachah keeps last year during its catch-up days', () => {
    const lag = (r) => (r === 'vzot-haberachah' ? 5786 : 5787)
    expect(yearForRoute('vzot-haberachah', { 'vzot-haberachah': { '32:0': T() } }, { 'vzot-haberachah': 5786 }, lag)).toBe(5786)
    expect(yearForRoute('bereshit', {}, {}, lag)).toBe(5787)
  })

  it('a base entry of another year counts as empty', () => {
    expect(baseVersesFor({ year: 5786, verses: { '5:8': { hebrew1: true } } }, 5787)).toEqual({})
    expect(baseVersesFor({ year: 5787, verses: { '5:8': { hebrew1: true } } }, 5787)).toEqual({ '5:8': { hebrew1: true } })
    expect(baseVersesFor(undefined, 5787)).toEqual({})
  })
})

describe('three-way merge of one field', () => {
  // [local, base, cloud] -> [apply value | null, upload value | null, base after]
  const table = [
    // l === b: take the cloud when it says something different.
    [false, false, undefined, null, null, false],
    [false, false, false, null, null, false],
    [false, false, true, true, null, true],
    [true, true, undefined, null, null, true],
    [true, true, true, null, null, true],
    [true, true, false, false, null, false],
    // l !== b: the reader changed it here; upload unless the cloud already agrees.
    [true, false, undefined, null, true, false],
    [true, false, false, null, true, false],
    [true, false, true, null, null, true],
    [false, true, undefined, null, false, true],
    [false, true, true, null, false, true],
    [false, true, false, null, null, false]
  ]
  for (const [l, b, c, applyValue, uploadValue, baseAfter] of table) {
    it(`local ${l}, base ${b}, cloud ${c}`, () => {
      const local = { '5:8': { hebrew1: l, hebrew2: false, targum: false } }
      const base = b ? { '5:8': { hebrew1: true } } : {}
      const cloud = c === undefined ? undefined : { '5:8': { hebrew1: c } }
      const out = mergeRoute(local, base, cloud)
      expect(out.apply).toEqual(applyValue === null ? [] : [['5:8', 'hebrew1', applyValue]])
      expect(out.patch).toEqual(uploadValue === null ? {} : { '5:8': { hebrew1: uploadValue } })
      expect(out.base['5:8']?.hebrew1 === true).toBe(baseAfter)
    })
  }

  it('an empty base gives local OR cloud on a first sign-in', () => {
    const out = mergeRoute(
      { '5:8': { hebrew1: true, hebrew2: false, targum: false } },
      {},
      { '5:8': { hebrew2: true }, '5:9': T() }
    )
    expect(out.apply).toEqual([['5:8', 'hebrew2', true], ['5:9', 'hebrew1', true], ['5:9', 'hebrew2', true], ['5:9', 'targum', true]])
    expect(out.patch).toEqual({ '5:8': { hebrew1: true } })
    // The uploaded field enters the base only once the upload is acknowledged.
    expect(out.base).toEqual({ '5:8': { hebrew2: true }, '5:9': T() })
  })

  it('a route absent locally with trues in the base uploads falses (start over)', () => {
    const out = mergeRoute(undefined, { '5:8': { hebrew1: true, targum: true } }, undefined)
    expect(out.patch).toEqual({ '5:8': { hebrew1: false, targum: false } })
    expect(out.apply).toEqual([])
  })

  it('ignores non-boolean cloud fields', () => {
    const out = mergeRoute({}, {}, { '5:8': { hebrew1: 'yes', hebrew2: 1, targum: null } })
    expect(out).toEqual({ apply: [], patch: {}, base: {} })
  })
})

describe('base bookkeeping', () => {
  it('advances by exactly the acknowledged patch, staying compact', () => {
    const base = { '5:8': { hebrew1: true, targum: true }, '5:9': { hebrew1: true } }
    const next = advanceBase(base, { '5:8': { targum: false, hebrew2: true }, '5:9': { hebrew1: false }, '6:0': { hebrew1: true } })
    expect(next).toEqual({ '5:8': { hebrew1: true, hebrew2: true }, '6:0': { hebrew1: true } })
    expect(base['5:9']).toEqual({ hebrew1: true }) // input untouched
    expect(advanceBase({}, { '5:8': { bogus: true } })).toEqual({})
  })

  it('counts fields in a patch', () => {
    expect(countFields({ '5:8': { hebrew1: true, targum: false }, '5:9': { hebrew2: true } })).toBe(3)
    expect(countFields({})).toBe(0)
    expect(FIELDS).toEqual(['hebrew1', 'hebrew2', 'targum'])
  })
})

describe('ownership', () => {
  it('normalises a missing or corrupt sync record', () => {
    expect(normalizeSync(undefined)).toEqual({ owner: null, lastPull: {} })
    expect(normalizeSync({ owner: '', lastPull: { 5787: 'x', 5786: 12 } })).toEqual({ owner: null, lastPull: { 5786: 12 } })
    expect(normalizeSync({ owner: null, switching: true })).toEqual({ owner: null, lastPull: {} })
  })

  it('adopt when never signed in, same for the owner, switch for anyone else', () => {
    expect(planOwnership({ owner: null }, 'alice')).toBe('adopt')
    expect(planOwnership({}, 'alice')).toBe('adopt')
    expect(planOwnership({ owner: 'alice' }, 'alice')).toBe('same')
    expect(planOwnership({ owner: 'alice' }, 'bob')).toBe('switch')
    // A half-done switch is finished whoever signs in, even the previous owner.
    expect(planOwnership({ owner: 'alice', switching: true }, 'alice')).toBe('switch')
  })
})
