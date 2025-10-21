<template>
  <div>
    <!-- Header -->
    <div class="header">
      <div class="container">
        <div class="title-section">
          <h1>פרשת {{ parashaHe }}</h1>
          <!-- Aliyah Progress Display -->
          <div v-if="progressDisplay" class="aliyah-progress">
            {{ progressDisplay }}
          </div>
          <!-- Progress Indicator (shown only if progress > 0) -->
          <div v-if="totalVerses > 0 && completedVerses > 0" class="progress-bar">
            <div class="progress-text">התקדמות: {{ completedVerses }}/{{ totalVerses }} ({{ progressPercentage }}%)</div>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
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

    <!-- Settings Panel -->
    <div v-if="showSettings" class="settings-panel">
      <div class="settings-content">
        <h3>הגדרות</h3>
        <label>
          סוג תרגום למעקב:
          <select v-model="settings.targumType">
            <option value="onkelos">תרגום אונקלוס</option>
            <option value="rashi">רש"י</option>
            <option value="english">English</option>
          </select>
        </label>
        <label>
          <input type="checkbox" v-model="settings.showTrop" />
          הצג טעמים
        </label>
        <label>
          <input type="checkbox" v-model="settings.showRashi" />
          הצג רש"י
        </label>
        <label>
          <input type="checkbox" v-model="settings.showEnglish" />
          הצג תרגום אנגלי
        </label>
        <label>
          תצוגה:
          <select v-model="settings.order">
            <option value="pasuk">פסוק פסוק</option>
            <option value="parasha">לפי פרשה</option>
            <option value="aliya">לפי עליה</option>
          </select>
        </label>
        <label>
          גודל גופן: {{ settings.fontSize }}
          <input type="range" v-model.number="settings.fontSize" min="14" max="32" />
        </label>
        <label>
          <input type="checkbox" v-model="settings.fontRashi" />
          כתב רש"י
        </label>
        <label>
          מיקום:
          <select v-model="settings.location">
            <option value="israel">ישראל</option>
            <option value="chul">חו"ל</option>
          </select>
        </label>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">טוען...</div>

    <!-- Error -->
    <div v-if="error" class="error">שגיאה: {{ error }}</div>

    <!-- Focus Mode (Fullscreen) -->
    <FocusMode
      v-if="showFocusMode"
      :verses="data"
      :startIndex="focusIndex"
      :parasha="parasha"
      :settings="settings"
      @exit="exitFocusMode"
    />

    <!-- Content -->
    <div v-if="!loading && !error && !showFocusMode" class="content">
      <div v-if="settings.order === 'pasuk'">
        <VerseView
          v-for="(verse, i) in data"
          :key="i"
          :verse="verse"
          :index="i"
          :parasha="parasha"
          :settings="settings"
          @focus="enterFocusMode"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useData } from '../composables/useData'
import { useSettings } from '../composables/useSettings'
import { useParsha } from '../composables/useParsha'
import { useProgress } from '../composables/useProgress'
import { useAliyahNavigation } from '../composables/useAliyahNavigation'
import VerseView from './VerseView.vue'
import FocusMode from './FocusMode.vue'

const props = defineProps({
  parasha: {
    type: String,
    required: true
  }
})

const { loadParsha, loading, error, data } = useData()
const { settings } = useSettings()
const { parshiyotList } = useParsha()
const { getParshaStats } = useProgress()
const { handleSpacebarPress, getProgressDisplay } = useAliyahNavigation()

const showSettings = ref(false)
const selectedParsha = ref(props.parasha)
const showFocusMode = ref(false)
const focusIndex = ref(0)

// Keyboard handler for spacebar navigation
const handleKeydown = (event) => {
  if (event.code === 'Space' || event.key === ' ') {
    handleSpacebarPress(event)
  }
}

// Set up keyboard listener
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

// Clean up keyboard listener
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

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

// Aliyah progress display
const progressDisplay = computed(() => {
  return getProgressDisplay()
})

// Progress calculation
const totalVerses = computed(() => data.value.length)
const stats = computed(() => getParshaStats(props.parasha, totalVerses.value))
const completedVerses = computed(() => stats.value.completed)
const progressPercentage = computed(() => stats.value.percentage)


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

.settings-panel {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 1rem;
}

.settings-content {
  max-width: 1200px;
  margin: 0 auto;
}

.settings-content h3 {
  margin-bottom: 1rem;
  color: #1f2937;
  font-size: 1.2rem;
}

.settings-content label {
  display: block;
  margin-bottom: 0.75rem;
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
  padding: 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.95rem;
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
