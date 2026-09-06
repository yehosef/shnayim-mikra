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
import { computed, ref } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useOffline } from '../composables/useOffline'

const props = defineProps({
  focusMode: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const { settings } = useSettings()
const { offlineReady, needRefresh, updateApp } = useOffline()

const isHebrew = computed(() => settings.value.interfaceLanguage === 'he')

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
        if (!res.ok) throw new Error(`${url}: ${res.status}`)
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
