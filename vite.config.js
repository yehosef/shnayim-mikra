import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Precache app shell (HTML, JS, CSS, fonts) plus the core corpus:
        // Torah + Targum + aliyot.json (~2.9MB) so a fresh install works
        // offline for the obligation itself. Rashi/English are optional and
        // runtime-cached on demand (or via the Settings download button).
        globPatterns: [
          '**/*.{js,css,html}',
          '*.{ttf,svg,png,ico}',
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
            src: '/logo.png',
            sizes: '300x300',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'node'
  }
})
