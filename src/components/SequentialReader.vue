<template>
  <div class="sequential-reader">
    <!-- Progress Header -->
    <div class="reader-header">
      <div class="progress-info">
        <div class="verse-number">{{ currentVerse.perek ? currentVerse.perek + ':' : '' }}{{ currentVerse.pasuk }}</div>
        <div class="step-indicator">
          <span :class="{ active: currentStep === 1 }">●</span>
          <span :class="{ active: currentStep === 2 }">●</span>
          <span :class="{ active: currentStep === 3 }">●</span>
        </div>
        <div class="verse-progress">פסוק {{ currentVerseIndex + 1 }}/{{ totalVerses }}</div>
      </div>
      <button @click="exitReader" class="exit-btn" title="חזרה לרשימה (Esc)">✕</button>
    </div>

    <!-- Main Content -->
    <div class="reader-content" @click="advanceStep" tabindex="0" @keydown.space.prevent="advanceStep" @keydown.esc="exitReader">
      <div class="step-label">{{ stepLabel }}</div>

      <div class="text-display font-sbl" :class="{ 'targum-text': currentStep === 3 }">
        <div v-if="currentStep === 1 || currentStep === 2" class="torah-text">
          {{ formattedTorahText }}
        </div>
        <div v-else-if="currentStep === 3 && settings.targumType === 'onkelos'" class="targum-text" v-html="currentVerse.targum"></div>
        <div v-else-if="currentStep === 3 && settings.targumType === 'rashi' && currentVerse.rashi" class="rashi-text" v-html="currentVerse.rashi.join('  ')"></div>
        <div v-else-if="currentStep === 3 && settings.targumType === 'english' && currentVerse.english" class="english-text">
          {{ currentVerse.english }}
        </div>
      </div>

      <div class="instruction">
        <span v-if="currentStep < 3">לחץ או [Space] להמשיך</span>
        <span v-else-if="currentVerseIndex < totalVerses - 1">לחץ או [Space] לפסוק הבא</span>
        <span v-else>לחץ או [Space] לסיים</span>
      </div>
    </div>

    <!-- Bottom Hint -->
    <div class="reader-footer">
      לחץ [Esc] לחזרה לרשימה
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

const { setVerseProgress } = useProgress()

const currentVerseIndex = ref(props.startIndex)
const currentStep = ref(1) // 1 = first reading, 2 = second reading, 3 = targum

const totalVerses = computed(() => props.verses.length)
const currentVerse = computed(() => props.verses[currentVerseIndex.value] || {})

const stepLabel = computed(() => {
  if (currentStep.value === 1) return 'קריאה ראשונה'
  if (currentStep.value === 2) return 'קריאה שנייה'
  return targumLabel.value
})

const targumLabel = computed(() => {
  const labels = {
    onkelos: 'תרגום אונקלוס',
    rashi: 'רש"י',
    english: 'English Translation'
  }
  return labels[props.settings.targumType] || 'תרגום'
})

const verseKey = computed(() => {
  const v = currentVerse.value
  return `${v.perek || ''}:${v.pasuk}`
})

const formattedTorahText = computed(() => {
  return formatHebrewText(currentVerse.value.torah, props.settings.showTrop)
})

const advanceStep = () => {
  if (currentStep.value === 1) {
    // Mark first reading complete
    setVerseProgress(props.parasha, verseKey.value, 'hebrew1', true)
    currentStep.value = 2
  } else if (currentStep.value === 2) {
    // Mark second reading complete
    setVerseProgress(props.parasha, verseKey.value, 'hebrew2', true)
    currentStep.value = 3
  } else {
    // Mark targum complete
    setVerseProgress(props.parasha, verseKey.value, 'targum', true)

    // Move to next verse or exit
    if (currentVerseIndex.value < totalVerses.value - 1) {
      currentVerseIndex.value++
      currentStep.value = 1
    } else {
      // Completed all verses
      exitReader()
    }
  }
}

const exitReader = () => {
  emit('exit')
}

// Keyboard navigation
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    exitReader()
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    advanceStep()
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
.sequential-reader {
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

.reader-header {
  background: white;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.verse-number {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
}

.step-indicator {
  display: flex;
  gap: 0.5rem;
}

.step-indicator span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #d1d5db;
  transition: all 0.3s ease;
}

.step-indicator span.active {
  background: #10b981;
  transform: scale(1.2);
}

.verse-progress {
  font-size: 0.875rem;
  color: #6b7280;
}

.exit-btn {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.25rem;
  transition: all 0.2s ease;
}

.exit-btn:hover {
  background: #e5e7eb;
}

.reader-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 3rem 2rem;
  cursor: pointer;
  outline: none;
}

.reader-content:active {
  transform: scale(0.98);
}

.step-label {
  font-size: 1rem;
  color: #6b7280;
  margin-bottom: 2rem;
  font-weight: 500;
}

.text-display {
  max-width: 800px;
  width: 100%;
  text-align: center;
  font-size: 2rem;
  line-height: 2;
  color: #1f2937;
  padding: 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.torah-text {
  font-size: 2rem;
}

.targum-text,
.rashi-text {
  font-size: 1.75rem;
  color: #374151;
}

.english-text {
  font-size: 1.5rem;
  direction: ltr;
  color: #374151;
}

.instruction {
  margin-top: 2rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.reader-footer {
  background: white;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  text-align: center;
  font-size: 0.875rem;
  color: #6b7280;
}

@media (max-width: 768px) {
  .text-display {
    font-size: 1.5rem;
    padding: 1.5rem;
  }

  .torah-text {
    font-size: 1.5rem;
  }

  .targum-text,
  .rashi-text {
    font-size: 1.25rem;
  }

  .english-text {
    font-size: 1.1rem;
  }
}
</style>
