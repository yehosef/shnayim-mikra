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

export function registerOffline() {
  updateFn = registerSW({
    immediate: true,
    onOfflineReady() { offlineReady.value = true },
    onNeedRefresh() { needRefresh.value = true },
    onRegisterError(e) { console.error('Service worker registration failed:', e) }
  })
}

export function useOffline() {
  const updateApp = () => updateFn && updateFn(true)
  return { offlineReady, needRefresh, updateApp }
}
