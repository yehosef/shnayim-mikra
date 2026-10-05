<template>
  <div class="settings-overlay" @click.self="$emit('close')">
    <div class="settings-modal">
      <div class="settings-header">
        <h3>{{ isHebrew ? 'הגדרות' : 'Settings' }}</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="settings-content">
        <!-- Interface Language -->
        <label>
          {{ isHebrew ? 'שפת ממשק:' : 'Interface Language:' }}
          <select v-model="settings.interfaceLanguage">
            <option value="en">English</option>
            <option value="he">עברית</option>
          </select>
        </label>

        <!-- Display Mode (only show if not in focus mode) -->
        <label v-if="!focusMode">
          {{ isHebrew ? 'תצוגה:' : 'Display Mode:' }}
          <select v-model="settings.displayMode">
            <option value="pasuk">{{ isHebrew ? 'פסוק פסוק' : 'Verse by Verse' }}</option>
            <option value="parasha">{{ isHebrew ? 'לפי פרשה' : 'By Parsha' }}</option>
            <option value="aliyah">{{ isHebrew ? 'לפי עליה' : 'By Aliyah' }}</option>
          </select>
        </label>

        <!-- Reading Style (traversal order: only changes what "next" means) -->
        <label>
          {{ isHebrew ? 'סדר קריאה:' : 'Reading Order:' }}
          <select v-model="settings.readingStyle">
            <option value="verse">{{ isHebrew ? 'כל פסוק: פעמיים מקרא ואז תרגום' : 'Each verse: twice, then targum' }}</option>
            <option value="aliyah">{{ isHebrew ? 'כל עליה: פעמיים מקרא ואז תרגום' : 'Each aliyah: twice through, then targum' }}</option>
          </select>
        </label>

        <!-- Targum Type -->
        <label>
          {{ isHebrew ? 'סוג תרגום למעקב:' : 'Targum Type for Tracking:' }}
          <select v-model="settings.targumType">
            <option value="onkelos">{{ isHebrew ? 'תרגום אונקלוס' : 'Targum Onkelos' }}</option>
            <option value="rashi">{{ isHebrew ? 'רש"י' : 'Rashi' }}</option>
            <option value="english">English</option>
          </select>
        </label>

        <!-- Show Cantillation Marks -->
        <label>
          <input type="checkbox" v-model="settings.showTrop" />
          {{ isHebrew ? 'הצג טעמים' : 'Show Cantillation Marks' }}
        </label>

        <!-- Show Rashi Commentary -->
        <label>
          <input type="checkbox" v-model="settings.showRashi" />
          {{ isHebrew ? 'הצג רש"י' : 'Show Rashi Commentary' }}
        </label>

        <!-- Show English Translation -->
        <label>
          <input type="checkbox" v-model="settings.showEnglish" />
          {{ isHebrew ? 'הצג תרגום אנגלי' : 'Show English Translation' }}
        </label>

        <!-- Font Size -->
        <label>
          {{ isHebrew ? 'גודל גופן:' : 'Font Size:' }} {{ settings.fontSize }}
          <input type="range" v-model.number="settings.fontSize" min="14" max="32" />
        </label>

        <!-- Rashi Script -->
        <label>
          <input type="checkbox" v-model="settings.fontRashi" />
          {{ isHebrew ? 'כתב רש"י' : 'Rashi Script' }}
        </label>

        <!-- Location (only show if not in focus mode) -->
        <label v-if="!focusMode">
          {{ isHebrew ? 'מיקום:' : 'Location:' }}
          <select v-model="settings.location">
            <option value="israel">{{ isHebrew ? 'ישראל' : 'Israel' }}</option>
            <option value="chul">{{ isHebrew ? 'חו"ל' : 'Diaspora' }}</option>
          </select>
        </label>

        <!-- Offline Download -->
        <div class="offline-section">
          <div class="offline-label">{{ isHebrew ? 'שימוש ללא רשת:' : 'Offline Use:' }}</div>
          <div class="offline-core">
            <template v-if="offlineReady">{{ isHebrew ? 'מקרא ותרגום זמינים ללא רשת' : 'Torah + Targum available offline' }}</template>
            <template v-else>{{ isHebrew ? 'מקרא ותרגום נשמרים ברקע...' : 'Torah + Targum caching in background...' }}</template>
            <button v-if="needRefresh" class="offline-btn" @click="updateApp">
              {{ isHebrew ? 'עדכון זמין — טען מחדש' : 'Update available — reload' }}
            </button>
          </div>
          <div v-if="offlineStatus === 'ready'" class="offline-ready">
            {{ isHebrew ? 'רש"י ואנגלית הורדו לשימוש ללא רשת' : 'Rashi + English downloaded for offline use' }}
          </div>
          <div v-else-if="offlineStatus === 'downloading'" class="offline-progress">
            <div class="offline-progress-text">
              {{ isHebrew ? 'מוריד...' : 'Downloading...' }} {{ offlineDownloaded }}/{{ offlineTotal }}
            </div>
            <div class="offline-progress-track">
              <div class="offline-progress-fill" :style="{ width: offlinePercent + '%' }"></div>
            </div>
          </div>
          <div v-else-if="offlineStatus === 'error'" class="offline-error">
            {{ isHebrew ? 'שגיאה בהורדה' : 'Download failed' }}
            <button class="offline-btn" @click="downloadForOffline">
              {{ isHebrew ? 'נסה שוב' : 'Retry' }}
            </button>
          </div>
          <button v-else class="offline-btn" @click="downloadForOffline">
            {{ isHebrew ? 'הורד רש"י ואנגלית לשימוש ללא רשת' : 'Download Rashi + English for offline' }}
          </button>
        </div>

        <!-- Account: opt-in Google sign-in that syncs marks between devices.
             Nothing else in the app depends on it or is hidden without it. -->
        <div class="offline-section">
          <div class="offline-label">{{ isHebrew ? 'חשבון:' : 'Account:' }}</div>
          <template v-if="sync.user">
            <div class="offline-core">
              {{ sync.user.name }}<template v-if="sync.user.email"> ({{ sync.user.email }})</template>
            </div>
            <div v-if="sync.status === 'error'" class="offline-error">
              {{ syncStatusText }}
              <button class="offline-btn" @click="retrySync">{{ isHebrew ? 'נסה שוב' : 'Retry' }}</button>
            </div>
            <div v-else class="offline-core">{{ syncStatusText }}</div>
            <div v-if="confirmingSignOut" class="offline-core">
              {{ signOutWarning }}
              <button class="offline-btn" @click="confirmSignOut">{{ isHebrew ? 'כן, להתנתק' : 'Yes, sign out' }}</button>
              <button class="offline-btn" @click="confirmingSignOut = false">{{ isHebrew ? 'לא' : 'No' }}</button>
            </div>
            <button v-else class="offline-btn" @click="askSignOut">{{ isHebrew ? 'התנתקות' : 'Sign out' }}</button>
          </template>
          <template v-else>
            <div class="offline-core">
              {{ isHebrew
                ? 'התחברות שומרת את הסימונים שלך בענן ומסנכרנת אותם בין המכשירים שלך. הכול עובד גם בלי להתחבר.'
                : 'Signing in backs up your marks and keeps them in sync across your devices. Everything works without it.' }}
            </div>
            <button class="offline-btn" :disabled="!sync.ready" @click="startSignIn">
              <template v-if="sync.ready">{{ isHebrew ? 'התחברות עם Google' : 'Sign in with Google' }}</template>
              <template v-else>{{ isHebrew ? 'טוען התחברות...' : 'Loading sign-in...' }}</template>
            </button>
            <div v-if="sync.loadFailed" class="offline-error">
              {{ isHebrew ? 'לא ניתן לטעון את ההתחברות. בדקו את החיבור.' : 'Sign-in could not load. Check the connection.' }}
              <button class="offline-btn" @click="preload">{{ isHebrew ? 'נסה שוב' : 'Retry' }}</button>
            </div>
          </template>
          <div v-if="sync.signInError" class="offline-error">
            {{ isHebrew ? 'ההתחברות נכשלה' : 'Sign-in failed' }} ({{ sync.signInError }})
          </div>
          <div class="offline-core">
            {{ isHebrew
              ? 'בענן נשמרים שם חשבון Google והאימייל שלך, ואילו פסוקים סימנת.'
              : 'The cloud stores your Google account name and email and which pesukim you marked.' }}
          </div>
        </div>

        <!-- Start the open parsha over: archives its marks (Undo restores them)
             and clears them here and in overlapping combined/single parshiyot -->
        <div v-if="currentParsha" class="offline-section">
          <div class="offline-label">{{ isHebrew ? `פרשת ${currentParshaName}:` : `Parsha ${currentParshaName}:` }}</div>
          <div v-if="confirmingStartOver" class="offline-core">
            {{ isHebrew ? 'למחוק את כל הסימונים בפרשה זו? אפשר לבטל מיד אחר כך.' : 'Clear every mark in this parsha? You can undo right after.' }}
            <button class="offline-btn" @click="confirmStartOver">{{ isHebrew ? 'כן, התחל מחדש' : 'Yes, start over' }}</button>
            <button class="offline-btn" @click="confirmingStartOver = false">{{ isHebrew ? 'לא' : 'No' }}</button>
          </div>
          <button v-else class="offline-btn" :disabled="!canStartOver(currentParsha)" @click="confirmingStartOver = true">
            {{ isHebrew ? 'התחל את הפרשה מחדש' : 'Start this parsha over' }}
          </button>
          <button v-if="archived" class="offline-btn" @click="confirmRestore">
            {{ isHebrew ? 'שחזר סימונים שנשמרו בארכיון' : 'Restore archived marks' }}
          </button>
          <div v-if="startOverFailed" class="offline-error">
            {{ isHebrew ? 'לא ניתן לשמור עותק של הסימונים, לכן לא נמחק דבר.' : 'Could not save a copy of the marks, so nothing was cleared.' }}
          </div>
        </div>

        <!-- Attribution -->
        <div class="credits">
          <span v-if="isHebrew">טקסטים באדיבות ספריא. ראו</span>
          <span v-else>Texts courtesy of Sefaria. See</span>
          <a href="/data/CREDITS.md" target="_blank" rel="noopener">CREDITS</a>
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

const props = defineProps({
  focusMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const { settings } = useSettings()
const { offlineReady, needRefresh, updateApp } = useOffline()

const isHebrew = computed(() => settings.value.interfaceLanguage === 'he')

// "Start this parsha over" for the parsha App.vue has open.
const currentParshaRef = inject('currentParsha', ref(''))
const currentParsha = computed(() => currentParshaRef.value)
const currentParshaName = computed(() =>
  parshiyotList.find(p => p.route === currentParsha.value)?.he || currentParsha.value)
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

// Escape closes the modal. ParshaDisplay's key handler returns early while the
// modal is open, so without this the modal is unclosable by keyboard in list
// view. In focus mode FocusMode's own handler already closes it, so stay out of
// the way there rather than fire twice.
const handleKeydown = (e) => {
  if (e.key !== 'Escape' || props.focusMode) return
  e.stopPropagation()
  emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  // Fetch the sign-in client now, so the button's popup can open straight
  // from the click (Safari blocks popups opened after an await).
  preload()
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
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

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
const downloadForOffline = async () => {
  const chumashim = ['bereishit', 'shmot', 'vayikra', 'bamidbar', 'dvarim']
  const layers = ['english', 'rashi']

  const urls = []
  for (const chumash of chumashim) {
    for (const layer of layers) {
      urls.push(`/data/${layer}/${chumash}.json`)
    }
  }

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
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.settings-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background: white;
  border-radius: 12px 12px 0 0;
}

.settings-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.75rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #1f2937;
}

.settings-content {
  padding: 1.5rem;
}

.settings-content label {
  display: block;
  margin-bottom: 1rem;
  color: #374151;
  font-size: 1rem;
}

.settings-content input[type="checkbox"] {
  margin-left: 0.5rem;
}

.settings-content select,
.settings-content input[type="range"] {
  margin-right: 0.5rem;
}

.settings-content select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.95rem;
  min-width: 150px;
}

.settings-content input[type="range"] {
  width: 100%;
  margin-top: 0.5rem;
}

.offline-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.offline-label {
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.offline-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  font-family: inherit;
  transition: background 0.2s;
}

.offline-btn:hover {
  background: #2563eb;
}

.offline-progress-text {
  font-size: 0.9rem;
  color: #4b5563;
  margin-bottom: 0.35rem;
}

.offline-progress-track {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.offline-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.offline-ready {
  color: #059669;
  font-weight: 500;
  font-size: 0.95rem;
}

.offline-error {
  color: #dc2626;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.offline-core {
  font-size: 0.9rem;
  color: #4b5563;
  margin-bottom: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.credits {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.8rem;
  color: #6b7280;
}

.credits a {
  color: #2563eb;
  margin-inline-start: 0.25rem;
}
</style>
