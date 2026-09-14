/**
 * Contract guard for src/composables/useData.js loadParsha().
 *
 * loadParsha() is where perekNum/pasukNum are stamped onto each verse, and
 * those numbers become the "perek:pasuk" keys stored in
 * localStorage['shnayim-progress'] (see tests/progress-compat.test.js). An
 * off-by-one here would silently mis-credit an entire parsha, so this file
 * checks the loaded verse stream against public/data/ (the real, generated
 * files — not fixtures) rather than mocking the data layer away.
 *
 * globalThis.fetch is stubbed to serve public/data/*.json by URL path; each
 * real file is read from disk once (module scope) and reused across every
 * stub response to keep the suite fast.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import parshiyot from '../src/data/parshiyot.js'
import { useData } from '../src/composables/useData.js'

const BOOKS = ['bereishit', 'shmot', 'vayikra', 'bamidbar', 'dvarim']
const LAYERS = ['torah', 'targum', 'english', 'rashi']

// Read every real data file once; the fetch stub below serves these by URL.
const files = {}
for (const layer of LAYERS) {
  files[layer] = {}
  for (const book of BOOKS) {
    files[layer][book] = JSON.parse(
      readFileSync(new URL(`../public/data/${layer}/${book}.json`, import.meta.url), 'utf8')
    )
  }
}
const aliyot = JSON.parse(readFileSync(new URL('../public/data/aliyot.json', import.meta.url), 'utf8'))

function jsonRes(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body
  }
}

function notFoundRes() {
  return {
    ok: false,
    status: 404,
    headers: { get: () => 'application/json' },
    json: async () => { throw new Error('no body') }
  }
}

// Vercel's SPA fallback: an unmatched path 200s with index.html instead of
// 404ing. useData's fetchJson() guards against this by checking content-type,
// not just `ok` — this response exercises that guard.
function htmlFallbackRes() {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/html' },
    json: async () => { throw new Error('unexpected: parsed html as json') }
  }
}

/**
 * @param {{unavailable?: string[], html?: string[], onCall?: (layer:string, book:string)=>void}} opts
 *   unavailable: layers that 404 (simulates an optional layer never fetched to the device)
 *   html: layers that get the Vercel SPA-fallback 200 html response
 *   onCall: invoked with (layer, book) on every request, for counting fetches
 */
function makeFetchStub(opts = {}) {
  const { unavailable = [], html = [], onCall } = opts
  return async (url) => {
    const m = /^\/data\/(torah|targum|english|rashi)\/([a-z]+)\.json$/.exec(url)
    if (!m) throw new Error(`useData fetched an unexpected url: ${url}`)
    const [, layer, book] = m
    onCall?.(layer, book)
    if (html.includes(layer)) return htmlFallbackRes()
    if (unavailable.includes(layer)) return notFoundRes()
    return jsonRes(files[layer][book])
  }
}

const originalFetch = globalThis.fetch
const routes = Object.keys(parshiyot)

describe('useData().loadParsha — progress-key & verse-count contract', () => {
  beforeAll(() => {
    globalThis.fetch = makeFetchStub()
  })
  afterEach(() => {
    globalThis.fetch = makeFetchStub()
  })

  it('parshiyot.js has all 61 routes', () => {
    expect(routes.length).toBe(61)
  })

  it('for every route: first/last verse keys match def.start/end, verse count matches aliyot.json, torah+targum non-empty', async () => {
    for (const route of routes) {
      const def = parshiyot[route]
      const { loadParsha, error } = useData()
      const verses = await loadParsha(route)

      expect(error.value, `${route} load error`).toBe(null)
      expect(verses.length, `${route} produced no verses`).toBeGreaterThan(0)

      // parshiyot.js start/end are already 0-indexed [perek, pasuk] pairs —
      // the same representation as the "perek:pasuk" progress-storage key
      // (see tests/progress-compat.test.js: bereshit 1:1 -> "0:0"). No
      // conversion is needed; perekNum/pasukNum on the first/last loaded
      // verse must equal def.start/def.end directly.
      const first = verses[0]
      const last = verses[verses.length - 1]
      expect([first.perekNum, first.pasukNum], `${route} first verse vs def.start`).toEqual(def.start)
      expect([last.perekNum, last.pasukNum], `${route} last verse vs def.end`).toEqual(def.end)

      const entry = aliyot[route]
      const expectedCount = entry.aliyot.reduce((s, a) => s + a.verseCount, 0)
      expect(verses.length, `${route} verse count vs sum(aliyot verseCount)`).toBe(expectedCount)

      for (const v of verses) {
        expect(v.torah, `${route} ${v.perekNum}:${v.pasukNum} torah empty`).toBeTruthy()
        expect(v.targum, `${route} ${v.perekNum}:${v.pasukNum} targum empty`).toBeTruthy()
      }
    }
  })
})

describe('content-type guard rejects the Vercel SPA html fallback', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('a 200 text/html response for a required layer (torah) is not parsed as data', async () => {
    // Fresh module instance so the module-level chumashCache (shared with the
    // describe block above) can't mask a missed fetch with cached real data.
    vi.resetModules()
    globalThis.fetch = makeFetchStub({ html: ['torah'] })
    const { useData: freshUseData } = await import('../src/composables/useData.js')
    const { loadParsha, error, data } = freshUseData()

    const verses = await loadParsha('bereshit')

    expect(verses).toEqual([])
    expect(error.value).toBeTruthy()
    expect(data.value).toEqual([])
  })
})

describe('Rashi layer gating (needRashi = showRashi || targumType === "rashi")', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('targumType "rashi" (showRashi off): rashi is fetched and attached to a verse that has it', async () => {
    vi.resetModules()
    let rashiCalls = 0
    globalThis.fetch = makeFetchStub({ onCall: (layer) => { if (layer === 'rashi') rashiCalls++ } })
    const { useData: freshUseData } = await import('../src/composables/useData.js')
    const { loadParsha } = freshUseData()

    const verses = await loadParsha('bereshit', { targumType: 'rashi', showRashi: false })

    expect(rashiCalls, 'rashi layer should have been fetched').toBe(1)
    // Genesis 1:1 has Rashi in the real data.
    expect(verses[0].rashi).toBeDefined()
  })

  it('targumType "onkelos" (showRashi off): rashi is never fetched', async () => {
    vi.resetModules()
    let rashiCalls = 0
    globalThis.fetch = makeFetchStub({ onCall: (layer) => { if (layer === 'rashi') rashiCalls++ } })
    const { useData: freshUseData } = await import('../src/composables/useData.js')
    const { loadParsha } = freshUseData()

    const verses = await loadParsha('bereshit', { targumType: 'onkelos', showRashi: false })

    expect(rashiCalls, 'rashi layer should not have been fetched').toBe(0)
    expect(verses[0].rashi).toBeUndefined()
  })
})

describe('optional layers (english, rashi) missing does not fail the load', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('english and rashi both 404: parsha still loads with required layers intact', async () => {
    vi.resetModules()
    globalThis.fetch = makeFetchStub({ unavailable: ['english', 'rashi'] })
    const { useData: freshUseData } = await import('../src/composables/useData.js')
    const { loadParsha, error } = freshUseData()

    const verses = await loadParsha('bereshit', { targumType: 'rashi', showRashi: false })

    expect(error.value).toBe(null)
    expect(verses.length).toBeGreaterThan(0)
    expect(verses[0].torah).toBeTruthy()
    expect(verses[0].targum).toBeTruthy()
    expect(verses[0].english).toBe('')
    expect(verses[0].rashi).toBeUndefined()
  })
})
