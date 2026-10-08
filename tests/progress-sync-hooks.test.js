/**
 * The two hooks useProgress offers the sync layer: applying cloud-won fields
 * (false included) through the write-through path, and replacing the whole
 * map on an account switch. Same "tab" model as progress-overlap.test.js: a
 * tab is a fresh module registry over one shared fake localStorage.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

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
  const mod = await import('../src/composables/useProgress.js')
  const vue = await import('vue')
  return {
    ...mod.useProgress(),
    applyProgressFields: mod.applyProgressFields,
    replaceProgress: mod.replaceProgress,
    flushProgress: mod.flushProgress,
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

describe('sync hooks in useProgress', () => {
  let store
  beforeEach(() => { store = makeStore() })
  const onDisk = () => JSON.parse(store.getItem('shnayim-progress') || '{}')

  it('applies cloud-won marks and un-marks through the write-through, stored at once', async () => {
    store.setItem('shnayim-progress', JSON.stringify({ matot: { '29:1': T }, 'matot-masei': { '29:1': T } }))
    const tab = await openTab(store)
    const ok = tab.applyProgressFields([
      ['matot', '29:1', 'hebrew2', false],
      ['matot', '29:2', 'hebrew1', true]
    ])
    expect(ok).toBe(true)
    const disk = onDisk()
    for (const route of ['matot', 'matot-masei']) {
      expect(disk[route]['29:1']).toEqual({ hebrew1: true, hebrew2: false, targum: true })
      expect(disk[route]['29:2'].hebrew1).toBe(true)
    }
  })

  it('a cloud-won un-mark is merged over another tab\'s newer map without dropping that map', async () => {
    store.setItem('shnayim-progress', JSON.stringify({ noach: { '5:8': T } }))
    const tab = await openTab(store)
    tab.setVerseProgress('noach', '5:9', 'hebrew1', true)
    // Another tab wrote a map this tab has not seen: old targum, one more verse.
    store.setItem('shnayim-progress', JSON.stringify({ noach: { '5:8': { ...T }, '6:0': T } }))
    expect(tab.applyProgressFields([['noach', '5:8', 'targum', false]])).toBe(true)
    const disk = onDisk()
    expect(disk.noach['5:8']).toEqual({ hebrew1: true, hebrew2: true, targum: false })
    expect(disk.noach['6:0']).toEqual(T)
    expect(disk.noach['5:9'].hebrew1).toBe(true)
  })

  it('replaces the whole map, dropping this tab\'s unflushed changes and clears', async () => {
    store.setItem('shnayim-progress', JSON.stringify({ noach: { '5:8': T }, bereshit: { '0:0': T } }))
    const tab = await openTab(store)
    tab.setVerseProgress('noach', '5:9', 'hebrew1', true)
    tab.clearParshaProgress('bereshit')
    expect(tab.replaceProgress({ lech_lecha_is_not_a_route: {}, vayera: { '17:0': T } })).toBe(true)
    expect(onDisk()).toEqual({ lech_lecha_is_not_a_route: {}, vayera: { '17:0': T } })
    expect(tab.progress.value).toEqual(onDisk())
    // The debounced write that was pending finds nothing to add.
    await tab.tick()
    tab.flushProgress()
    expect(onDisk()).toEqual({ lech_lecha_is_not_a_route: {}, vayera: { '17:0': T } })
    expect(tab.externalRevision.value).toBe(1)
  })

  it('another tab adopts a replaced map through the storage event', async () => {
    store.setItem('shnayim-progress', JSON.stringify({ noach: { '5:8': T } }))
    const other = await openTab(store)
    const switcher = await openTab(store)
    switcher.replaceProgress({ vayera: { '17:0': T } })
    other.fire('storage', { key: 'shnayim-progress', newValue: store.getItem('shnayim-progress') })
    expect(other.progress.value).toEqual({ vayera: { '17:0': T } })
  })
})
