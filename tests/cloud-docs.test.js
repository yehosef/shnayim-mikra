/**
 * The pure half of the Firebase client (src/lib/cloudDocs.js): where a
 * parsha's cloud document lives, what a push writes, how downloaded documents
 * become syncStore's pull answer, and which sign-in method is tried first.
 * Firebase itself is not exercised here (see tests/rules/ for the rules).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FIREBASE_HOST,
  parshaDocPath,
  parshiyotPath,
  pushData,
  pullCutoff,
  toMillis,
  docsFromSnapshots,
  authDomainFor,
  isStandalone,
  signInOrder,
  shouldTryOtherMethod,
  isQuietSignInError
} from '../src/lib/cloudDocs.js'
import { showMovedNotice, OLD_HOST } from '../src/lib/movedNotice.js'
import { countPending } from '../src/lib/syncStore.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ts = (ms) => ({ toMillis: () => ms })

describe('cloud document mapping', () => {
  it('stores each parsha under users/{uid}/years/{year}/parshiyot/{route}', () => {
    expect(parshaDocPath('u1', 5787, 'noach')).toEqual(['users', 'u1', 'years', '5787', 'parshiyot', 'noach'])
    expect(parshiyotPath('u1', 5786)).toEqual(['users', 'u1', 'years', '5786', 'parshiyot'])
  })

  it('a push writes only the changed pieces plus the server stamp', () => {
    const stamp = Symbol('serverTimestamp')
    const patch = { '5:8': { hebrew1: true }, '5:9': { targum: false } }
    expect(pushData(patch, stamp)).toEqual({ verses: patch, updatedAt: stamp })
    expect(Object.keys(pushData(patch, stamp))).toEqual(['verses', 'updatedAt'])
    expect(pushData(null, stamp)).toEqual({ verses: {}, updatedAt: stamp })
  })

  it('a pull filters by server time only when there is a since', () => {
    expect(pullCutoff(null)).toBe(null)
    expect(pullCutoff(undefined)).toBe(null)
    expect(pullCutoff(NaN)).toBe(null)
    expect(pullCutoff(1_800_000_000_000)).toBe(1_800_000_000_000)
  })

  it('downloaded documents become { docs: { route: { verses, updatedAt millis } } }', () => {
    const out = docsFromSnapshots([
      { id: 'noach', data: { verses: { '5:8': { hebrew1: true } }, updatedAt: ts(1_800_000_100_000) } },
      { id: 'bereshit', data: { verses: 'garbage', updatedAt: ts(1_800_000_200_000) } },
      { id: 'lech-lecha', data: {} },
      { id: '', data: { verses: {} } }
    ])
    expect(out).toEqual({
      docs: {
        noach: { verses: { '5:8': { hebrew1: true } }, updatedAt: 1_800_000_100_000 },
        bereshit: { verses: {}, updatedAt: 1_800_000_200_000 },
        'lech-lecha': { verses: {}, updatedAt: null }
      }
    })
    expect(docsFromSnapshots([])).toEqual({ docs: {} })
    expect(toMillis(5)).toBe(5)
    expect(toMillis('5')).toBe(null)
  })
})

describe('sign-in method', () => {
  it('uses the Firebase Hosting address as auth domain only when served from it', () => {
    expect(authDomainFor(FIREBASE_HOST, 'x.firebaseapp.com')).toBe('shnayim.web.app')
    expect(authDomainFor('shnayim-mikra.vercel.app', 'x.firebaseapp.com')).toBe('x.firebaseapp.com')
    expect(authDomainFor('localhost', 'x.firebaseapp.com')).toBe('x.firebaseapp.com')
  })

  it('popup first, except the installed app on shnayim.web.app which redirects first', () => {
    expect(signInOrder({ preferRedirect: false, hostname: FIREBASE_HOST })).toEqual(['popup', 'redirect'])
    expect(signInOrder({ preferRedirect: true, hostname: FIREBASE_HOST })).toEqual(['redirect', 'popup'])
    expect(signInOrder({ preferRedirect: true, hostname: 'shnayim-mikra.vercel.app' })).toEqual(['popup', 'redirect'])
    expect(signInOrder({ preferRedirect: true, hostname: 'localhost' })).toEqual(['popup', 'redirect'])
  })

  it('falls back to the other method only when this one cannot work here', () => {
    expect(shouldTryOtherMethod('auth/popup-blocked')).toBe(true)
    expect(shouldTryOtherMethod('auth/operation-not-supported-in-this-environment')).toBe(true)
    expect(shouldTryOtherMethod('auth/web-storage-unsupported')).toBe(true)
    expect(shouldTryOtherMethod('auth/popup-closed-by-user')).toBe(false)
    expect(shouldTryOtherMethod('auth/unauthorized-domain')).toBe(false)
    expect(shouldTryOtherMethod(undefined)).toBe(false)
    expect(isQuietSignInError('auth/popup-closed-by-user')).toBe(true)
    expect(isQuietSignInError('auth/unauthorized-domain')).toBe(false)
  })

  it('detects the installed app from display-mode or navigator.standalone', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: true }) })).toBe(true)
    expect(isStandalone({ matchMedia: () => ({ matches: false }) })).toBe(false)
    expect(isStandalone({ navigator: { standalone: true }, matchMedia: () => ({ matches: false }) })).toBe(true)
    expect(isStandalone({ matchMedia: () => { throw new Error('no') } })).toBe(false)
    expect(isStandalone(undefined)).toBe(false)
  })
})

describe('Firebase stays out of the main bundle', () => {
  const files = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  }).filter((p) => /\.(js|vue)$/.test(p))

  it('only src/lib/firebaseClient.js imports firebase, and only by dynamic import', () => {
    const importers = []
    const staticClient = []
    for (const file of files(join(root, 'src'))) {
      const src = readFileSync(file, 'utf8')
      if (/from\s+['"]firebase\//.test(src) || /import\(\s*['"]firebase/.test(src)) importers.push(relative(root, file))
      if (/from\s+['"][^'"]*firebaseClient(\.js)?['"]/.test(src)) staticClient.push(relative(root, file))
    }
    expect(importers).toEqual(['src/lib/firebaseClient.js'])
    expect(staticClient).toEqual([])
  })
})

describe('moved notice', () => {
  it('shows only on the old address, until dismissed, while switched on', () => {
    expect(showMovedNotice(OLD_HOST, false)).toBe(true)
    expect(showMovedNotice(OLD_HOST, true)).toBe(false)
    expect(showMovedNotice('shnayim.web.app', false)).toBe(false)
    expect(showMovedNotice(OLD_HOST, false, false)).toBe(false)
  })
})

describe('countPending', () => {
  const T = { hebrew1: true, hebrew2: true, targum: true }
  const year = () => 5787
  it('counts pieces that differ from the base, single routes only', () => {
    const progress = { noach: { '5:8': T, '5:9': { hebrew1: false, hebrew2: false, targum: false } }, 'matot-masei': { '29:1': T } }
    expect(countPending(progress, {}, { noach: 5787 }, year)).toBe(3)
    const base = { noach: { year: 5787, verses: { '5:8': { hebrew1: true, hebrew2: true }, '5:9': { hebrew1: true } }, rev: 1 } }
    // targum of 5:8 is new; hebrew1 of 5:9 was un-marked.
    expect(countPending(progress, base, { noach: 5787 }, year)).toBe(2)
    expect(countPending({}, {}, {}, year)).toBe(0)
  })
  it('skips a route waiting for the yearly move', () => {
    expect(countPending({ noach: { '5:8': T } }, {}, { noach: 5786 }, year)).toBe(0)
  })
})
