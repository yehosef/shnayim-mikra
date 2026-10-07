<template>
  <div :dir="isHebrew ? 'rtl' : 'ltr'" :lang="isHebrew ? 'he' : 'en'" :style="{ fontSize: settings.fontSize + 'px' }">
    <!-- First run: one inline welcome card (language, schedule, how marking
         works, sign-in, colour key). Never blocking: the parsha below renders
         and works whether or not any of it is answered. After "Not now" it
         shrinks back to the schedule question alone while that is unanswered. -->
    <section v-if="welcomeShown" class="welcome" :aria-label="isHebrew ? 'ברוכים הבאים' : 'Welcome'">
      <div class="welcome-lang">
        <SegmentedControl v-model="settings.interfaceLanguage" name="welcome-lang" :options="languageOptions" />
      </div>
      <p class="welcome-line welcome-q">{{ isHebrew ? 'באיזה לוח קריאה להשתמש?' : 'Which reading schedule do you follow?' }}</p>
      <div class="welcome-choices">
        <button
          type="button"
          class="btn welcome-btn"
          :aria-pressed="settings.locationChosen && settings.location === 'israel' ? 'true' : 'false'"
          @click="chooseLocation('israel', $event)"
        >{{ isHebrew ? 'ישראל' : 'Israel' }}</button>
        <button
          type="button"
          class="btn welcome-btn"
          :aria-pressed="settings.locationChosen && settings.location === 'chul' ? 'true' : 'false'"
          @click="chooseLocation('chul', $event)"
        >{{ isHebrew ? 'חו"ל' : 'Diaspora' }}</button>
      </div>
      <template v-if="!settings.welcomeDismissed">
        <p class="welcome-line">{{ isHebrew
          ? 'הקישו על כל טקסט אחרי שקראתם אותו, והוא יהפוך לירוק.'
          : 'Tap each text after you read it; it turns green.' }}</p>
        <template v-if="!signedIn">
          <p class="welcome-line">
            <template v-if="isHebrew">הסימונים שלכם נשמרים רק במכשיר הזה. התחברו עם <bdi dir="ltr">Google</bdi> כדי לשמור אותם ולהשתמש בהם גם במכשירים אחרים.</template>
            <template v-else>Your marks are saved on this device only. Sign in with Google to keep them and use them on other devices.</template>
          </p>
          <div class="welcome-choices">
            <button type="button" class="btn welcome-btn btn-signin" :disabled="!sync.ready && !sync.loadFailed" @click="startSignIn">
              <template v-if="!sync.ready && !sync.loadFailed">{{ isHebrew ? 'מכין התחברות…' : 'Preparing sign-in…' }}</template>
              <template v-else-if="isHebrew">התחברות עם <bdi dir="ltr">Google</bdi></template>
              <template v-else>Sign in with Google</template>
            </button>
            <button type="button" class="btn welcome-btn" @click="dismissWelcome">{{ isHebrew ? 'לא עכשיו' : 'Not now' }}</button>
          </div>
          <p v-if="sync.loadFailed" class="welcome-line welcome-error" role="alert">
            {{ isHebrew ? 'לא ניתן לטעון את ההתחברות. בדקו את החיבור ונסו שוב.' : 'Sign-in could not load. Check the connection and try again.' }}
          </p>
          <p v-else-if="sync.signInError" class="welcome-line welcome-error" role="alert">
            {{ isHebrew ? 'ההתחברות נכשלה. נסו שוב.' : "Couldn't sign in. Try again." }}
          </p>
        </template>
        <ul class="welcome-key">
          <li><span class="key-swatch key-read" aria-hidden="true"></span>{{ isHebrew ? 'ירוק: נקרא' : 'Green: read' }}</li>
          <li><span class="key-mark" aria-hidden="true">▶</span>{{ isHebrew ? 'זהב: כאן אתם נמצאים' : 'Gold: where you are' }}</li>
          <li><span class="key-swatch key-scope" aria-hidden="true"></span>{{ isHebrew ? 'כחול: העלייה שנבחרה' : 'Blue: the selected aliyah' }}</li>
        </ul>
      </template>
    </section>
    <!-- A newer build is waiting (also offered inside Settings). -->
    <div v-if="needRefresh && !updateBarDismissed" class="app-notice" role="status">
      <span>{{ isHebrew ? 'גרסה חדשה מוכנה' : 'New version ready' }}</span>
      <button type="button" class="btn" @click="updateApp">{{ isHebrew ? 'טעינה מחדש' : 'Reload' }}</button>
      <button type="button" class="btn" :aria-label="isHebrew ? 'סגור' : 'Dismiss'" @click="updateBarDismissed = true">&times;</button>
    </div>
    <!-- After a new cycle moved last year's marks aside, or after "start this
         parsha over": say so and offer Undo. -->
    <div v-if="cycleNotice" class="app-notice" role="status">
      <span>{{ cycleNoticeText }}</span>
      <button type="button" class="btn" @click="undoCycleNotice">{{ isHebrew ? 'ביטול' : 'Undo' }}</button>
      <button type="button" class="btn" :aria-label="isHebrew ? 'סגור' : 'Dismiss'" @click="dismissCycleNotice">&times;</button>
    </div>
    <!-- On the old Vercel address: the app has moved (see src/lib/movedNotice.js). -->
    <div v-if="movedNoticeShown" class="app-notice" role="note">
      <span v-if="isHebrew">
        האפליקציה עברה ל-<a :href="NEW_URL"><bdi dir="ltr">{{ NEW_URL }}</bdi></a>.
        <template v-if="sync.user">עכשיו פתחו את הכתובת החדשה והתחברו גם שם.</template>
        <template v-else>כדי להעביר את הסימונים, התחברו פעם אחת כאן ואחר כך שם.</template>
      </span>
      <span v-else>
        This app has moved to <a :href="NEW_URL">{{ NEW_URL }}</a>.
        <template v-if="sync.user">Now open the new address and sign in there.</template>
        <template v-else>To carry your marks over, sign in once here and then there.</template>
      </span>
      <button v-if="!sync.user" type="button" class="btn" :disabled="!sync.ready && !sync.loadFailed" @click="startSignIn">
        {{ isHebrew ? 'התחברו כאן' : 'Sign in here' }}
      </button>
      <button type="button" class="btn" :aria-label="isHebrew ? 'סגור' : 'Dismiss'" @click="dismissMovedNotice">&times;</button>
    </div>
    <!-- One-time: aliyah boundaries were corrected, so groupings shift by one
         aliyah compared with older releases. Readers with no earlier marks
         never see it (see aliyotNoticeShown). -->
    <div v-if="aliyotNoticeShown" class="app-notice" role="note">
      <span>{{ isHebrew
        ? 'גבולות העליות תוקנו: ראשון מתחיל עכשיו בתחילת הפרשה.'
        : 'Aliyah boundaries corrected: Rishon now starts at the beginning of the parsha.' }}</span>
      <button type="button" class="btn" :aria-label="isHebrew ? 'סגור' : 'Dismiss'" @click="dismissAliyotNotice">&times;</button>
    </div>
    <ParshaDisplay v-if="currentParsha" :parasha="currentParsha" :week="week" />
  </div>
</template>

<script setup>
import { ref, computed, watch, watchEffect, onMounted, onUnmounted, provide } from 'vue'
import { useParsha } from './composables/useParsha'
import { useSettings } from './composables/useSettings'
import { useProgress } from './composables/useProgress'
import { useAliyot } from './composables/useAliyot'
import { useCycles } from './composables/useCycles'
import { useNow } from './composables/useDailyGuide'
import { catchUpPending } from './lib/progressMath'
import { hashRoute } from './lib/hashRoute'
import { startSync, useSync, preload, SYNC_ON_KEY } from './composables/useSync'
import { useOffline } from './composables/useOffline'
import { showMovedNotice, NEW_URL, MOVED_DISMISSED_KEY } from './lib/movedNotice'
import { getItem, setItem } from './lib/storage'
import ParshaDisplay from './components/ParshaDisplay.vue'
import SegmentedControl from './components/SegmentedControl.vue'

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
// Interface chrome follows the interface language; Torah, Targum and Rashi
// blocks pin dir="rtl" themselves. index.html sets the first value.
watchEffect(() => {
  if (typeof document === 'undefined') return
  document.documentElement.dir = isHebrew.value ? 'rtl' : 'ltr'
  document.documentElement.lang = isHebrew.value ? 'he' : 'en'
})
// Directional isolates (U+2068 / U+2069) around a Hebrew name inside an
// interface sentence, so it cannot reorder the punctuation around it.
const isolate = (s) => `\u2068${s}\u2069`
const parshaName = (route) => parshiyotList.find(p => p.route === route)?.he || route

const cycleNoticeText = computed(() => {
  const n = cycleNotice.value
  if (!n) return ''
  if (n.kind === 'startOver') {
    const name = isolate(parshaName(n.entries[0]?.route))
    return isHebrew.value ? `פרשת ${name} התחילה מחדש.` : `Started ${name} over.`
  }
  const count = n.entries.length
  const he = isHebrew.value
  const parshiyotText = he
    ? (count === 1 ? 'פרשה אחת' : `${count} פרשיות`)
    : (count === 1 ? '1 parsha' : `${count} parshiyot`)
  return he
    ? `התחיל מחזור קריאה חדש: סימוני השנה שעברה (${parshiyotText}) נשמרו בצד. אפשר להחזיר אותם מההגדרות.`
    : `A new reading cycle began: last year's marks (${parshiyotText}) were put away. You can bring them back from Settings.`
})

// The clicked button keeps focus otherwise, and the list view gives Space to a
// focused button, so the next Space would answer again instead of marking.
const chooseLocation = (location, e) => {
  settings.value.location = location
  settings.value.locationChosen = true
  e?.currentTarget?.blur?.()
}

const languageOptions = [
  { value: 'en', label: 'English', lang: 'en' },
  { value: 'he', label: 'עברית', lang: 'he' }
]

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

// Sign-in, offered from the welcome card and the moved-address notice.
const { sync, signIn } = useSync()
// This device was signed in before (the flag startSync reads), or is now.
const signedInBefore = !!getItem(SYNC_ON_KEY)
const signedIn = computed(() => !!sync.user || signedInBefore)

// Full card while not dismissed and there is something to offer (the schedule
// question or sign-in); after "Not now", only the schedule question remains,
// and only while it is unanswered.
const welcomeShown = computed(() =>
  !settings.value.locationChosen ||
  (!settings.value.welcomeDismissed && !signedIn.value))
const dismissWelcome = () => { settings.value.welcomeDismissed = true }
// Signing in (here or in Settings) is the card's purpose; do not bring it back
// after a later sign-out.
watch(() => sync.user, (u) => { if (u) settings.value.welcomeDismissed = true })

// Must stay synchronous: signIn opens the popup inside this click (Safari
// blocks popups opened after an await). If the client failed to load, this
// click retries the load instead.
const startSignIn = () => {
  if (sync.loadFailed) {
    preload()
    return
  }
  signIn()
}

// The sign-in buttons stay disabled until the client has loaded, so fetch it
// once one of them is on screen, after the parsha's own data has had a head
// start. Signed-out readers who never see either button never load it.
const signInOffered = computed(() =>
  !signedIn.value &&
  ((welcomeShown.value && !settings.value.welcomeDismissed) || movedNoticeShown.value))
let preloadTimer = null
watch(signInOffered, (offered) => {
  if (!offered || preloadTimer || sync.ready) return
  preloadTimer = setTimeout(() => { preload() }, 1200)
}, { immediate: true })

// "New version ready" on the main screen as well as in Settings: an installed
// app is rarely restarted. Dismissing hides it for this session only.
const { needRefresh, updateApp } = useOffline()
const updateBarDismissed = ref(false)

// One-time notice that the aliyah boundaries were corrected (moved here from
// the sticky header). Same key and rule as before: a device with no stored
// progress has nothing to correct, so its dismissal is seeded and it never
// shows. Read after checkCycles(), as it was when it lived in DailyGuide.
const ALIYOT_NOTICE_KEY = 'shnayim-notice-aliyot-v1'
const hasStoredProgress = () => {
  try {
    const raw = getItem('shnayim-progress')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && Object.keys(parsed).length > 0
  } catch (e) {
    return false
  }
}
const readAliyotNotice = () => {
  if (!hasStoredProgress()) {
    setItem(ALIYOT_NOTICE_KEY, 'dismissed')
    return false
  }
  return getItem(ALIYOT_NOTICE_KEY) !== 'dismissed'
}
const aliyotNoticeShown = ref(readAliyotNotice())
const dismissAliyotNotice = () => {
  aliyotNoticeShown.value = false
  setItem(ALIYOT_NOTICE_KEY, 'dismissed')
}

// "Done" for the catch-up window means "not started-and-unfinished", judged
// without loading the chumash (see progressMath.catchUpPending). A parsha with
// no marks at all counts as done: a new reader never started last week and
// must land on the coming one. Before aliyot.json has loaded we simply cannot
// tell, and "unknown" must not pin the user to last week, so it counts as done
// too; the first resolution waits for it (see onMounted).
const isRouteDone = (route) =>
  !catchUpPending(progress.value[route] || {}, getAliyot(route))

// Sunday through Tuesday this stays on last week's parsha while it is started
// but unfinished (so its 'late' status is reachable); otherwise it is the
// coming week. `now` ticks, so a tab left open across Shabbat can roll over.
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
/* The notices above the parsha (update ready, new-cycle / start-over undo,
   moved address, aliyah boundaries): banner layout like ParshaDisplay's `.error` / `.loading`
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
  /* Interface text: rem, not the reading text size set on the root div. */
  font-size: 1rem;
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

/* First-run welcome card: an inline block above the header, never an
   overlay. Buttons are grouped under their question at 44px. */
.welcome {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border-soft);
  font-size: 1rem;
  color: var(--c-text);
}

.welcome > * {
  width: 100%;
  max-width: 36rem;
  margin-inline: auto;
}

.welcome-lang {
  display: flex;
  justify-content: flex-end;
}

.welcome-line {
  margin: 0;
  line-height: 1.4;
}

.welcome-q {
  font-weight: 600;
}

.welcome-error {
  color: var(--c-danger);
  font-size: 0.9rem;
}

.welcome-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.welcome-btn {
  flex: 1 1 0;
  justify-content: center;
  min-height: 44px;
  min-width: 7rem;
  font-size: 1rem;
  color: var(--c-text);
}

.welcome-btn[aria-pressed='true'] {
  background: var(--c-scope-bg);
  border-color: var(--c-scope-strong);
  color: var(--c-scope-text);
  font-weight: 600;
}

.btn-signin {
  flex-grow: 2;
  background: var(--c-scope-strong);
  border-color: var(--c-scope-strong);
  color: #fff;
}

.btn-signin:hover {
  background: var(--c-scope-text);
  border-color: var(--c-scope-text);
}

.btn:disabled,
.btn:disabled:hover {
  background: var(--c-surface-2);
  border-color: var(--c-border-soft);
  color: var(--c-muted);
  cursor: not-allowed;
  transform: none;
}

.welcome-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  list-style: none;
  font-size: 0.85rem;
  color: var(--c-text-2);
}

.welcome-key li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.key-swatch {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
}

.key-read {
  background: var(--c-read-bg);
  border: 3px solid var(--c-read-border);
}

.key-scope {
  background: var(--c-scope-bg);
  border: 3px solid var(--c-scope);
}

.key-mark {
  width: 1rem;
  text-align: center;
  color: var(--c-pointer);
  font-weight: bold;
}

/* In Hebrew the pointer sits at the right edge: point it inward. */
[dir='rtl'] .key-mark {
  display: inline-block;
  transform: scaleX(-1);
}

@media (max-width: 600px) {
  .app-notice {
    padding: 0.4rem 0.75rem;
  }

  .welcome {
    padding: 0.6rem 0.75rem;
  }
}
</style>
