<template>
  <div dir="rtl" :style="{ fontSize: settings.fontSize + 'px' }">
    <ParshaDisplay v-if="currentParsha" :parasha="currentParsha" :week="week" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useParsha } from './composables/useParsha'
import { useSettings } from './composables/useSettings'
import { useProgress } from './composables/useProgress'
import { useAliyot } from './composables/useAliyot'
import { useNow } from './composables/useDailyGuide'
import { isRouteComplete } from './lib/progressMath'
import ParshaDisplay from './components/ParshaDisplay.vue'

const { getDefaultWeek } = useParsha()
const { settings } = useSettings()
const { progress } = useProgress()
const { aliyotData, getAliyot } = useAliyot()
const now = useNow()

// Empty until the hash / weekly parsha is resolved, so we never fetch a
// chumash we are not about to show.
const currentParsha = ref('')

// Completeness without loading the chumash: the aliyot entry carries the
// expected verse count (see progressMath.isRouteComplete). Before aliyot.json
// has loaded we simply cannot tell, and "unknown" must not pin the user to last
// week, so it counts as done; the watcher below re-resolves once it arrives.
const isRouteDone = (route) => {
  const entry = getAliyot(route)
  if (!entry) return true
  return isRouteComplete(progress.value[route] || {}, entry)
}

// Sunday through Tuesday this stays on last week's parsha while it is
// unfinished (so its 'late' status is reachable); otherwise it is the coming
// week. `now` ticks, so a tab left open across Shabbat rolls over.
const week = computed(() => {
  void now.value
  return getDefaultWeek(settings.value.location, isRouteDone)
})

const defaultRoute = () => week.value.route || 'bereshit'

// history.state marks a hash we wrote ourselves. A hash the user navigated to
// (bookmark, link, Back/Forward) carries no mark and is always respected.
const AUTO_HASH_KEY = 'shnayimAutoHash'

const isAutoHash = () => {
  const hash = window.location.hash.slice(1)
  if (!hash) return false
  try {
    return window.history.state?.[AUTO_HASH_KEY] === hash
  } catch (e) {
    return false
  }
}

/** Replace (never push) the hash, and remember that we chose it. */
const setAutoHash = (route) => {
  currentParsha.value = route
  if (window.location.hash.slice(1) === route && isAutoHash()) return
  try {
    const state = { ...(window.history.state || {}), [AUTO_HASH_KEY]: route }
    window.history.replaceState(state, '', `${window.location.pathname}${window.location.search}#${route}`)
  } catch (e) {
    window.location.hash = route
  }
}

// Handle routing
const updateParsha = () => {
  const hash = window.location.hash.slice(1) // Remove #
  if (!hash) {
    setAutoHash(defaultRoute())
    return
  }
  // Our own hash is re-resolved against the current default week, so a reload
  // or a reopened tab is never pinned to the week of the first visit.
  if (isAutoHash() && defaultRoute() !== hash) {
    setAutoHash(defaultRoute())
    return
  }
  currentParsha.value = hash
}

const reresolveAuto = () => {
  if (!isAutoHash()) return
  if (defaultRoute() !== window.location.hash.slice(1)) setAutoHash(defaultRoute())
}

// aliyot.json lands after the first resolution, which had to assume "done".
watch(aliyotData, (d) => { if (d) reresolveAuto() }, { once: true })
watch(() => settings.value.location, reresolveAuto)

// Roll an open tab over at the civil-day boundary only. Re-resolving on every
// progress change would yank the reader into the new parsha the instant they
// finish last week's.
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
let resolvedDay = dayKey(new Date())
watch(now, (t) => {
  const key = dayKey(t)
  if (key === resolvedDay) return
  resolvedDay = key
  reresolveAuto()
})

onMounted(() => {
  updateParsha()
  window.addEventListener('hashchange', updateParsha)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', updateParsha)
})
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}

@font-face {
  font-family: 'SBL Hebrew';
  src: url('/SBL_Hbrw.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Rashi';
  src: url('/Mekorot-Rashi.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

.font-sbl {
  font-family: 'SBL Hebrew', serif;
}
</style>
