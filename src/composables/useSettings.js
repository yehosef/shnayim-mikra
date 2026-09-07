import { ref, watch } from 'vue'
import { getItem, createPersister, onExternalWrite } from '../lib/storage'

const KEY = 'shnayim-settings'

const defaults = {
  // Interface settings
  interfaceLanguage: 'en', // 'en' | 'he'

  // Display settings
  displayMode: 'pasuk', // 'pasuk' (verse-by-verse) | 'parasha' (by paragraph) | 'aliyah' (one aliyah at a time)
  currentAliyah: 1, // Which aliyah to show when in aliyah mode (1-7)
  readingStyle: 'verse', // 'verse' (each pasuk twice + targum) | 'aliyah' (whole aliyah twice, then targum)
  showRashi: false,
  showTrop: false,
  location: 'israel',
  fontSize: 20,
  fontRashi: true,
  targumType: 'onkelos', // onkelos | rashi | english
  showEnglish: false,
}

function parseSettings(raw) {
  if (!raw) return { ...defaults }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...defaults }
    return { ...defaults, ...parsed }
  } catch (e) {
    console.warn('Could not parse saved settings, using defaults:', e)
    return { ...defaults }
  }
}

const settings = ref(parseSettings(getItem(KEY)))

const persister = createPersister(KEY, (raw) => {
  // Same cross-tab discipline as progress: fold in what is on disk so a write
  // never drops a key another tab added; this tab's values win on conflict.
  const merged = { ...parseSettings(raw), ...settings.value }
  const serialized = JSON.stringify(merged)
  if (serialized !== JSON.stringify(settings.value)) settings.value = merged
  return serialized
})

watch(settings, () => persister.schedule(), { deep: true })

onExternalWrite(KEY, (raw) => {
  const incoming = parseSettings(raw)
  const serialized = JSON.stringify(incoming)
  if (serialized === JSON.stringify(settings.value)) return
  persister.adopt(serialized)
  settings.value = incoming
})

export function useSettings() {
  return { settings }
}
