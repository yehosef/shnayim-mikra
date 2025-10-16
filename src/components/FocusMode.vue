<template>
  <div class="focus-mode">
    <!-- Header -->
    <div class="focus-header">
      <div class="verse-info">
        <span v-if="currentVerse.aliya" class="aliya-label">{{ currentVerse.aliya }}</span>
        <span class="perek-pasuk">
          <span v-if="currentVerse.perek" class="perek">פרק {{ currentVerse.perek }}</span>
          <span class="separator">:</span>
          <span class="pasuk">פסוק {{ currentVerse.pasuk }}</span>
        </span>
      </div>
      <div class="header-controls">
        <button @click="showSettings = !showSettings" class="settings-btn" title="הגדרות">⚙️</button>
        <button @click="$emit('exit')" class="exit-btn" title="חזרה לרשימה (Esc)">✕</button>
      </div>
    </div>

    <!-- Settings Panel -->
    <div v-if="showSettings" class="settings-overlay" @click.self="showSettings = false">
      <div class="settings-panel">
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
            גודל גופן: {{ settings.fontSize }}
            <input type="range" v-model.number="settings.fontSize" min="14" max="32" />
          </label>
          <label>
            <input type="checkbox" v-model="settings.fontRashi" />
            כתב רש"י
          </label>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="focus-content">
      <!-- Hebrew Text - First Reading -->
      <div
        class="torah font-sbl clickable-text"
        :class="{ 'reading-done': progress.hebrew1 }"
        @click="toggleReading('hebrew1')"
      >
        {{ formattedTorahText }}
      </div>

      <!-- Hebrew Text - Second Reading -->
      <div
        class="torah font-sbl clickable-text"
        :class="{ 'reading-done': progress.hebrew2 }"
        @click="toggleReading('hebrew2')"
      >
        {{ formattedTorahText }}
      </div>

      <!-- Targum -->
      <div
        v-if="settings.targumType === 'onkelos'"
        class="targum font-sbl clickable-text"
        :class="{ 'reading-done': progress.targum }"
        @click="toggleReading('targum')"
        v-html="currentVerse.targum"
      ></div>

      <div
        v-if="settings.targumType === 'rashi' && currentVerse.rashi"
        class="targum clickable-text"
        :class="{ 'reading-done': progress.targum, 'font-rashi': settings.fontRashi }"
        @click="toggleReading('targum')"
        v-html="currentVerse.rashi.join('  ')"
      ></div>

      <div
        v-if="settings.targumType === 'english' && currentVerse.english"
        class="targum clickable-text english-targum"
        :class="{ 'reading-done': progress.targum }"
        @click="toggleReading('targum')"
        v-html="currentVerse.english"
      ></div>

      <!-- English (shown if enabled in settings AND not selected as targum type) -->
      <div
        v-if="settings.showEnglish && settings.targumType !== 'english' && currentVerse.english"
        class="english reference-text"
        v-html="currentVerse.english"
      ></div>

      <!-- Rashi (shown if enabled in settings AND not selected as targum type) -->
      <div
        v-if="currentVerse.rashi && settings.showRashi && settings.targumType !== 'rashi'"
        class="rashi reference-text"
        :class="{ 'font-rashi': settings.fontRashi }"
        v-html="currentVerse.rashi.join('  ')"
      ></div>
    </div>

    <!-- Side Navigation Buttons -->
    <button
      @click="previousVerse"
      :disabled="currentIndex === 0"
      class="nav-btn nav-btn-left"
      title="פסוק קודם (←)"
    >
      ←
    </button>
    <button
      @click="nextVerse"
      :disabled="currentIndex === totalVerses - 1"
      class="nav-btn nav-btn-right"
      title="פסוק הבא (→)"
    >
      →
    </button>

    <!-- Progress Footer -->
    <div class="focus-footer">
      <div class="progress-indicator">
        {{ currentIndex + 1 }} / {{ totalVerses }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useProgress } from '../composables/useProgress'
import { formatHebrewText } from '../utils/hebrewUtils'

const props = defineProps({
  verses: {
    type: Array,
    required: true
  },
  startIndex: {
    type: Number,
    default: 0
  },
  parasha: {
    type: String,
    required: true
  },
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['exit'])

const { getVerseProgress, setVerseProgress } = useProgress()

const showSettings = ref(false)
const currentIndex = ref(props.startIndex)
const currentVerse = computed(() => props.verses[currentIndex.value] || {})
const totalVerses = computed(() => props.verses.length)

const verseKey = computed(() => {
  const v = currentVerse.value
  return `${v.perek || ''}:${v.pasuk}`
})

const progress = computed(() => getVerseProgress(props.parasha, verseKey.value))

const formattedTorahText = computed(() => {
  return formatHebrewText(currentVerse.value.torah, props.settings.showTrop)
})

const toggleReading = (field) => {
  const currentValue = progress.value[field]
  setVerseProgress(props.parasha, verseKey.value, field, !currentValue)
}

const nextVerse = () => {
  if (currentIndex.value < totalVerses.value - 1) {
    currentIndex.value++
  }
}

const previousVerse = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

// Keyboard navigation
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    emit('exit')
  } else if (e.key === 'ArrowRight') {
    nextVerse()
  } else if (e.key === 'ArrowLeft') {
    previousVerse()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.focus-mode {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f9fafb;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.focus-header {
  background: white;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.verse-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.aliya-label {
  background: #e5e7eb;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9em;
  color: #374151;
}

.perek-pasuk {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  color: #374151;
}

.perek {
  font-weight: 600;
}

.separator {
  color: #9ca3af;
}

.pasuk {
  font-weight: 500;
}

.header-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.settings-btn,
.exit-btn {
  background: #374151;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.25rem;
  transition: all 0.2s ease;
  font-weight: bold;
}

.settings-btn:hover,
.exit-btn:hover {
  background: #1f2937;
}

.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 101;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-overlay .settings-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  padding: 2rem;
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

.focus-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.clickable-text {
  cursor: pointer;
  padding: 1.5rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  border: 2px solid #d1d5db;
  transition: all 0.2s ease;
  background: white;
}

.clickable-text:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.clickable-text.reading-done {
  background: #dcfce7;
  border-color: #10b981;
  border-width: 3px;
}

.clickable-text.reading-done:hover {
  background: #bbf7d0;
}

.torah {
  font-size: 1.8em;
  line-height: 1.8;
  color: #1f2937;
}

.targum {
  font-size: 1.3em;
  color: #666;
  line-height: 1.7;
}

.english-targum {
  direction: ltr;
  text-align: left;
}

.reference-text {
  padding: 1.5rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.english {
  font-size: 1.1em;
  line-height: 1.6;
  color: #555;
  direction: ltr;
  text-align: left;
}

.rashi {
  font-size: 1em;
  line-height: 1.6;
  color: #444;
}

.font-rashi {
  font-family: 'Rashi', serif;
}

.nav-btn {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 1.5rem 1rem;
  border-radius: 12px;
  font-size: 2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
  z-index: 50;
}

.nav-btn-left {
  left: 1rem;
}

.nav-btn-right {
  right: 1rem;
}

.nav-btn:hover:not(:disabled) {
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 12px rgba(16, 185, 129, 0.4);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: #d1d5db;
}

.focus-footer {
  background: white;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 -2px 4px rgba(0,0,0,0.05);
}

.progress-indicator {
  font-size: 1rem;
  color: #6b7280;
  font-weight: 500;
}

@media (max-width: 768px) {
  .torah {
    font-size: 1.4em;
  }

  .targum {
    font-size: 1.1em;
  }

  .nav-btn {
    padding: 1rem 0.75rem;
    font-size: 1.5rem;
  }

  .nav-btn-left {
    left: 0.5rem;
  }

  .nav-btn-right {
    right: 0.5rem;
  }
}
</style>
