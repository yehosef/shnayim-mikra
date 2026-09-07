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

/**
 * Two open tabs must not clobber each other. useProgress is a module-level
 * singleton, so a second "tab" is a second module instance (vi.resetModules)
 * over one shared fake localStorage. Node env: window/document are stubbed the
 * same minimal way the rest of this file avoids needing a DOM.
 */
import { beforeEach, afterAll, vi } from 'vitest'

function makeStore(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) }
  }
}

// A "tab": its own window/document (so its listeners can be fired on their
// own) and its own module registry, over the shared store.
async function openTab(store, modulePath = '../src/composables/useProgress.js') {
  const listeners = {}
  const add = (type, fn) => { (listeners[type] ||= []).push(fn) }
  globalThis.localStorage = store
  globalThis.window = { addEventListener: add }
  // createElement: vue's runtime-dom touches it at module init once `document`
  // exists; nothing here renders, so a stub object is enough.
  globalThis.document = { addEventListener: add, visibilityState: 'visible', createElement: () => ({}) }
  vi.resetModules()
  const mod = await import(modulePath)
  const vue = await import('vue')
  return {
    ...(mod.useProgress ? mod.useProgress() : mod.useSettings()),
    fire: (type, event) => (listeners[type] || []).forEach(fn => fn(event)),
    tick: () => vue.nextTick()
  }
}

const savedGlobals = {
  localStorage: globalThis.localStorage,
  window: globalThis.window,
  document: globalThis.document
}
afterAll(() => {
  globalThis.localStorage = savedGlobals.localStorage
  globalThis.window = savedGlobals.window
  globalThis.document = savedGlobals.document
  vi.resetModules()
})

describe('two-tab progress merge', () => {
  let store
  beforeEach(() => { store = makeStore() })

  const onDisk = () => JSON.parse(store.getItem('shnayim-progress') || '{}')

  it('a stale tab writing does not discard the other tab\'s verses', async () => {
    // Both tabs load while storage is empty — B is stale from here on.
    const a = await openTab(store)
    const b = await openTab(store)

    a.setVerseProgress('bereshit', '0:0', 'hebrew1', true)
    await a.tick()
    a.fire('pagehide')
    expect(onDisk().bereshit['0:0'].hebrew1).toBe(true)

    b.setVerseProgress('noach', '5:9', 'targum', true)
    await b.tick()
    b.fire('pagehide')

    const disk = onDisk()
    expect(disk.bereshit['0:0'].hebrew1).toBe(true)
    expect(disk.noach['5:9'].targum).toBe(true)
    // shape unchanged
    for (const verses of Object.values(disk)) {
      for (const rec of Object.values(verses)) {
        expect(Object.keys(rec).sort()).toEqual(['hebrew1', 'hebrew2', 'targum'])
      }
    }
  })

  it('keeps the other tab\'s other verses in a parsha this tab also wrote', async () => {
    const a = await openTab(store)
    const b = await openTab(store)

    a.setVerseProgress('bereshit', '0:0', 'hebrew1', true)
    a.setVerseProgress('bereshit', '0:1', 'hebrew1', true)
    await a.tick()
    a.fire('pagehide')

    // Same parsha, different verse, from a tab that never saw a's marks.
    b.setVerseProgress('bereshit', '0:2', 'hebrew1', true)
    // ...and a verse both tabs hold: the writing tab's record wins whole.
    b.setVerseProgress('bereshit', '0:0', 'targum', true)
    await b.tick()
    b.fire('pagehide')

    const bereshit = onDisk().bereshit
    expect(Object.keys(bereshit).sort()).toEqual(['0:0', '0:1', '0:2'])
    expect(bereshit['0:1'].hebrew1).toBe(true)
    expect(bereshit['0:2'].hebrew1).toBe(true)
    expect(bereshit['0:0']).toEqual({ hebrew1: false, hebrew2: false, targum: true })
  })

  it('clearing a parsha is not resurrected by the merge', async () => {
    const a = await openTab(store)
    a.setVerseProgress('bereshit', '0:0', 'hebrew1', true)
    a.setVerseProgress('noach', '5:9', 'targum', true)
    await a.tick()
    a.fire('pagehide')

    a.clearParshaProgress('bereshit')
    await a.tick()
    a.fire('pagehide')

    const disk = onDisk()
    expect(disk.bereshit).toBeUndefined()
    expect(disk.noach['5:9'].targum).toBe(true)
  })

  it('a storage event makes a tab adopt the other tab\'s map without echoing it back', async () => {
    const a = await openTab(store)
    const b = await openTab(store)

    b.setVerseProgress('noach', '5:9', 'targum', true)
    await b.tick()
    b.fire('pagehide')

    a.fire('storage', { key: 'shnayim-progress', newValue: store.getItem('shnayim-progress') })
    expect(a.getVerseProgress('noach', '5:9').targum).toBe(true)

    // a's own next write is now built on the fresh state
    a.setVerseProgress('bereshit', '0:0', 'hebrew1', true)
    await a.tick()
    a.fire('pagehide')
    const disk = onDisk()
    expect(disk.noach['5:9'].targum).toBe(true)
    expect(disk.bereshit['0:0'].hebrew1).toBe(true)
  })

  it('flushes on visibilitychange === hidden as well as pagehide', async () => {
    const a = await openTab(store)
    a.setVerseProgress('bereshit', '0:0', 'hebrew1', true)
    await a.tick()
    globalThis.document.visibilityState = 'hidden'
    a.fire('visibilitychange')
    expect(onDisk().bereshit['0:0'].hebrew1).toBe(true)
  })

  it('mounts and keeps working when localStorage access throws', async () => {
    const blocked = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') }
    }
    const a = await openTab(blocked)
    expect(a.getVerseProgress('bereshit', '0:0').hebrew1).toBe(false)
    a.setVerseProgress('bereshit', '0:0', 'hebrew1', true)
    await a.tick()
    a.fire('pagehide')
    expect(a.getVerseProgress('bereshit', '0:0').hebrew1).toBe(true)
  })
})

describe('two-tab settings sync', () => {
  const SETTINGS = '../src/composables/useSettings.js'

  it('adopts another tab\'s settings from a storage event and keeps writing them', async () => {
    const store = makeStore()
    const a = await openTab(store, SETTINGS)
    const b = await openTab(store, SETTINGS)

    b.settings.value.fontSize = 28
    await b.tick()
    b.fire('pagehide')

    a.fire('storage', { key: 'shnayim-settings', newValue: store.getItem('shnayim-settings') })
    expect(a.settings.value.fontSize).toBe(28)

    a.settings.value.showRashi = true
    await a.tick()
    a.fire('pagehide')

    const disk = JSON.parse(store.getItem('shnayim-settings'))
    expect(disk.fontSize).toBe(28)
    expect(disk.showRashi).toBe(true)
  })

  it('falls back to defaults when localStorage throws', async () => {
    const blocked = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') }
    }
    const a = await openTab(blocked, SETTINGS)
    expect(a.settings.value.targumType).toBe('onkelos')
    a.settings.value.targumType = 'rashi'
    await a.tick()
    a.fire('pagehide')
    expect(a.settings.value.targumType).toBe('rashi')
  })
})
