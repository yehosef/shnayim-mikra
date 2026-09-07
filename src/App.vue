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
import { hashRoute } from './lib/hashRoute'
import ParshaDisplay from './components/ParshaDisplay.vue'

const { getDefaultWeek, parshiyot } = useParsha()
const { settings } = useSettings()
const { progress } = useProgress()
const { aliyotData, getAliyot, retryAliyot } = useAliyot()
const now = useNow()

// Empty until the hash / weekly parsha is resolved, so we never fetch a
// chumash we are not about to show.
const currentParsha = ref('')

// Completeness without loading the chumash: the aliyot entry carries the
// expected verse count (see progressMath.isRouteComplete). Before aliyot.json
// has loaded we simply cannot tell, and "unknown" must not pin the user to last
// week, so it counts as done; the first resolution waits for it (see onMounted).
const isRouteDone = (route) => {
  const entry = getAliyot(route)
  if (!entry) return true
  return isRouteComplete(progress.value[route] || {}, entry)
}

// Sunday through Tuesday this stays on last week's parsha while it is
// unfinished (so its 'late' status is reachable); otherwise it is the coming
// week. `now` ticks, so a tab left open across Shabbat can roll over.
const week = computed(() => {
  void now.value
  return getDefaultWeek(settings.value.location, isRouteDone)
})

const defaultRoute = () => week.value.route || 'bereshit'

/**
 * Routing contract
 *
 *  - NO fragment means "whichever parsha the app picks for me", and the
 *    default week never writes one. Writing it (as this app used to) put the
 *    resolved route into every bookmark, autocomplete entry and copied link of
 *    the app's own URL, and reopening any of those pinned the reader to the
 *    week of that first visit — the history.state marker that told our own
 *    hash apart from the user's is null on any fresh navigation.
 *  - A fragment is an explicit choice (the parsha dropdown, the "coming week"
 *    link, a shared link) and is honoured for as long as it is on screen. An
 *    unknown one self-heals to the default instead of rendering an error page
 *    under an empty title.
 *  - Nothing here rewrites history while routing, so Back/Forward behave
 *    normally; the only rewrite is dropping a fragment that names no parsha.
 */
const routeFromHash = () => hashRoute(window.location.hash, parshiyot)

/** Drop a fragment that names no parsha (replaceState fires no hashchange). */
const clearHash = () => {
  try {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`
    )
  } catch (e) {
    // The fragment is cosmetic here; the resolved parsha below is what matters.
  }
}

const applyRoute = () => {
  const route = routeFromHash()
  if (route) {
    currentParsha.value = route
    return
  }
  if (window.location.hash) clearHash()
  currentParsha.value = defaultRoute()
}

/** Re-pick the default week. A parsha the user chose is never overridden. */
const reresolveDefault = () => {
  if (routeFromHash()) return
  currentParsha.value = defaultRoute()
}

// A late aliyot.json (a retry after a failed first fetch) changes the answer of
// isRouteDone, so the default week is worth re-asking once.
watch(aliyotData, (d) => { if (d) reresolveDefault() }, { once: true })
watch(() => settings.value.location, reresolveDefault)

// Roll an open tab over at the civil-day boundary — but never under an active
// reader. Changing the parsha closes focus mode and empties the verse list
// (see ParshaDisplay's parasha watcher), so a Tuesday-night reader finishing
// last week's parsha would be thrown out of it at midnight. Hold the rollover
// until the tab is hidden, which is exactly the "left open across Shabbat"
// case it exists for. Progress changes never re-resolve either, for the same
// reason: finishing last week must not yank you into the next one.
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
let resolvedDay = dayKey(new Date())
let pendingRollover = false

const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

const rollOver = () => {
  if (!isHidden()) {
    pendingRollover = true
    return
  }
  pendingRollover = false
  reresolveDefault()
}

const onVisibilityChange = () => { if (pendingRollover) rollOver() }

watch(now, (t) => {
  const key = dayKey(t)
  if (key === resolvedDay) return
  resolvedDay = key
  rollOver()
})

// The default week needs aliyot.json (isRouteDone) to choose between last week
// and the coming one, and that fetch is still in flight at mount. Resolving
// without it always assumed "done", so every Sunday-Tuesday visit rendered the
// coming parsha, started its chumash fetch, and flipped back a moment later.
// Wait for the data, with a short cap so a slow or failed fetch still renders.
const FIRST_RESOLVE_MS = 1500
let firstResolveTimer = null

const resolveFirst = () => {
  if (firstResolveTimer) {
    clearTimeout(firstResolveTimer)
    firstResolveTimer = null
  }
  if (currentParsha.value) return
  applyRoute()
}

onMounted(() => {
  window.addEventListener('hashchange', applyRoute)
  document.addEventListener('visibilitychange', onVisibilityChange)
  // A parsha the user asked for needs no data, and neither does an already
  // loaded aliyot.json.
  if (routeFromHash() || aliyotData.value) {
    applyRoute()
    return
  }
  firstResolveTimer = setTimeout(resolveFirst, FIRST_RESOLVE_MS)
  retryAliyot().then(resolveFirst, resolveFirst)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', applyRoute)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (firstResolveTimer) clearTimeout(firstResolveTimer)
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
