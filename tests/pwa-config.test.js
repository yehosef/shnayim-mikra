import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pwaOptions } from '../vite.config.js'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// Minimal glob matcher covering the subset workbox globPatterns uses here:
// '**/' (any number of leading dirs), '*' (one path segment), '{a,b}' groups.
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:[^/]+/)*'
          i += 2
        } else {
          re += '.*'
          i += 1
        }
      } else {
        re += '[^/]*'
      }
    } else if (c === '{') {
      const end = glob.indexOf('}', i)
      re += '(?:' + glob.slice(i + 1, end).split(',').map(escapeRe).join('|') + ')'
      i = end
    } else {
      re += escapeRe(c)
    }
  }
  return new RegExp('^' + re + '$')
}

const precaches = (path) =>
  pwaOptions.workbox.globPatterns.some((p) => globToRegExp(p).test(path))

describe('PWA update strategy', () => {
  it('uses prompt-based updates', () => {
    // 'prompt' is what makes the SW wait so useOffline's needRefresh fires and
    // the Settings "Update available" button is reachable.
    expect(pwaOptions.registerType).toBe('prompt')
  })

  it('leaves skipWaiting off so a new build waits for the user', () => {
    expect(pwaOptions.workbox.skipWaiting).not.toBe(true)
  })

  it('claims the page on first activation', () => {
    // vite-plugin-pwa only sets clientsClaim itself for registerType
    // 'autoUpdate'. Without it, the whole first session is uncontrolled: the
    // Settings "Download Rashi + English" fetches skip the runtimeCaching rule
    // and cache nothing while the panel reports success.
    expect(pwaOptions.workbox.clientsClaim).toBe(true)
  })
})

describe('PWA precache manifest', () => {
  it('precaches every manifest icon, and the icon files exist', () => {
    const icons = pwaOptions.manifest.icons.map((i) => i.src)
    expect(icons.length).toBeGreaterThan(0)
    for (const src of icons) {
      const rel = src.replace(/^\//, '')
      expect(existsSync(join(publicDir, rel)), `${rel} missing from public/`).toBe(true)
      expect(precaches(rel), `${rel} not covered by globPatterns`).toBe(true)
    }
  })

  it('keeps the core corpus and app shell in the precache', () => {
    expect(precaches('index.html')).toBe(true)
    expect(precaches('assets/index-abc123.js')).toBe(true)
    expect(precaches('assets/index-abc123.css')).toBe(true)
    expect(precaches('SBL_Hbrw.ttf')).toBe(true)
    expect(precaches('favicon.ico')).toBe(true)
    expect(precaches('data/aliyot.json')).toBe(true)
    expect(precaches('data/torah/bereishit.json')).toBe(true)
    expect(precaches('data/targum/bereishit.json')).toBe(true)
  })

  it('leaves the optional layers and the unreferenced logos out of the precache', () => {
    // Rashi/English are runtime-cached on demand, not precached.
    expect(precaches('data/rashi/bereishit.json')).toBe(false)
    expect(precaches('data/english/bereishit.json')).toBe(false)
    // Nothing in src/ or index.html references these.
    expect(precaches('logo.png')).toBe(false)
    expect(precaches('logo.svg')).toBe(false)
  })
})

describe('PWA runtime caching', () => {
  it('routes the optional layers to the torah-data cache', () => {
    const route = pwaOptions.workbox.runtimeCaching.find(
      (r) => r.options?.cacheName === 'torah-data'
    )
    expect(route).toBeDefined()
    expect(route.handler).toBe('CacheFirst')
    // The URLs SettingsModal's download button fetches.
    expect(route.urlPattern.test('/data/rashi/bereishit.json')).toBe(true)
    expect(route.urlPattern.test('/data/english/dvarim.json')).toBe(true)
    expect(route.urlPattern.test('/data/torah/bereishit.json')).toBe(false)
  })
})
