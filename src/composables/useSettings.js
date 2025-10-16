import { ref, watch } from 'vue'

const defaults = {
  order: 'pasuk',
  showRashi: false,
  showTrop: false,
  location: 'israel',
  fontSize: 20,
  aliyaByDay: false,
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
