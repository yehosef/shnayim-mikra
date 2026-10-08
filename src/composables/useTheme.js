import { ref, computed, watchEffect } from 'vue'
import { useSettings } from './useSettings'

/**
 * Light / dark theme. `settings.theme` is 'light' | 'dark' | 'auto'; the
 * resolved value is written to <html data-theme> (src/style.css keys the dark
 * colour tokens on it) and to the theme-color meta so the browser bar matches.
 * index.html runs the same rule before the app mounts, so there is no flash;
 * keep the two in step.
 */

/** Pure: the theme to show for a setting and the system preference. */
export function resolveTheme(setting, systemDark) {
  if (setting === 'dark' || setting === 'light') return setting
  return systemDark ? 'dark' : 'light'
}

const DARK_QUERY = '(prefers-color-scheme: dark)'
const systemDark = ref(false)
let started = false

function startSystemWatch() {
  if (started || typeof window === 'undefined' || !window.matchMedia) return
  started = true
  const mq = window.matchMedia(DARK_QUERY)
  systemDark.value = mq.matches
  const onChange = (e) => { systemDark.value = e.matches }
  if (mq.addEventListener) mq.addEventListener('change', onChange)
  else if (mq.addListener) mq.addListener(onChange)
}

export function useTheme() {
  const { settings } = useSettings()
  startSystemWatch()
  const theme = computed(() => resolveTheme(settings.value.theme, systemDark.value))
  return { theme }
}

/** Called once from App.vue: keeps <html data-theme> and the bar colour current. */
export function applyTheme() {
  const { theme } = useTheme()
  watchEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.dataset.theme = theme.value
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue('--c-bg').trim()
      if (bg) meta.setAttribute('content', bg)
    }
  })
  return { theme }
}
