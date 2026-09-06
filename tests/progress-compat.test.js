/**
 * Storage-contract guard for localStorage['shnayim-progress'].
 *
 * Shape: { [parshaRoute]: { "perekNum:pasukNum": { hebrew1, hebrew2, targum } } }
 * perekNum / pasukNum are 0-indexed integers. This file is the contract; any
 * change to it requires a migration and an explicit decision.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import parshiyot from '../src/data/parshiyot.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/progress-v1.json', import.meta.url), 'utf8'))

const KEY_RE = /^(\d+):(\d+)$/

describe('shnayim-progress storage contract', () => {
  it('top-level keys are parsha routes', () => {
    for (const route of Object.keys(fixture)) {
      expect(parshiyot[route], `unknown route ${route}`).toBeDefined()
    }
  })

  it('verse keys are "perek:pasuk", 0-indexed, and inside the parsha range', () => {
    for (const [route, verses] of Object.entries(fixture)) {
      const def = parshiyot[route]
      for (const key of Object.keys(verses)) {
        const m = KEY_RE.exec(key)
        expect(m, `bad key ${key}`).not.toBeNull()
        const perek = Number(m[1]), pasuk = Number(m[2])
        expect(perek).toBeGreaterThanOrEqual(def.start[0])
        expect(perek).toBeLessThanOrEqual(def.end[0])
        if (perek === def.start[0]) expect(pasuk).toBeGreaterThanOrEqual(def.start[1])
        if (perek === def.end[0]) expect(pasuk).toBeLessThanOrEqual(def.end[1])
      }
    }
  })

  it('bereshit 1:1 is stored under "0:0" (0-indexed)', () => {
    expect(fixture.bereshit['0:0']).toBeDefined()
    expect(fixture.bereshit['1:1']).toBeUndefined()
  })

  it('every verse record has exactly the three booleans', () => {
    for (const verses of Object.values(fixture)) {
      for (const rec of Object.values(verses)) {
        expect(Object.keys(rec).sort()).toEqual(['hebrew1', 'hebrew2', 'targum'])
        for (const v of Object.values(rec)) expect(typeof v).toBe('boolean')
      }
    }
  })

  it('round-trips through JSON unchanged (what useProgress does)', () => {
    expect(JSON.parse(JSON.stringify(fixture))).toEqual(fixture)
  })
})
