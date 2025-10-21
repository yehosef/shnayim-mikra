import { ref, watch } from 'vue'

const defaults = {
  // Display settings
  order: 'pasuk',
  showRashi: false,
  showTrop: false,
  location: 'israel',
  fontSize: 20,
  fontRashi: true,
  disableMeforshim: false,
  targumType: 'onkelos', // onkelos | rashi | english
  showEnglish: false,
  aliyaByDay: false,

  // Reading approach settings (NEW)
  readingApproach: 'pasuk', // 'pasuk' (verse-by-verse) | 'aliyah' (aliyah-by-aliyah)
  dailyAliyahGuide: false, // Show "today's aliyah" helper
  animationSpeed: 'normal', // 'fast' (300ms) | 'normal' (500ms) | 'slow' (800ms)
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
