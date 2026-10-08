import { ref, watch } from 'vue'
import { getItem, createPersister, onExternalWrite, onVisible } from '../lib/storage'
import { parseSettings } from '../lib/settingsDefaults'

const KEY = 'shnayim-settings'

const settings = ref(parseSettings(getItem(KEY)))

// What this tab last saw on disk. Any key whose live value differs from it is a
// change made here and not yet written; only those keys are laid over another
// tab's map, so neither side's settings are clobbered wholesale.
let baseline = { ...settings.value }

function mergeSettings(disk) {
  const merged = { ...disk }
  for (const key of Object.keys(settings.value)) {
    if (!Object.is(settings.value[key], baseline[key])) merged[key] = settings.value[key]
  }
  return merged
}

const persister = createPersister(KEY, (raw) => {
  // Same cross-tab discipline as progress: fold in what is on disk so a write
  // never drops a key another tab set; only keys changed here win on conflict.
  const merged = mergeSettings(parseSettings(raw))
  const serialized = JSON.stringify(merged)
  if (serialized !== JSON.stringify(settings.value)) settings.value = merged
  baseline = { ...merged }
  return serialized
})

watch(settings, () => persister.schedule(), { deep: true })

// Another tab wrote, or this tab came back from the bfcache / a frozen
// background: take its values for every key this tab has not changed since its
// own last write, and keep the ones it has (the watcher re-schedules them).
function adoptExternal(raw) {
  const incoming = parseSettings(raw)
  const merged = mergeSettings(incoming)
  baseline = { ...incoming }
  if (JSON.stringify(merged) === JSON.stringify(settings.value)) return
  settings.value = merged
}

onExternalWrite(KEY, adoptExternal)
onVisible(() => adoptExternal(getItem(KEY)))

export function useSettings() {
  return { settings }
}
