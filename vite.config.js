import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// The VitePWA options live in a named export so tests/pwa-config.test.js can
// assert the caching contract (clientsClaim, precache globs) without a build.
// https://vite.dev/config/
export const pwaOptions = {
  // 'prompt': the SW waits and useOffline's needRefresh/updateApp drive the
  // Settings "Update available" button, instead of reloading mid-session.
  registerType: 'prompt',
  workbox: {
    // vite-plugin-pwa only forces skipWaiting/clientsClaim for registerType
    // 'autoUpdate'. Under 'prompt' both default to false, and an unclaimed SW
    // means the whole first session runs with no fetch handler: the Settings
    // "Download Rashi + English" fetches would bypass the runtimeCaching rule
    // below and cache nothing while reporting success. Claim the page as soon
    // as the SW activates; skipWaiting stays false so a *new* build still
    // waits for the user to press "Update available".
    clientsClaim: true,
    // Precache app shell (HTML, JS, CSS, fonts) plus the core corpus:
    // Torah + Targum + aliyot.json (~2.9MB) so a fresh install works
    // offline for the obligation itself. Rashi/English are optional and
    // runtime-cached on demand (or via the Settings download button).
    // 'icon-*.png' covers the manifest/install icons only — the unreferenced
    // public/logo.* files stay out of the payload.
    globPatterns: [
      '**/*.{js,css,html}',
      '*.{ttf,ico}',
      'icon-*.png',
      'data/aliyot.json',
      'data/torah/*.json',
      'data/targum/*.json'
    ],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    cleanupOutdatedCaches: true,
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/data\//],
    runtimeCaching: [
      {
        urlPattern: /\/data\/(english|rashi)\/.*\.json$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'torah-data',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      }
    ]
  },
  manifest: {
    name: '\u05E9\u05E0\u05D9\u05D9\u05DD \u05DE\u05E7\u05E8\u05D0 \u05D5\u05D0\u05D7\u05D3 \u05EA\u05E8\u05D2\u05D5\u05DD',
    short_name: '\u05E9\u05E0\u05D9\u05D9\u05DD \u05DE\u05E7\u05E8\u05D0',
    description: '\u05E9\u05E0\u05D9\u05D9\u05DD \u05DE\u05E7\u05E8\u05D0 \u05D5\u05D0\u05D7\u05D3 \u05EA\u05E8\u05D2\u05D5\u05DD',
    theme_color: '#1a1a2e',
    background_color: '#1a1a2e',
    display: 'standalone',
    orientation: 'any',
    start_url: '/',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  }
}

export default defineConfig({
  plugins: [
    vue(),
    VitePWA(pwaOptions)
  ],
  test: {
    environment: 'node'
  }
})
