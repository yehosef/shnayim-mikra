import { ref, watch } from 'vue'

const defaults = {
  // Interface settings
  interfaceLanguage: 'en', // 'en' | 'he'

  // Display settings
  displayMode: 'pasuk', // 'pasuk' (verse-by-verse) | 'parasha' (by paragraph) | 'aliyah' (one aliyah at a time)
  currentAliyah: 1, // Which aliyah to show when in aliyah mode (1-7)
  showRashi: false,
  showTrop: false,
  location: 'israel',
  fontSize: 20,
  fontRashi: true,
  disableMeforshim: false,
  targumType: 'onkelos', // onkelos | rashi | english
  showEnglish: false,
}

function loadSettings() {
  const stored = localStorage.getItem('shnayim-settings')
  if (!stored) return { ...defaults }
  try {
    return { ...defaults, ...JSON.parse(stored) }
  } catch (e) {
    console.warn('Could not parse saved settings, using defaults:', e)
    return { ...defaults }
  }
}

const settings = ref(loadSettings())

let settingsTimer = null
watch(settings, (val) => {
  clearTimeout(settingsTimer)
  settingsTimer = setTimeout(() => {
    localStorage.setItem('shnayim-settings', JSON.stringify(val))
    settingsTimer = null
  }, 300)
}, { deep: true })

window.addEventListener('beforeunload', () => {
  if (settingsTimer) {
    clearTimeout(settingsTimer)
    localStorage.setItem('shnayim-settings', JSON.stringify(settings.value))
  }
})

export function useSettings() {
  return { settings }
}
