<template>
  <div class="settings-overlay" @click.self="$emit('close')">
    <div
      ref="modalEl"
      class="settings-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div class="settings-header">
        <h3 id="settings-title">{{ t('הגדרות', 'Settings') }}</h3>
        <button
          ref="closeBtn"
          type="button"
          class="close-btn"
          :aria-label="t('סגירה', 'Close')"
          @click="$emit('close')"
        >&times;</button>
      </div>
      <div class="settings-content">
        <!-- A new app version is waiting for a reload -->
        <div role="status">
          <div v-if="needRefresh" class="update-banner">
            <span>{{ t('גרסה חדשה מוכנה', 'New version ready') }}</span>
            <button type="button" class="btn btn-primary" @click="updateApp">{{ t('טעינה מחדש', 'Reload') }}</button>
          </div>
        </div>

        <!-- Interface language -->
        <fieldset class="field" aria-labelledby="settings-lang-label">
          <div class="row row-seg">
            <span id="settings-lang-label" class="row-label">{{ t('שפה', 'Language') }}</span>
            <SegmentedControl v-model="settings.interfaceLanguage" name="settings-lang" :options="languageOptions" />
          </div>
        </fieldset>

        <!-- Account: opt-in Google sign-in that syncs marks between devices.
             Nothing else in the app depends on it or is hidden without it. -->
        <section
          ref="accountEl"
          class="section"
          tabindex="-1"
          aria-labelledby="settings-sec-account"
        >
          <h4 id="settings-sec-account">{{ t('חשבון וגיבוי', 'Account and backup') }}</h4>

          <template v-if="sync.user">
            <p class="privacy">
              {{ t('הסימונים שלכם ושנת הקריאה נשמרים בחשבון ומסונכרנים בין המכשירים שלכם.',
                   'Your marks and the reading year are kept in your account and in sync across your devices.') }}
            </p>
            <div class="account-id">
              <div class="account-name"><bdi>{{ sync.user.name }}</bdi></div>
              <div v-if="sync.user.email" class="account-email"><bdi dir="ltr">{{ sync.user.email }}</bdi></div>
            </div>
            <div role="status">
              <p v-if="syncStatusText && sync.status !== 'error'" class="status-line" :class="'sync-' + sync.status">
                <span class="dot" aria-hidden="true"></span>
                <span>{{ syncStatusText }}</span>
              </p>
            </div>
            <template v-if="sync.status === 'error'">
              <p class="status-line sync-error" role="alert">
                <span class="dot" aria-hidden="true"></span>
                <span>{{ syncStatusText }}</span>
              </p>
              <div class="actions">
                <button type="button" class="btn btn-secondary" @click="retrySync">{{ t('נסו שוב', 'Try again') }}</button>
              </div>
            </template>
            <div v-if="confirmingSignOut" class="confirm">
              <p class="confirm-text">{{ signOutWarning }}</p>
              <div class="btn-row">
                <button type="button" class="btn btn-primary" @click="confirmingSignOut = false">{{ t('להישאר מחוברים', 'Stay signed in') }}</button>
                <button type="button" class="btn btn-secondary" @click="confirmSignOut">{{ t('התנתקות', 'Sign out') }}</button>
              </div>
            </div>
            <div v-else class="actions">
              <button type="button" class="btn btn-secondary" @click="askSignOut">{{ t('התנתקות', 'Sign out') }}</button>
            </div>
          </template>

          <template v-else>
            <p class="account-benefit">
              {{ t('שמרו את הסימונים שלכם והשתמשו בהם גם במכשירים האחרים שלכם.',
                   'Keep your marks and use them on your other devices.') }}
            </p>
            <p class="account-warning">
              {{ t('בלי התחברות, הסימונים נשמרים רק בדפדפן הזה ויאבדו אם הנתונים שלו יימחקו.',
                   'Without sign-in, marks stay in this browser only and are lost if its data is cleared.') }}
            </p>
            <p class="privacy">
              <template v-if="isHebrew">אם תתחברו, נשמרים רק הסימונים שלכם ושנת הקריאה; ההתחברות עם <bdi dir="ltr">Google</bdi> מוסיפה את השם וכתובת האימייל שלכם.</template>
              <template v-else>If you sign in, only your marks and the reading year are stored, with the name and email of the Google account you use.</template>
            </p>
            <template v-if="sync.loadFailed">
              <p class="error-line" role="alert">
                {{ t('לא ניתן לטעון את ההתחברות. בדקו את החיבור.', 'Sign-in could not load. Check the connection.') }}
              </p>
              <div class="actions">
                <button type="button" class="btn btn-secondary" @click="preload">{{ t('נסו שוב', 'Try again') }}</button>
              </div>
            </template>
            <div v-else class="actions">
              <button type="button" class="btn btn-primary" :disabled="!sync.ready" @click="startSignIn">
                <template v-if="!sync.ready">{{ t('מכין התחברות…', 'Preparing sign-in…') }}</template>
                <template v-else-if="isHebrew">התחברות עם <bdi dir="ltr">Google</bdi></template>
                <template v-else>Sign in with Google</template>
              </button>
            </div>
          </template>

          <div v-if="sync.signInError" class="error-block" role="alert">
            <p class="error-line">{{ t('ההתחברות נכשלה. נסו שוב.', "Couldn't sign in. Try again.") }}</p>
            <p class="error-code"><bdi dir="ltr">{{ sync.signInError }}</bdi></p>
          </div>
        </section>

        <!-- Reading -->
        <section class="section" aria-labelledby="settings-sec-reading">
          <h4 id="settings-sec-reading">{{ t('קריאה', 'Reading') }}</h4>

          <!-- Reading order and View sit together: one decides what "next" means,
               the other how much text is on screen. -->
          <fieldset class="field" aria-labelledby="settings-order-label">
            <div class="row row-seg">
              <span id="settings-order-label" class="row-label">{{ t('סדר הקריאה', 'Reading order') }}</span>
              <SegmentedControl v-model="settings.readingStyle" name="settings-order" :options="readingStyleOptions" />
              <p v-if="readingStyleHelp" class="helper">{{ readingStyleHelp }}</p>
            </div>
          </fieldset>

          <fieldset v-if="!focusMode" class="field" aria-labelledby="settings-view-label">
            <div class="row row-seg">
              <span id="settings-view-label" class="row-label">{{ t('תצוגה', 'View') }}</span>
              <SegmentedControl v-model="settings.displayMode" name="settings-view" :options="displayModeOptions" />
              <p class="helper">{{ t('כמה טקסט מוצג על המסך. סדר הקריאה קובע מה בא אחר כך.',
                                     'How much text is on screen. Reading order decides what comes next.') }}</p>
            </div>
          </fieldset>

          <fieldset class="field" aria-labelledby="settings-targum-label">
            <div class="row row-seg">
              <span id="settings-targum-label" class="row-label">{{ t('התרגום שנספר', 'Counted translation') }}</span>
              <SegmentedControl v-model="settings.targumType" name="settings-targum" :options="targumOptions" />
              <p class="helper">{{ t('רק התרגום הזה נחשב לקריאה.', 'Only this one counts toward your reading.') }}</p>
            </div>
          </fieldset>

          <fieldset class="field" aria-labelledby="settings-location-label">
            <div class="row row-seg">
              <span id="settings-location-label" class="row-label">{{ t('לוח קריאה', 'Reading schedule') }}</span>
              <SegmentedControl v-model="settings.location" name="settings-location" :options="locationOptions" />
              <p class="helper">{{ t('קובע איזו פרשה היא פרשת השבוע.', "Decides which parsha is this week's.") }}</p>
            </div>
          </fieldset>
        </section>

        <!-- Text -->
        <section class="section" aria-labelledby="settings-sec-text">
          <h4 id="settings-sec-text">{{ t('מראה', 'Appearance') }}</h4>

          <div class="row row-seg">
            <span id="settings-theme-label" class="row-label">{{ t('ערכת צבעים', 'Theme') }}</span>
            <SegmentedControl v-model="settings.theme" name="settings-theme" :options="themeOptions" />
          </div>

          <div class="row row-range">
            <label for="settings-font-size" class="row-label">{{ t('גודל הטקסט', 'Text size') }}</label>
            <div class="range-line">
              <span class="range-a range-a-small" aria-hidden="true">A</span>
              <input
                id="settings-font-size"
                v-model.number="settings.fontSize"
                type="range"
                class="range"
                min="14"
                max="32"
                :aria-valuetext="`${settings.fontSize} px`"
              />
              <span class="range-a range-a-large" aria-hidden="true">A</span>
            </div>
            <!-- Live sample of the reading text at the chosen size -->
            <div class="sample" dir="rtl" lang="he" aria-hidden="true">
              <div class="sample-hebrew font-sbl" :style="{ fontSize: settings.fontSize * 1.5 + 'px' }">{{ sampleHebrew }}</div>
              <div
                class="sample-translation"
                :class="{
                  'font-sbl': settings.targumType === 'onkelos',
                  'font-rashi': settings.targumType === 'rashi' && settings.fontRashi
                }"
                :dir="settings.targumType === 'english' ? 'ltr' : null"
                :lang="settings.targumType === 'english' ? 'en' : null"
                :style="{ fontSize: settings.fontSize * 1.15 + 'px' }"
              >{{ sampleTranslation }}</div>
            </div>
          </div>

          <label class="row row-check">
            <span class="row-label">{{ t('טעמי המקרא', 'Cantillation marks') }}</span>
            <input v-model="settings.showTrop" type="checkbox" class="check" />
          </label>

          <label class="row row-check" :class="{ 'is-disabled': settings.targumType === 'rashi' }">
            <span class="row-label">{{ t('להציג גם רש"י', 'Also show Rashi') }}</span>
            <input v-model="settings.showRashi" type="checkbox" class="check" :disabled="settings.targumType === 'rashi'" />
            <span v-if="settings.targumType === 'rashi'" class="helper">{{ alreadyCounted }}</span>
          </label>

          <label class="row row-check" :class="{ 'is-disabled': settings.targumType === 'english' }">
            <span class="row-label">{{ t('להציג גם אנגלית', 'Also show English') }}</span>
            <input v-model="settings.showEnglish" type="checkbox" class="check" :disabled="settings.targumType === 'english'" />
            <span v-if="settings.targumType === 'english'" class="helper">{{ alreadyCounted }}</span>
          </label>

          <label v-if="rashiShown" class="row row-check">
            <span class="row-label">{{ t('להציג את רש"י בכתב רש"י', 'Show Rashi in Rashi script') }}</span>
            <input v-model="settings.fontRashi" type="checkbox" class="check" />
          </label>
        </section>

        <!-- Offline use -->
        <section class="section" aria-labelledby="settings-sec-offline">
          <h4 id="settings-sec-offline">{{ t('שימוש ללא רשת', 'Offline use') }}</h4>
          <p v-if="!offlineSupported" class="status-text">
            {{ t('הדפדפן הזה לא תומך בשימוש ללא רשת.', "Offline isn't available in this browser.") }}
          </p>
          <template v-else>
          <p class="status-text">
            {{ offlineReady
              ? t('המקרא והתרגום שמורים לשימוש ללא רשת', 'Torah and Targum are saved for offline use')
              : t('שומר את המקרא והתרגום…', 'Saving Torah and Targum…') }}
          </p>
          <div role="status">
            <p v-if="offlineStatus === 'downloading'" class="status-text">
              {{ t('שומר…', 'Saving…') }} <bdi dir="ltr">{{ offlinePercent }}%</bdi>
            </p>
            <p v-else-if="offlineStatus === 'ready'" class="status-line sync-synced">
              <span class="dot" aria-hidden="true"></span>
              <span>{{ t('רש"י ואנגלית נשמרו', 'Rashi and English saved') }}</span>
            </p>
          </div>
          <div
            v-if="offlineStatus === 'downloading'"
            class="progress-track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="offlinePercent"
            :aria-label="t('שמירת רש&quot;י ואנגלית', 'Saving Rashi and English')"
          >
            <div class="progress-fill" :style="{ width: offlinePercent + '%' }"></div>
          </div>
          <template v-else-if="offlineStatus === 'error'">
            <p class="error-line" role="alert">{{ t('השמירה נכשלה', "Couldn't save") }}</p>
            <div class="actions">
              <button type="button" class="btn btn-secondary" @click="downloadForOffline">{{ t('נסו שוב', 'Try again') }}</button>
            </div>
          </template>
          <div v-else-if="offlineStatus === 'idle'" class="actions">
            <button type="button" class="btn btn-secondary" @click="downloadForOffline">
              {{ t('שמירת רש"י ואנגלית לשימוש ללא רשת', 'Save Rashi and English for offline') }}
            </button>
          </div>
          </template>
        </section>

        <!-- Start the open parsha over: archives its marks (Undo restores them)
             and clears them here and in overlapping combined/single parshiyot -->
        <section v-if="currentParsha" class="section parsha-zone" aria-labelledby="settings-sec-parsha">
          <h4 id="settings-sec-parsha">
            <template v-if="isHebrew">פרשת <bdi>{{ currentParshaName }}</bdi></template>
            <template v-else>This parsha: <bdi>{{ currentParshaName }}</bdi></template>
          </h4>
          <div v-if="confirmingStartOver" class="confirm">
            <p class="confirm-text">
              {{ t('למחוק את כל הסימונים בפרשה זו? אפשר לבטל מיד אחר כך.', 'Clear every mark in this parsha? You can undo right after.') }}
            </p>
            <div class="btn-row">
              <button type="button" class="btn btn-primary" @click="confirmingStartOver = false">{{ t('השארת הסימונים', 'Keep marks') }}</button>
              <button type="button" class="btn btn-danger" @click="confirmStartOver">{{ t('מחיקת הסימונים', 'Clear marks') }}</button>
            </div>
          </div>
          <div v-else class="actions">
            <button type="button" class="btn btn-danger" :disabled="!canStartOver(currentParsha)" @click="confirmingStartOver = true">
              {{ t('מחיקת הסימונים בפרשה', 'Clear marks in this parsha') }}
            </button>
          </div>
          <template v-if="archived">
            <div class="actions">
              <button type="button" class="btn btn-secondary" @click="confirmRestore">{{ t('החזרת הסימונים שנמחקו', 'Bring back cleared marks') }}</button>
            </div>
            <p class="helper-block">
              {{ t('סימונים שנמחקו בתחילת מחזור חדש או במחיקה נשמרים; כאן משחזרים את האחרונים.',
                   'Marks cleared by a new yearly cycle or by clearing are kept; this restores the latest set.') }}
            </p>
          </template>
          <p v-if="startOverFailed" class="error-line" role="alert">
            {{ t('לא ניתן לשמור עותק של הסימונים, לכן לא נמחק דבר.', 'Could not save a copy of the marks, so nothing was cleared.') }}
          </p>
        </section>

        <!-- Attribution: public/data/CREDITS.md, fetched when opened and shown
             inline (it is English-only, so the block is pinned LTR). -->
        <div class="credits">
          <p>{{ t('טקסטים באדיבות ספריא.', 'Texts courtesy of Sefaria.') }}</p>
          <details class="credits-details" @toggle="onCreditsToggle">
            <summary>{{ t('מקורות ורישיונות', 'Sources and licences') }}</summary>
            <p v-if="creditsState === 'loading'" class="credits-status">{{ t('טוען…', 'Loading…') }}</p>
            <p v-else-if="creditsState === 'error'" class="credits-status">
              {{ t('לא ניתן לטעון כרגע.', "Couldn't load this right now.") }}
              <a href="/data/CREDITS.md" target="_blank" rel="noopener">CREDITS.md</a>
            </p>
            <div v-else-if="creditsState === 'ready'" class="credits-body" dir="ltr" lang="en">
              <template v-for="(block, i) in creditsBlocks" :key="i">
                <p v-if="block.type === 'heading'" class="credits-heading">{{ block.text }}</p>
                <p v-else-if="block.type === 'para'">{{ block.text }}</p>
                <ul v-else-if="block.type === 'rows'" class="credits-rows">
                  <li v-for="(row, j) in block.rows" :key="j">
                    <strong>{{ row[0] }}</strong>
                    <template v-for="(cell, k) in row.slice(1)" :key="k">
                      <br />
                      <a v-if="isUrl(cell)" :href="cell" target="_blank" rel="noopener">{{ cell }}</a>
                      <span v-else>{{ block.header[k + 1] ? block.header[k + 1] + ': ' : '' }}{{ cell }}</span>
                    </template>
                  </li>
                </ul>
              </template>
            </div>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useOffline } from '../composables/useOffline'
import { useCycles } from '../composables/useCycles'
import { useSync, preload } from '../composables/useSync'
import { parshiyotList } from '../data/parshiyot'
import { formatHebrewText } from '../utils/hebrewUtils'
import { parseCredits, looksLikeMarkdown } from '../lib/creditsText'
import SegmentedControl from './SegmentedControl.vue'

const props = defineProps({
  focusMode: {
    type: Boolean,
    default: false
  },
  // 'account': open scrolled to the Account section, with focus on it (the
  // sign-in indicator next to the gear opens Settings this way).
  initialSection: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close'])

const { settings } = useSettings()
const { offlineReady, needRefresh, updateApp } = useOffline()

const isHebrew = computed(() => settings.value.interfaceLanguage === 'he')
const t = (he, en) => (isHebrew.value ? he : en)

// Segmented-control choices. Values are the stored settings values.
const languageOptions = [
  { value: 'en', label: 'English', lang: 'en' },
  { value: 'he', label: 'עברית', lang: 'he' }
]
const readingStyleOptions = computed(() => [
  { value: 'verse', label: t('פסוק אחר פסוק', 'Pasuk by pasuk') },
  { value: 'aliyah', label: t('עלייה אחר עלייה', 'Aliyah by aliyah') }
])
const readingStyleHelp = computed(() => {
  if (settings.value.readingStyle === 'verse') {
    return t('כל פסוק פעמיים מקרא, ואחריו התרגום', 'Each pasuk twice in Hebrew, then its translation.')
  }
  if (settings.value.readingStyle === 'aliyah') {
    return t('כל העלייה פעמיים מקרא, ואחריה התרגום', 'The whole aliyah twice in Hebrew, then its translation.')
  }
  return ''
})
const targumOptions = computed(() => [
  { value: 'onkelos', label: t('אונקלוס', 'Onkelos') },
  { value: 'rashi', label: t('רש"י', 'Rashi') },
  { value: 'english', label: t('אנגלית', 'English') }
])
// One pasuk, the whole aliyah, or the whole parsha on screen. Short labels so
// the three fit on one line on a phone; the helper under View explains them.
const themeOptions = computed(() => [
  { value: 'light', label: t('בהיר', 'Light') },
  { value: 'dark', label: t('כהה', 'Dark') },
  { value: 'auto', label: t('אוטומטי', 'Auto') }
])
const displayModeOptions = computed(() => [
  { value: 'pasuk', label: t('פסוק', 'Pasuk') },
  { value: 'aliyah', label: t('עלייה', 'Aliyah') },
  { value: 'parasha', label: t('פרשה', 'Parsha') }
])
const locationOptions = computed(() => [
  { value: 'israel', label: t('ישראל', 'Israel') },
  { value: 'chul', label: t('חו"ל', 'Diaspora') }
])

const alreadyCounted = computed(() => t('כבר התרגום שנספר', 'Already your counted translation'))
// Rashi script only matters while some Rashi text is on screen.
const rashiShown = computed(() => settings.value.showRashi || settings.value.targumType === 'rashi')

// Sample line under the size slider: Genesis 1:1 opening and the counted translation.
const sampleHebrew = computed(() => formatHebrewText('בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים', settings.value.showTrop))
const sampleTranslation = computed(() => {
  switch (settings.value.targumType) {
    case 'english': return 'When God began to create'
    case 'rashi': return 'בראשית ברא. אין המקרא הזה אומר אלא דרשני'
    default: return 'בְּקַדְמִין בְּרָא יְיָ'
  }
})

// "Start this parsha over" for the parsha App.vue has open.
const currentParshaRef = inject('currentParsha', ref(''))
const currentParsha = computed(() => currentParshaRef.value)
const currentParshaName = computed(() => {
  const p = parshiyotList.find(p => p.route === currentParsha.value)
  return p ? (isHebrew.value ? p.he : p.en) : currentParsha.value
})
const { canStartOver, startOver, archivedFor, restoreArchived, bulkRevision } = useCycles()
const confirmingStartOver = ref(false)
const startOverFailed = ref(false)

// Marks moved aside by a new cycle or a start-over stay restorable from here
// after the Undo notice is gone. Re-read whenever a bulk change happens.
const archived = computed(() => {
  bulkRevision.value
  return currentParsha.value ? archivedFor(currentParsha.value) : null
})

const confirmRestore = () => {
  if (restoreArchived(currentParsha.value)) emit('close')
}

const confirmStartOver = () => {
  confirmingStartOver.value = false
  startOverFailed.value = !startOver(currentParsha.value)
  if (!startOverFailed.value) emit('close')
}

// Dialog focus: focus starts on the close button, Tab stays inside the
// dialog, and focus goes back to whatever opened it on close.
const modalEl = ref(null)
const closeBtn = ref(null)
const opener = typeof document !== 'undefined' ? document.activeElement : null
let prevBodyOverflow = ''

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const trapTab = (e) => {
  const root = modalEl.value
  if (!root) return
  const items = [...root.querySelectorAll(FOCUSABLE)]
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  if (!root.contains(active)) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  } else if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

// Escape closes the modal. ParshaDisplay's key handler returns early while the
// modal is open, so without this the modal is unclosable by keyboard in list
// view. In focus mode FocusMode's own handler already closes it, so stay out of
// the way there rather than fire twice.
const handleKeydown = (e) => {
  if (e.key === 'Tab') {
    trapTab(e)
    return
  }
  if (e.key !== 'Escape' || props.focusMode) return
  e.stopPropagation()
  emit('close')
}

// Back button: on a phone Settings looks like a page, so Back must close it
// instead of changing the parsha underneath or leaving the app. Opening pushes
// one history entry with the same URL (no hashchange, so App.vue's routing does
// not see it); Back pops it and closes. Closing any other way (✕, Escape,
// focus mode's own handler, a restore) goes back over that entry on unmount,
// but only if it is still on top. An entry left over from a reload while
// Settings was open is reused rather than stacked.
const HISTORY_MARK = 'settings'
const isOurEntry = () => {
  try {
    return window.history.state?.modal === HISTORY_MARK
  } catch (e) {
    return false
  }
}
let ownsEntry = false
let closedByBack = false

const onPopState = () => {
  if (isOurEntry()) return
  closedByBack = true
  emit('close')
}

const pushHistoryEntry = () => {
  try {
    if (!isOurEntry()) {
      window.history.pushState({ ...(window.history.state || {}), modal: HISTORY_MARK }, '')
    }
    ownsEntry = true
    window.addEventListener('popstate', onPopState)
  } catch (e) {
    // No history API: Settings still closes with ✕ and Escape.
  }
}

const releaseHistoryEntry = () => {
  window.removeEventListener('popstate', onPopState)
  if (ownsEntry && !closedByBack && isOurEntry()) {
    try {
      window.history.back()
    } catch (e) { /* the extra entry is harmless */ }
  }
}

const accountEl = ref(null)

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  pushHistoryEntry()
  // Fetch the sign-in client now, so the button's popup can open straight
  // from the click (Safari blocks popups opened after an await).
  preload()
  prevBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  if (props.initialSection === 'account' && accountEl.value) {
    accountEl.value.scrollIntoView({ block: 'start' })
    accountEl.value.focus({ preventScroll: true })
  } else {
    closeBtn.value?.focus()
  }
  checkOfflineCache()
})

// Account (sign-in sync)
const { sync, signIn, signOut, retry: retrySync } = useSync()
const confirmingSignOut = ref(false)

const changesText = (n) => isHebrew.value
  ? (n === 1 ? 'שינוי אחד' : `${n} שינויים`)
  : (n === 1 ? '1 change' : `${n} changes`)

const syncStatusText = computed(() => {
  const n = sync.pending
  const he = isHebrew.value
  const waiting = !n ? ''
    : he ? ` — ${changesText(n)} ${n === 1 ? 'ממתין' : 'ממתינים'} להעלאה` : ` — ${changesText(n)} waiting`
  switch (sync.status) {
    case 'syncing': return he ? 'מסנכרן...' : 'Syncing...'
    case 'offline': return (he ? 'אין חיבור' : 'Offline') + waiting
    case 'error': return (he ? 'הסנכרון נכשל' : 'Sync failed') + waiting
    case 'synced': {
      const t = sync.lastSyncedAt
      const when = !t || Date.now() - t < 60 * 1000
        ? (he ? 'מסונכרן כעת' : 'Synced just now')
        : (he ? 'סונכרן בשעה ' : 'Synced at ') + new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return when + waiting
    }
    default: return ''
  }
})

const signOutWarning = computed(() => isHebrew.value
  ? `${changesText(sync.pending)} עדיין לא ${sync.pending === 1 ? 'הועלה' : 'הועלו'}. להתנתק בכל זאת? הסימונים יישארו במכשיר הזה.`
  : `${changesText(sync.pending)} not uploaded yet. Sign out anyway? They stay on this device.`)

// Must stay synchronous: signIn opens the popup inside this click.
const startSignIn = () => { signIn() }

const askSignOut = () => {
  if (sync.pending > 0) confirmingSignOut.value = true
  else signOut()
}

const confirmSignOut = () => {
  confirmingSignOut.value = false
  signOut()
}
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  releaseHistoryEntry()
  document.body.style.overflow = prevBodyOverflow
  // Do not hand focus back to the button that opened Settings: the list view
  // gives Space to a focused button, so the next Space would reopen Settings
  // instead of marking the next reading. Leave focus on the page.
  if (opener && typeof opener.blur === 'function') opener.blur()
})

// Offline download state
const offlineStatus = ref('idle') // idle | downloading | ready | error
const offlineDownloaded = ref(0)
const offlineTotal = ref(0)

const offlinePercent = computed(() => {
  if (offlineTotal.value === 0) return 0
  return Math.round((offlineDownloaded.value / offlineTotal.value) * 100)
})

// Torah, Targum and aliyot.json are precached by the service worker at
// install. This button warms the runtime cache with the optional layers.
const OPTIONAL_LAYER_URLS = ['english', 'rashi'].flatMap(layer =>
  ['bereishit', 'shmot', 'vayikra', 'bamidbar', 'dvarim'].map(chumash => `/data/${layer}/${chumash}.json`))

// Without a service worker nothing is cached for offline use, and the
// precache status would read "Saving…" forever.
const offlineSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator

// The download state is local to this dialog, so ask the cache on open: if
// every optional file is already there, say so instead of offering it again.
const checkOfflineCache = async () => {
  if (!offlineSupported || typeof caches === 'undefined') return
  try {
    const hits = await Promise.all(OPTIONAL_LAYER_URLS.map(url => caches.match(url, { ignoreSearch: true })))
    if (hits.every(Boolean) && offlineStatus.value === 'idle') offlineStatus.value = 'ready'
  } catch (e) {
    // Unknown: leave the button offered.
  }
}

const downloadForOffline = async () => {
  const urls = OPTIONAL_LAYER_URLS

  offlineTotal.value = urls.length
  offlineDownloaded.value = 0
  offlineStatus.value = 'downloading'

  try {
    // Fetch in batches of 5 to avoid overwhelming the browser
    for (let i = 0; i < urls.length; i += 5) {
      const batch = urls.slice(i, i + 5)
      await Promise.all(batch.map(async (url) => {
        const res = await fetch(url)
        // Vercel rewrites a missing file to index.html with a 200, so a
        // non-json 200 is a failed download, not a cached layer.
        const ct = res.headers.get('content-type') || ''
        if (!res.ok || !ct.includes('json')) {
          throw new Error(`${url}: ${res.status} ${ct || 'no content-type'}`)
        }
        offlineDownloaded.value++
      }))
    }
    offlineStatus.value = 'ready'
  } catch (e) {
    console.error('Offline download failed:', e)
    offlineStatus.value = 'error'
  }
}

// Sources and licences: fetched the first time the panel is opened.
const creditsState = ref('idle') // idle | loading | ready | error
const creditsBlocks = ref([])
const isUrl = (cell) => /^https?:\/\//.test(cell)

const onCreditsToggle = async (e) => {
  if (!e.target.open || creditsState.value === 'loading' || creditsState.value === 'ready') return
  creditsState.value = 'loading'
  try {
    const res = await fetch('/data/CREDITS.md')
    const text = res.ok ? await res.text() : ''
    if (!looksLikeMarkdown(text)) throw new Error(`CREDITS.md: ${res.status}`)
    creditsBlocks.value = parseCredits(text)
    creditsState.value = 'ready'
  } catch (err) {
    console.warn('Could not load credits:', err)
    creditsState.value = 'error'
  }
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: var(--c-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

/* Fixed type size: the dialog does not grow with the reading font size. */
.settings-modal {
  font-size: 1rem;
  display: flex;
  flex-direction: column;
  width: min(32rem, 100%);
  max-height: 90vh;
  max-height: calc(100dvh - 2rem);
  overflow: hidden;
  background: var(--c-surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(var(--c-shadow-rgb), 0.3);
  color: var(--c-text);
}

.settings-header {
  flex: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-block: 0.75rem;
  padding-inline: 1.25rem 0.75rem;
  border-block-end: 1px solid var(--c-border-soft);
}

.settings-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--c-text);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: none;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1.75rem;
  line-height: 1;
  color: var(--c-muted);
  cursor: pointer;
  transition: color var(--motion-colour) var(--ease-out);
}

.close-btn:hover {
  color: var(--c-text);
}

.settings-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 1.25rem 1.25rem;
}

/* Update banner */
.update-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-block-start: 1rem;
  padding: 0.5rem 0.75rem;
  padding-inline-start: 1rem;
  background: var(--c-scope-bg);
  border-radius: var(--radius-md);
  color: var(--c-scope-text);
  font-weight: 600;
}

/* Sections */
.section {
  border-block-start: 1px solid var(--c-border-soft);
  margin-block-start: 0.75rem;
}

.section h4 {
  margin: 1.5rem 0 0.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--c-muted);
}

.parsha-zone {
  margin-block-start: 2rem;
}

.field {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}

/* One setting: label at the reading-start side, control at the end. */
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: 0.75rem;
  row-gap: 0.25rem;
  min-height: 44px;
  padding-block: 0.5rem;
}

.row-label {
  font-size: 1rem;
  color: var(--c-text);
}

.helper {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.85rem;
  color: var(--c-muted);
}

.row-check {
  cursor: pointer;
}

.row-check.is-disabled {
  cursor: not-allowed;
}

.row-check.is-disabled .row-label {
  color: var(--c-faint);
}

.check {
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  accent-color: var(--c-scope-strong);
  cursor: inherit;
}

/* Text size */
.range-line {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 44px;
}

.range {
  flex: 1 1 auto;
  width: 100%;
  height: 44px;
  margin: 0;
  accent-color: var(--c-scope-strong);
  cursor: pointer;
}

.range-a {
  color: var(--c-text-2);
  line-height: 1;
}

.range-a-small {
  font-size: 0.85rem;
}

.range-a-large {
  font-size: 1.5rem;
}

.sample {
  grid-column: 1 / -1;
  padding: 0.75rem 1rem;
  background: var(--c-surface-2);
  border-radius: var(--radius-md);
}

.sample-hebrew {
  line-height: 1.9;
  color: var(--c-text);
}

.sample-translation {
  line-height: 1.8;
  color: var(--c-text-2);
}

.font-rashi {
  font-family: 'Rashi', serif;
}

/* Account, offline and parsha blocks */
.privacy,
.helper-block {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--c-muted);
}

.account-benefit {
  margin: 0 0 0.35rem;
  color: var(--c-text);
}

.account-warning {
  margin: 0 0 0.35rem;
  font-size: 0.9rem;
  color: var(--c-text-2);
}

/* Focused programmatically when opened at Account; not a control. */
.section:focus {
  outline: none;
}

.account-id {
  margin-block: 0.5rem;
}

.account-name {
  color: var(--c-text);
}

.account-email {
  font-size: 0.9rem;
  color: var(--c-text-2);
  overflow-wrap: anywhere;
}

.status-text {
  margin: 0.25rem 0;
  color: var(--c-text-2);
}

.status-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem 0;
  color: var(--c-text-2);
}

.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--c-faint);
}

.sync-synced .dot {
  background: var(--c-read-strong);
}

.sync-syncing .dot {
  background: var(--c-pointer);
}

.sync-offline .dot {
  background: var(--c-faint);
}

.status-line.sync-error {
  color: var(--c-danger);
}

.sync-error .dot {
  background: var(--c-danger);
}

.error-line {
  margin: 0.25rem 0;
  color: var(--c-danger);
}

.error-code {
  margin: 0;
  font-size: 0.75rem;
  color: var(--c-muted);
}

.actions {
  margin-block: 0.5rem;
}

.confirm {
  margin-block: 0.5rem;
}

.confirm-text {
  margin: 0 0 0.5rem;
  color: var(--c-text);
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.progress-track {
  height: 8px;
  margin-block: 0.25rem 0.5rem;
  background: var(--c-border-soft);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--c-scope-strong);
  border-radius: var(--radius-pill);
  transition: width var(--motion-base) var(--ease-out);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  transition:
    background-color var(--motion-colour) var(--ease-out),
    border-color var(--motion-colour) var(--ease-out),
    color var(--motion-colour) var(--ease-out);
}

.btn-primary {
  background: var(--c-scope-strong);
  border-color: var(--c-scope-strong);
  color: var(--c-on-accent);
}

.btn-primary:hover {
  background: var(--c-scope-text);
  border-color: var(--c-scope-text);
}

.btn-secondary {
  background: var(--c-surface-2);
  border-color: var(--c-border);
  color: var(--c-text);
}

.btn-secondary:hover {
  background: var(--c-border-soft);
  border-color: var(--c-faint);
}

.btn-danger {
  background: var(--c-surface);
  border-color: var(--c-danger);
  color: var(--c-danger);
}

.btn-danger:hover {
  background: var(--c-danger-bg);
}

.btn:disabled,
.btn:disabled:hover {
  background: var(--c-surface-2);
  border-color: var(--c-border-soft);
  color: var(--c-muted);
  cursor: not-allowed;
}

/* Keyboard focus */
.close-btn:focus-visible,
.btn:focus-visible,
.check:focus-visible,
.range:focus-visible,
.credits a:focus-visible {
  outline: 2px solid var(--c-scope-strong);
  outline-offset: 2px;
}

.credits {
  margin-block-start: 1.5rem;
  padding-block-start: 0.75rem;
  border-block-start: 1px solid var(--c-border-soft);
  font-size: 0.8rem;
  color: var(--c-muted);
}

.credits p {
  margin: 0;
}

.credits a {
  color: var(--c-scope-strong);
  overflow-wrap: anywhere;
}

.credits-details summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  color: var(--c-scope-strong);
  cursor: pointer;
}

.credits-details summary::before {
  content: '▸';
  margin-inline-end: 0.35rem;
}

.credits-details[open] summary::before {
  content: '▾';
}

.credits-details summary::-webkit-details-marker {
  display: none;
}

.credits-details summary:focus-visible {
  outline: 2px solid var(--c-scope-strong);
  outline-offset: 2px;
}

.credits-status {
  padding-block: 0.25rem;
}

.credits-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-block: 0.25rem 0.5rem;
  color: var(--c-text-2);
  text-align: left;
}

.credits-heading {
  font-weight: 600;
  color: var(--c-text);
}

.credits-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0;
  list-style: none;
}

/* Phone: the dialog takes the whole screen. */
@media (max-width: 520px) {
  .settings-overlay {
    padding: 0;
  }

  .settings-modal {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    border-radius: 0;
  }
}

/* Narrow: segmented rows stack (label above, control full width); checkbox
   rows stay on one line; paired buttons stack full width. */
@media (max-width: 480px) {
  .row-seg {
    grid-template-columns: 1fr;
  }

  .row-seg .segmented {
    display: flex;
    width: 100%;
  }

  .btn-row {
    flex-direction: column;
  }

  .btn-row .btn {
    width: 100%;
  }
}
</style>
