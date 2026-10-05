<template>
  <div dir="rtl" :style="{ fontSize: settings.fontSize + 'px' }">
    <!-- First run: which schedule to follow. Inline, never blocking — the
         parsha below renders and works whether or not this is answered. -->
    <div v-if="!settings.locationChosen" class="app-notice" role="group" :dir="isHebrew ? 'rtl' : 'ltr'">
      <span>{{ isHebrew ? 'באיזה לוח קריאה להשתמש?' : 'Which reading schedule do you follow?' }}</span>
      <button type="button" class="btn" @click="chooseLocation('israel')">{{ isHebrew ? 'ישראל' : 'Israel' }}</button>
      <button type="button" class="btn" @click="chooseLocation('chul')">{{ isHebrew ? 'חו"ל' : 'Diaspora' }}</button>
    </div>
    <!-- After a new cycle moved last year's marks aside, or after "start this
         parsha over": say so and offer Undo. -->
    <div v-if="cycleNotice" class="app-notice" role="status" :dir="isHebrew ? 'rtl' : 'ltr'">
      <span>{{ cycleNoticeText }}</span>
      <button type="button" class="btn" @click="undoCycleNotice">{{ isHebrew ? 'ביטול' : 'Undo' }}</button>
      <button type="button" class="btn" :aria-label="isHebrew ? 'סגור' : 'Dismiss'" @click="dismissCycleNotice">&times;</button>
    </div>
    <!-- On the old Vercel address: the app has moved (see src/lib/movedNotice.js). -->
    <div v-if="movedNoticeShown" class="app-notice" role="note" :dir="isHebrew ? 'rtl' : 'ltr'">
      <span v-if="isHebrew">
        האפליקציה עברה ל-<a :href="NEW_URL">{{ NEW_URL }}</a>.
        כדי להעביר את הסימונים, התחברו פעם אחת כאן (בהגדרות) ואחר כך שם.
      </span>
      <span v-else>
        This app has moved to <a :href="NEW_URL">{{ NEW_URL }}</a>.
        To carry your marks over, sign in once here (Settings) and then there.
      </span>
      <button type="button" class="btn" :aria-label="isHebrew ? 'סגור' : 'Dismiss'" @click="dismissMovedNotice">&times;</button>
    </div>
    <ParshaDisplay v-if="currentParsha" :parasha="currentParsha" :week="week" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue'
import { useParsha } from './composables/useParsha'
import { useSettings } from './composables/useSettings'
import { useProgress } from './composables/useProgress'
import { useAliyot } from './composables/useAliyot'
import { useCycles } from './composables/useCycles'
import { useNow } from './composables/useDailyGuide'
import { isRouteComplete } from './lib/progressMath'
import { hashRoute } from './lib/hashRoute'
import { startSync } from './composables/useSync'
import { showMovedNotice, NEW_URL, MOVED_DISMISSED_KEY } from './lib/movedNotice'
import { getItem, setItem } from './lib/storage'
import ParshaDisplay from './components/ParshaDisplay.vue'

const { getDefaultWeek, parshiyot, parshiyotList } = useParsha()
const { settings } = useSettings()
const { progress } = useProgress()
const { aliyotData, getAliyot, retryAliyot } = useAliyot()
const now = useNow()

// Empty until the hash / weekly parsha is resolved, so we never fetch a
// chumash we are not about to show.
const currentParsha = ref('')

// Provided to SettingsModal for "start this parsha over" without threading a
// prop through ParshaDisplay / FocusMode.
provide('currentParsha', currentParsha)

const { cycleNotice, checkCycles, undoCycleNotice, dismissCycleNotice } = useCycles()

const isHebrew = computed(() => settings.value.interfaceLanguage === 'he')
const parshaName = (route) => parshiyotList.find(p => p.route === route)?.he || route

const cycleNoticeText = computed(() => {
  const n = cycleNotice.value
  if (!n) return ''
  if (n.kind === 'startOver') {
    const name = parshaName(n.entries[0]?.route)
    return isHebrew.value ? `פרשת ${name} התחילה מחדש.` : `Started ${name} over.`
  }
  const count = n.entries.length
  return isHebrew.value
    ? `התחיל מחזור קריאה חדש: סימוני השנה שעברה (${count} פרשיות) הועברו לארכיון.`
    : `A new reading cycle began: last year's marks (${count} parshiyot) were moved aside.`
})

const chooseLocation = (location) => {
  settings.value.location = location
  settings.value.locationChosen = true
}

// Last cycle's marks move aside before anything reads progress (the default
// week, the daily guide). Runs again on every day change (rollOver below).
checkCycles()
// Sign-in sync: loads the Firebase client only if this device was signed in
// before, and only after the cycle check above.
startSync()

const movedNoticeShown = ref(showMovedNotice(
  typeof location !== 'undefined' ? location.hostname : '',
  !!getItem(MOVED_DISMISSED_KEY)))
const dismissMovedNotice = () => {
  movedNoticeShown.value = false
  setItem(MOVED_DISMISSED_KEY, '1')
}

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
watch(() => settings.value.location, () => {
  // Picking a location in Settings answers the first-run question too.
  settings.value.locationChosen = true
  checkCycles()
  reresolveDefault()
})

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
  checkCycles()
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
  background: var(--c-bg);
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

<style scoped>
/* The two notices above the parsha (first-run schedule question, new-cycle /
   start-over undo): banner layout like ParshaDisplay's `.error` / `.loading`
   rows and the same light bordered button as its `.btn` (scoped there, so
   repeated here with the shared variables). */
.app-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  text-align: center;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border-soft);
}

.btn {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color var(--motion-base) var(--ease-out),
    border-color var(--motion-base) var(--ease-out),
    transform var(--motion-base) var(--ease-out);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.btn:hover {
  background: var(--c-border-soft);
  border-color: var(--c-faint);
  transform: translateY(-1px);
}

.btn:active {
  transform: translateY(0);
}

@media (max-width: 600px) {
  .app-notice {
    padding: 0.4rem 0.75rem;
  }
}
</style>
