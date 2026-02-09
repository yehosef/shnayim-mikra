<template>
  <div>
    <!-- Header -->
    <div class="header">
      <div class="container">
        <div class="title-section">
          <h1>פרשת {{ parashaHe }}</h1>
          <!-- Aliyah Selector (shown in aliyah mode) -->
          <div v-if="settings.displayMode === 'aliyah'" class="aliyah-selector">
            <span class="aliyah-label">{{ isHebrew ? 'עליה:' : 'Aliyah:' }}</span>
            <select v-model="settings.currentAliyah" class="aliyah-dropdown">
              <option v-for="n in aliyahCount" :key="n" :value="n">{{ aliyahNames[n - 1] }}</option>
            </select>
          </div>
          <!-- Progress Indicator -->
          <div v-if="displayVerses.length > 0" class="progress-bar">
            <div class="progress-text">
              {{ isHebrew ? 'התקדמות:' : 'Progress:' }} {{ completedCount }}/{{ displayVerses.length }} ({{ progressPercent }}%)
            </div>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
          </div>
        </div>
        <div class="controls">
          <button @click="showSettings = !showSettings" class="btn">⚙️</button>
          <select v-model="selectedParsha" @change="navigateToParsha" class="parsha-select">
            <option v-for="p in parshiyotList" :key="p.route" :value="p.route">{{ p.he }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <SettingsModal v-if="showSettings" @close="showSettings = false" />

    <!-- Loading -->
    <div v-if="loading" class="loading">{{ isHebrew ? 'טוען...' : 'Loading...' }}</div>

    <!-- Error -->
    <div v-if="error" class="error">{{ isHebrew ? 'שגיאה:' : 'Error:' }} {{ error }}</div>

    <!-- Focus Mode (Fullscreen) -->
    <FocusMode
      v-if="showFocusMode"
      :verses="displayVerses"
      :startIndex="focusIndex"
      :parasha="parasha"
      :settings="settings"
      @exit="exitFocusMode"
    />

    <!-- Content -->
    <div v-if="!loading && !error && !showFocusMode" class="content">
      <VerseView
        v-for="(verse, i) in displayVerses"
        :key="`${verse.perekNum}-${verse.pasukNum}`"
        :verse="verse"
        :index="i"
        :parasha="parasha"
        :settings="settings"
        :isSelected="selectedIndex === i"
        :selectedPhase="selectedIndex === i ? selectedPhase : 0"
        :data-verse-index="i"
        @focus="enterFocusMode"
        @click="selectedIndex = i"
        @phase-click="(eventData) => handlePhaseClick(i, eventData)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useData } from '../composables/useData'
import { useSettings } from '../composables/useSettings'
import { useParsha } from '../composables/useParsha'
import { useProgress } from '../composables/useProgress'
import parshiyotData from '../data/parshiyot'
import VerseView from './VerseView.vue'
import FocusMode from './FocusMode.vue'
import SettingsModal from './SettingsModal.vue'

const props = defineProps({
  parasha: {
    type: String,
    required: true
  }
})

const { loadParsha, loading, error, data } = useData()
const { settings } = useSettings()
const { parshiyotList } = useParsha()
const { setVerseProgress, getVerseProgress } = useProgress()

const showSettings = ref(false)
const selectedParsha = ref(props.parasha)
const showFocusMode = ref(false)
const focusIndex = ref(0)
const selectedIndex = ref(0) // Which verse is selected
const selectedPhase = ref(1) // Which phase within the verse (1=hebrew1, 2=hebrew2, 3=targum)

// Aliyah names in Hebrew
const aliyahNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי']

const enterFocusMode = (index) => {
  focusIndex.value = index
  showFocusMode.value = true
}

const exitFocusMode = () => {
  showFocusMode.value = false
}

const parashaHe = computed(() => {
  return parshiyotList.find(p => p.route === props.parasha)?.he || ''
})

const isHebrew = computed(() => settings.value.interfaceLanguage === 'he')

// Number of aliyot for the current parsha (varies: most have 7, some have 5 or 6)
const aliyahCount = computed(() => {
  const parshaDef = parshiyotData[props.parasha]
  return parshaDef ? parshaDef.aliyot.length : 7
})

// Get aliyah boundaries for filtering
const aliyahBoundaries = computed(() => {
  const parshaDef = parshiyotData[props.parasha]
  if (!parshaDef) return []

  const boundaries = []
  const aliyot = parshaDef.aliyot

  for (let i = 0; i < aliyot.length; i++) {
    const start = aliyot[i]
    // End is the verse before the next aliyah starts, or the parsha end
    const end = i < aliyot.length - 1 ? aliyot[i + 1] : parshaDef.end
    boundaries.push({ start, end, isLast: i === aliyot.length - 1 })
  }

  return boundaries
})

// Filter verses based on display mode
const displayVerses = computed(() => {
  if (settings.value.displayMode !== 'aliyah') {
    return data.value
  }

  // Filter to current aliyah
  const aliyahIndex = settings.value.currentAliyah - 1
  const boundary = aliyahBoundaries.value[aliyahIndex]
  if (!boundary) return data.value

  const [startPerek, startPasuk] = boundary.start
  const [endPerek, endPasuk] = boundary.end

  return data.value.filter(verse => {
    const vPerek = verse.perekNum
    const vPasuk = verse.pasukNum

    // Check if verse is within aliyah range
    if (vPerek < startPerek) return false
    if (vPerek > endPerek) return false
    if (vPerek === startPerek && vPasuk < startPasuk) return false

    // For the last aliyah, include the end verse; otherwise exclude it (it's the start of next aliyah)
    if (boundary.isLast) {
      if (vPerek === endPerek && vPasuk > endPasuk) return false
    } else {
      if (vPerek === endPerek && vPasuk >= endPasuk) return false
    }

    return true
  })
})

// Progress calculation (relative to displayVerses)
const completedCount = computed(() => {
  let count = 0
  for (const verse of displayVerses.value) {
    const key = `${verse.perekNum}:${verse.pasukNum}`
    const progress = getVerseProgress(props.parasha, key)
    if (progress.hebrew1 && progress.hebrew2 && progress.targum) {
      count++
    }
  }
  return count
})

const progressPercent = computed(() => {
  if (displayVerses.value.length === 0) return 0
  return Math.round((completedCount.value / displayVerses.value.length) * 100)
})

// Clamp currentAliyah when parsha changes or aliyahCount updates
watch(aliyahCount, (count) => {
  if (settings.value.currentAliyah > count) {
    settings.value.currentAliyah = count
  }
})

// Load data when parasha changes
watch(() => props.parasha, async (newParasha) => {
  selectedParsha.value = newParasha
  await loadParsha(newParasha, settings.value.showRashi)
}, { immediate: true })

// Reload when showRashi changes
watch(() => settings.value.showRashi, async () => {
  await loadParsha(props.parasha, settings.value.showRashi)
})

const navigateToParsha = () => {
  window.location.hash = selectedParsha.value
}

// Get verse key for progress tracking
const getVerseKey = (verse) => `${verse.perekNum}:${verse.pasukNum}`

// Handle click on a phase in VerseView
const handlePhaseClick = (verseIndex, { phase, field, wasRead }) => {
  selectedIndex.value = verseIndex
  selectedPhase.value = phase

  const verse = displayVerses.value[verseIndex]
  if (!verse) return

  const verseKey = getVerseKey(verse)

  // Toggle the value
  setVerseProgress(props.parasha, verseKey, field, !wasRead)

  // Only auto-advance if we just marked it as read (was unread before)
  if (!wasRead) {
    const maxIndex = displayVerses.value.length - 1
    if (selectedPhase.value < 3) {
      selectedPhase.value++
    } else if (selectedIndex.value < maxIndex) {
      selectedIndex.value++
      selectedPhase.value = 1
      scrollToSelected()
    }
  }
}

// Toggle current phase and advance only if marking as newly read
const toggleCurrentPhase = () => {
  const verse = displayVerses.value[selectedIndex.value]
  if (!verse) return

  const verseKey = getVerseKey(verse)
  const phaseField = selectedPhase.value === 1 ? 'hebrew1' : selectedPhase.value === 2 ? 'hebrew2' : 'targum'

  // Get current progress to check if already read
  const currentProgress = getVerseProgress(props.parasha, verseKey)
  const wasRead = currentProgress[phaseField]

  // Toggle the value
  setVerseProgress(props.parasha, verseKey, phaseField, !wasRead)

  // Only auto-advance if we just marked it as read (was unread before)
  if (!wasRead) {
    const maxIndex = displayVerses.value.length - 1
    if (selectedPhase.value < 3) {
      selectedPhase.value++
    } else if (selectedIndex.value < maxIndex) {
      selectedIndex.value++
      selectedPhase.value = 1
      scrollToSelected()
    }
  }
}

// Keyboard navigation for list view - navigates by phase (section) within verses
const handleKeydown = (e) => {
  // Don't handle if focus mode is active, settings open, or typing in inputs
  if (showFocusMode.value || showSettings.value) return
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return

  const maxIndex = displayVerses.value.length - 1

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      // Move to next phase, or next verse's phase 1 if at phase 3
      if (selectedPhase.value < 3) {
        selectedPhase.value++
      } else if (selectedIndex.value < maxIndex) {
        selectedIndex.value++
        selectedPhase.value = 1
        scrollToSelected()
      }
      break
    case 'ArrowUp':
      e.preventDefault()
      // Move to previous phase, or previous verse's phase 3 if at phase 1
      if (selectedPhase.value > 1) {
        selectedPhase.value--
      } else if (selectedIndex.value > 0) {
        selectedIndex.value--
        selectedPhase.value = 3
        scrollToSelected()
      }
      break
    case 'ArrowRight':
      e.preventDefault()
      // RTL: right = backward (previous verse)
      if (selectedIndex.value > 0) {
        selectedIndex.value--
        scrollToSelected()
      }
      break
    case 'ArrowLeft':
      e.preventDefault()
      // RTL: left = forward (next verse)
      if (selectedIndex.value < maxIndex) {
        selectedIndex.value++
        scrollToSelected()
      }
      break
    case ' ':
      e.preventDefault()
      // Toggle current phase - advance only if marking as newly read
      toggleCurrentPhase()
      break
    case 'Enter':
      e.preventDefault()
      // Enter focus mode
      enterFocusMode(selectedIndex.value)
      break
  }
}

const scrollToSelected = () => {
  nextTick(() => {
    const el = document.querySelector(`[data-verse-index="${selectedIndex.value}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

// Reset selected index when display mode or aliyah changes
watch([() => settings.value.displayMode, () => settings.value.currentAliyah], () => {
  selectedIndex.value = 0
  selectedPhase.value = 1
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.header {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.title-section {
  flex: 1;
}

h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.aliyah-progress {
  font-size: 0.95rem;
  color: #3b82f6;
  font-weight: 500;
  margin: 0.5rem 0;
}

.progress-bar {
  margin-top: 0.5rem;
}

.progress-text {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.progress-track {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #059669 0%, #10b981 100%);
  transition: width 0.5s ease;
  border-radius: 4px;
}

.controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-shrink: 0;
}

.btn {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
  transform: translateY(-1px);
}

.btn:active {
  transform: translateY(0);
}

.study-mode-btn {
  font-weight: 500;
}

.study-mode-btn.active {
  background: #dcfce7;
  border-color: #86efac;
  color: #166534;
}

.study-mode-btn.active:hover {
  background: #bbf7d0;
  border-color: #4ade80;
}

.study-mode-btn .icon {
  font-size: 1.1rem;
}

.study-mode-btn .label {
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .study-mode-btn .label {
    display: none;
  }
  .container {
    flex-direction: column;
    align-items: stretch;
  }
  .controls {
    justify-content: space-between;
  }
}

.parsha-select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
}

/* Aliyah Selector */
.aliyah-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.aliyah-label {
  font-size: 0.9rem;
  color: #4b5563;
  font-weight: 500;
}

.aliyah-dropdown {
  padding: 0.4rem 0.75rem;
  border: 2px solid #3b82f6;
  border-radius: 6px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  color: #1e40af;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  cursor: pointer;
  transition: all 0.2s ease;
}

.aliyah-dropdown:hover {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-color: #2563eb;
}

.aliyah-dropdown:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
}

.error {
  color: #d32f2f;
}

.content {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;
}
</style>
