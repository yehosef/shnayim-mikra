/**
 * Shared credit between combined and single parshiyot inside useProgress, and
 * the cycle wiring in useCycles, over a fake localStorage. Same "tab" model as
 * progress-compat.test.js: a tab is a fresh module registry over one shared
 * store, with its own window/document listeners.
 */
import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest'

function makeStore(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) }
  }
}

async function openTab(store) {
  const listeners = {}
  const add = (type, fn) => { (listeners[type] ||= []).push(fn) }
  globalThis.localStorage = store
  globalThis.window = { addEventListener: add }
  globalThis.document = { addEventListener: add, visibilityState: 'visible', createElement: () => ({}) }
  vi.resetModules()
  const cycles = await import('../src/composables/useCycles.js')
  const progressMod = await import('../src/composables/useProgress.js')
  const vue = await import('vue')
  return {
    ...progressMod.useProgress(),
    ...cycles.useCycles(),
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

const T = { hebrew1: true, hebrew2: true, targum: true }
const F = { hebrew1: false, hebrew2: false, targum: false }

describe('write-through between combined and single parshiyot', () => {
  let store
  beforeEach(() => { store = makeStore() })
  const onDisk = () => JSON.parse(store.getItem('shnayim-progress') || '{}')

  it('a mark under a single lands in the combined route too, and so does an un-mark', async () => {
    const a = await openTab(store)
    a.setVerseProgress('matot', '29:1', 'hebrew1', true)
    await a.tick()
    a.fire('pagehide')
    expect(onDisk().matot['29:1'].hebrew1).toBe(true)
    expect(onDisk()['matot-masei']['29:1'].hebrew1).toBe(true)
    expect(onDisk().masei).toBeUndefined()

    a.setVerseProgress('matot', '29:1', 'hebrew1', false)
    await a.tick()
    a.fire('pagehide')
    expect(onDisk().matot['29:1'].hebrew1).toBe(false)
    expect(onDisk()['matot-masei']['29:1'].hebrew1).toBe(false)
  })

  it('a mark under the combined route lands in the single that contains the verse', async () => {
    const a = await openTab(store)
    a.setVerseProgress('matot-masei', '32:0', 'targum', true)
    expect(a.getVerseProgress('masei', '32:0').targum).toBe(true)
    expect(a.progress.value.matot).toBeUndefined()
    a.fire('pagehide')
    expect(onDisk().masei['32:0'].targum).toBe(true)
  })

  it('clearing a single clears its verses in the combined route and keeps the rest', async () => {
    const a = await openTab(store)
    for (const f of ['hebrew1', 'hebrew2', 'targum']) {
      a.setVerseProgress('matot', '29:1', f, true)
      a.setVerseProgress('masei', '32:0', f, true)
    }
    await a.tick()
    a.fire('pagehide')

    a.clearParshaProgress('matot')
    await a.tick()
    a.fire('pagehide')
    const disk = onDisk()
    expect(disk.matot).toBeUndefined()
    expect(disk['matot-masei']['29:1']).toEqual(F)
    expect(disk['matot-masei']['32:0']).toEqual(T)
    expect(disk.masei['32:0']).toEqual(T)
  })

  it('clearing the combined route clears both singles', async () => {
    const a = await openTab(store)
    a.setVerseProgress('matot', '29:1', 'hebrew1', true)
    a.setVerseProgress('masei', '32:0', 'hebrew1', true)
    a.setVerseProgress('bereshit', '0:0', 'hebrew1', true)
    a.fire('pagehide')

    a.clearParshaProgress('matot-masei')
    a.fire('pagehide')
    const disk = onDisk()
    expect(disk.matot).toBeUndefined()
    expect(disk.masei).toBeUndefined()
    expect(disk['matot-masei']).toBeUndefined()
    expect(disk.bereshit['0:0'].hebrew1).toBe(true)
  })
})

describe('cross-tab merge with write-through', () => {
  let store
  beforeEach(() => { store = makeStore() })
  const onDisk = () => JSON.parse(store.getItem('shnayim-progress') || '{}')

  it('two stale tabs marking different singles both reach the combined route', async () => {
    const a = await openTab(store)
    const b = await openTab(store)
    a.setVerseProgress('matot', '29:1', 'hebrew1', true)
    await a.tick()
    a.fire('pagehide')

    // b never saw a's write.
    b.setVerseProgress('matot-masei', '32:0', 'hebrew2', true)
    await b.tick()
    b.fire('pagehide')

    const disk = onDisk()
    expect(disk.matot['29:1'].hebrew1).toBe(true)
    expect(disk['matot-masei']['29:1'].hebrew1).toBe(true)
    expect(disk['matot-masei']['32:0'].hebrew2).toBe(true)
    expect(disk.masei['32:0'].hebrew2).toBe(true)
  })

  it('a stale tab does not resurrect verses another tab cleared through a single', async () => {
    const a = await openTab(store)
    for (const f of ['hebrew1', 'hebrew2', 'targum']) a.setVerseProgress('matot', '29:1', f, true)
    a.fire('pagehide')

    // b loads with the marks on disk; a goes cold holding them in memory.
    const b = await openTab(store)
    b.clearParshaProgress('matot')
    b.fire('pagehide')

    // a wakes up and marks a Masei verse; its stale matot copy was never dirtied.
    a.setVerseProgress('masei', '32:0', 'hebrew1', true)
    a.fire('pagehide')

    const disk = onDisk()
    expect(disk.matot).toBeUndefined()
    expect(disk['matot-masei']['29:1']).toEqual(F)
    expect(disk['matot-masei']['32:0'].hebrew1).toBe(true)
    expect(disk.masei['32:0'].hebrew1).toBe(true)
  })

  it('an unflushed partial clear survives another tab\'s write arriving', async () => {
    const a = await openTab(store)
    for (const f of ['hebrew1', 'hebrew2', 'targum']) a.setVerseProgress('matot', '29:1', f, true)
    a.fire('pagehide')

    const b = await openTab(store)
    b.clearParshaProgress('matot')
    await b.tick()

    a.setVerseProgress('masei', '32:0', 'targum', true)
    a.fire('pagehide')
    b.fire('storage', { key: 'shnayim-progress', newValue: store.getItem('shnayim-progress') })

    expect(b.getVerseProgress('matot', '29:1').hebrew1).toBe(false)
    expect(b.getVerseProgress('matot-masei', '29:1').hebrew1).toBe(false)
    expect(b.getVerseProgress('masei', '32:0').targum).toBe(true)

    b.fire('pagehide')
    const disk = onDisk()
    expect(disk.matot).toBeUndefined()
    expect(disk['matot-masei']['29:1']).toEqual(F)
    expect(disk['matot-masei']['32:0'].targum).toBe(true)
  })
})

describe('useCycles on real storage', () => {
  afterEach(() => { vi.useRealTimers() })

  const preRelease = () => makeStore({
    'shnayim-progress': JSON.stringify({
      bereshit: { '0:0': T },
      noach: { '5:8': T },
      matot: { '29:1': T }
    })
  })
  const read = (store, key) => JSON.parse(store.getItem(key) || 'null')

  it('first start: fill-in, labels, archive, notice; Undo brings the marks back for good', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 5, 12))
    const store = preRelease()
    const a = await openTab(store)
    a.checkCycles()

    expect(read(store, 'shnayim-migrations')).toEqual({ overlapFill: true, cycleLabels: true })
    expect(Object.keys(read(store, 'shnayim-progress'))).toEqual(['bereshit'])
    expect(read(store, 'shnayim-progress-archive')['matot-masei'][5786]).toEqual({ '29:1': T })
    expect(read(store, 'shnayim-cycles')).toEqual({ bereshit: 5787, noach: 5787, matot: 5787, 'matot-masei': 5787 })
    expect(a.cycleNotice.value.kind).toBe('rollover')
    expect(a.cycleNotice.value.entries).toHaveLength(3)

    expect(a.undoCycleNotice()).toBe(true)
    expect(a.cycleNotice.value).toBeNull()
    const restored = read(store, 'shnayim-progress')
    expect(restored.noach['5:8']).toEqual(T)
    expect(restored['matot-masei']['29:1']).toEqual(T)

    a.checkCycles()
    expect(a.cycleNotice.value).toBeNull()
    expect(read(store, 'shnayim-progress').noach['5:8']).toEqual(T)
  })

  it('a route\'s first mark is labelled with the current cycle, across its overlap group', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 5, 12))
    const store = makeStore({ 'shnayim-cycles': JSON.stringify({ masei: 5786 }) })
    const a = await openTab(store)
    a.checkCycles()
    a.setVerseProgress('masei', '32:0', 'hebrew1', true)
    expect(read(store, 'shnayim-cycles')).toEqual({ masei: 5787, 'matot-masei': 5787 })
  })

  it('start over archives, clears, and Undo restores', async () => {
    const store = makeStore()
    const a = await openTab(store)
    a.checkCycles()
    a.setVerseProgress('noach', '5:8', 'hebrew1', true)
    expect(a.canStartOver('noach')).toBe(true)
    expect(a.canStartOver('bo')).toBe(false)

    expect(a.startOver('noach')).toBe(true)
    expect(a.canStartOver('noach')).toBe(false)
    expect(read(store, 'shnayim-progress').noach).toBeUndefined()
    expect(a.cycleNotice.value.kind).toBe('startOver')

    a.undoCycleNotice()
    expect(a.getVerseProgress('noach', '5:8').hebrew1).toBe(true)
    expect(read(store, 'shnayim-progress').noach['5:8'].hebrew1).toBe(true)
  })
})
