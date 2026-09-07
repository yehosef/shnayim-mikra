/**
 * hashRoute: the URL fragment is user-supplied, so it is validated against the
 * parsha table before anything mounts. An unknown fragment used to be assigned
 * straight to currentParsha, which rendered a bare "פרשת " title and a
 * permanent "Parsha <x> not found" error that survived every reload.
 */
import { describe, it, expect } from 'vitest'
import { hashRoute } from '../src/lib/hashRoute.js'
import parshiyot from '../src/data/parshiyot.js'

describe('hashRoute', () => {
  it('resolves a real parsha, with or without the leading #', () => {
    expect(hashRoute('#bereshit', parshiyot)).toBe('bereshit')
    expect(hashRoute('bereshit', parshiyot)).toBe('bereshit')
    expect(hashRoute('#vzot-haberachah', parshiyot)).toBe('vzot-haberachah')
  })

  it('is null for an unknown, empty or malformed fragment', () => {
    expect(hashRoute('#not-a-parsha', parshiyot)).toBe(null)
    expect(hashRoute('#Bereshit', parshiyot)).toBe(null) // routes are lower-case
    expect(hashRoute('#', parshiyot)).toBe(null)
    expect(hashRoute('', parshiyot)).toBe(null)
    expect(hashRoute('#%E0%A4%A', parshiyot)).toBe(null) // bad escape, no throw
  })

  it('decodes a percent-encoded fragment', () => {
    expect(hashRoute("#chayei%2Dsara", parshiyot)).toBe("chayei-sara")
  })

  it('never returns an inherited Object property as a route', () => {
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(hashRoute(`#${key}`, parshiyot)).toBe(null)
    }
  })

  it('is null (never a throw) for a missing table or a non-string hash', () => {
    expect(hashRoute('#bereshit', null)).toBe(null)
    expect(hashRoute(undefined, parshiyot)).toBe(null)
    expect(hashRoute(42, parshiyot)).toBe(null)
  })
})
