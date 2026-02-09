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
        // Precache app shell: HTML, JS, CSS, and fonts
        globPatterns: [
          '**/*.{js,css,html}',
          '*.{ttf,svg,png,ico}'
        ],
        // Runtime caching for JSON data files
        runtimeCaching: [
          {
            // Cache Torah, Targum, Rashi, English, and meforshim JSON data
            urlPattern: /\/data\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'torah-data',
              expiration: {
                maxEntries: 200,
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
})
