import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

/**
 * Service-worker status for the settings panel. Registered once from main.js.
 *  - offlineReady: the precache (app shell + Torah/Targum/aliyot) is installed
 *  - needRefresh: a newer build is waiting; call updateApp() to activate it
 */
const offlineReady = ref(false)
const needRefresh = ref(false)
let updateFn = null

// A file that is always in the precache manifest. If it is in a cache, the
// precache ran at some point in a previous session too.
const PRECACHE_PROBE = '/data/aliyot.json'

/**
 * onOfflineReady only fires on the *first* install, so on every later visit it
 * never fires and the panel would report "caching in background" forever.
 * Probe the actual cache state instead; onOfflineReady stays as an extra
 * (earlier) signal for the very first install.
 */
async function probeOfflineReady() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    if (typeof caches === 'undefined') return
    await navigator.serviceWorker.ready
    const hit = await caches.match(PRECACHE_PROBE, { ignoreSearch: true })
    if (hit) offlineReady.value = true
  } catch (e) {
    console.warn('Offline readiness probe failed:', e)
  }
}

export function registerOffline() {
  updateFn = registerSW({
    immediate: true,
    onOfflineReady() { offlineReady.value = true },
    onNeedRefresh() { needRefresh.value = true },
    onRegisterError(e) { console.error('Service worker registration failed:', e) }
  })
  probeOfflineReady()
}

export function useOffline() {
  // registerType is 'prompt', so updateFn(true) sends skipWaiting and the
  // registerSW 'controlling' listener reloads the page.
  const updateApp = () => updateFn && updateFn(true)
  return { offlineReady, needRefresh, updateApp }
}
