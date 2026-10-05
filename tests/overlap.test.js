/**
 * Which routes share verses (combined parshiyot and their singles), derived
 * purely from start/end in parshiyot.js.
 */
import { describe, it, expect } from 'vitest'
import parshiyot from '../src/data/parshiyot.js'
import { resolveParshaRoute } from '../src/composables/useParsha.js'
import {
  parseVerseKey,
  routeContains,
  rangeInside,
  overlappingRoutes,
  routesForVerse,
  overlapGroup,
  clearTargets,
  partialClearWrites,
  fillInWrites
} from '../src/lib/overlap.js'

const combined = Object.entries(parshiyot)
  .filter(([, def]) => Array.isArray(def.hebcalName))
  .map(([route, def]) => ({ route, singles: def.hebcalName.map(n => resolveParshaRoute([n])) }))

const key = (pos) => `${pos[0]}:${pos[1]}`

describe('overlap map', () => {
  it('there are exactly seven combined routes, each built from two known singles', () => {
    expect(combined.map(c => c.route).sort()).toEqual([
      'achrei-mot-kedoshim', 'behar-bechukotai', 'chukat-balak', 'matot-masei',
      'nitzavim-vayeilech', 'tazria-metzora', 'vayakhel-pekudei'
    ])
    for (const { route, singles } of combined) {
      expect(singles.every(Boolean), route).toBe(true)
      expect(singles.every(s => !Array.isArray(parshiyot[s].hebcalName)), route).toBe(true)
    }
  })

  for (const { route, singles } of combined) {
    it(`${route}: overlaps exactly its two singles, which tile its range`, () => {
      const [first, second] = singles
      expect(overlappingRoutes(route).sort()).toEqual([...singles].sort())
      expect(overlappingRoutes(first)).toEqual([route])
      expect(overlappingRoutes(second)).toEqual([route])
      expect(parshiyot[route].start).toEqual(parshiyot[first].start)
      expect(parshiyot[route].end).toEqual(parshiyot[second].end)
      expect(rangeInside(first, route)).toBe(true)
      expect(rangeInside(second, route)).toBe(true)
      expect(rangeInside(route, first)).toBe(false)
      expect(overlapGroup(route).sort()).toEqual([route, ...singles].sort())
      expect(overlapGroup(first).sort()).toEqual([route, ...singles].sort())

      // A verse of each single is written to that single and the combined route only.
      expect(routesForVerse(first, key(parshiyot[first].start))).toEqual([first, route])
      expect(routesForVerse(second, key(parshiyot[second].end))).toEqual([second, route])
      expect(routesForVerse(route, key(parshiyot[first].end))).toEqual([route, first])
      expect(routesForVerse(route, key(parshiyot[second].start))).toEqual([route, second])

      expect(clearTargets(route)).toEqual({ whole: [route, ...overlappingRoutes(route)], partial: [] })
      expect(clearTargets(first)).toEqual({ whole: [first], partial: [route] })
    })
  }

  it('no other route overlaps anything', () => {
    const involved = new Set(combined.flatMap(c => [c.route, ...c.singles]))
    for (const route of Object.keys(parshiyot)) {
      if (involved.has(route)) continue
      expect(overlappingRoutes(route), route).toEqual([])
      expect(overlapGroup(route)).toEqual([route])
      expect(routesForVerse(route, key(parshiyot[route].start))).toEqual([route])
    }
  })

  it('the same key in another chumash is not shared', () => {
    expect(routesForVerse('bereshit', '0:0')).toEqual(['bereshit'])
    expect(routesForVerse('shemot', '0:0')).toEqual(['shemot'])
    expect(routeContains('matot', '29:1')).toBe(true)
    expect(routeContains('pinchas', '29:1')).toBe(false)
  })

  it('a key outside the route still writes to the route itself', () => {
    expect(routesForVerse('matot', '0:0')).toEqual(['matot'])
    expect(parseVerseKey('bad')).toBeNull()
    expect(routeContains('matot', 'bad')).toBe(false)
  })
})

describe('fill-in and partial clears', () => {
  const T = { hebrew1: true, hebrew2: true, targum: true }
  const F = { hebrew1: false, hebrew2: false, targum: false }

  it('fillInWrites copies marks across overlapping routes and never un-marks', () => {
    const progress = {
      matot: { '29:1': { hebrew1: true, hebrew2: false, targum: false } },
      'matot-masei': { '32:0': T, '29:1': { hebrew1: false, hebrew2: true, targum: false } },
      bereshit: { '0:0': T }
    }
    const writes = fillInWrites(progress)
    expect(writes.sort()).toEqual([
      ['masei', '32:0', 'hebrew1'],
      ['masei', '32:0', 'hebrew2'],
      ['masei', '32:0', 'targum'],
      ['matot', '29:1', 'hebrew2'],
      ['matot-masei', '29:1', 'hebrew1']
    ].sort())
  })

  it('fillInWrites is empty once routes agree', () => {
    expect(fillInWrites({ matot: { '29:1': T }, 'matot-masei': { '29:1': T } })).toEqual([])
    expect(fillInWrites({})).toEqual([])
  })

  it('partialClearWrites clears only the single\'s verses inside the combined route', () => {
    const progress = {
      matot: { '29:1': T },
      'matot-masei': { '29:1': T, '29:2': F, '32:0': T }
    }
    expect(partialClearWrites(progress, 'matot').sort()).toEqual([
      ['matot-masei', '29:1', 'hebrew1'], ['matot-masei', '29:1', 'hebrew2'], ['matot-masei', '29:1', 'targum'],
      ['matot-masei', '29:2', 'hebrew1'], ['matot-masei', '29:2', 'hebrew2'], ['matot-masei', '29:2', 'targum']
    ].sort())
    expect(partialClearWrites(progress, 'matot-masei')).toEqual([])
    expect(partialClearWrites(progress, 'bereshit')).toEqual([])
  })
})
