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
  return stored ? { ...defaults, ...JSON.parse(stored) } : { ...defaults }
}

const settings = ref(loadSettings())

watch(settings, (val) => {
  localStorage.setItem('shnayim-settings', JSON.stringify(val))
}, { deep: true })

export function useSettings() {
  return { settings }
}
