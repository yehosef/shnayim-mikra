<template>
  <div class="focus-mode">
    <!-- Header -->
    <div class="focus-header">
      <div class="verse-info">
        <span v-if="aliyaLabel" class="aliya-label">{{ aliyaLabel }}</span>
        <span class="perek-pasuk">
          <span v-if="currentVerse.perek" class="perek">פרק {{ currentVerse.perek }}</span>
          <span class="separator">:</span>
          <span class="pasuk">פסוק {{ currentVerse.pasuk }}</span>
        </span>
        <!-- Step Indicators -->
        <div class="step-indicator">
          <span
            :class="{ active: currentStep >= 1, done: progress.hebrew1 }"
            @click="jumpToStep(1)"
            title="קריאה ראשונה (1)"
          >●</span>
          <span
            :class="{ active: currentStep >= 2, done: progress.hebrew2 }"
            @click="jumpToStep(2)"
            title="קריאה שנייה (2)"
          >●</span>
          <span
            :class="{ active: currentStep >= 3, done: progress.targum }"
            @click="jumpToStep(3)"
            title="תרגום (3)"
          >●</span>
        </div>
      </div>
      <div class="header-controls">
        <button @click="showHelp = !showHelp" class="help-btn" title="קיצורי מקלדת (?)">?</button>
        <button @click="showSettings = !showSettings" class="settings-btn" title="הגדרות">⚙️</button>
        <button @click="$emit('exit')" class="exit-btn" title="חזרה לרשימה (Esc)">✕</button>
      </div>
    </div>

    <!-- Keyboard Help Overlay -->
    <div v-if="showHelp" class="help-overlay" @click.self="showHelp = false">
      <div class="help-panel">
        <h3>קיצורי מקלדת</h3>
        <div class="shortcuts-grid">
          <div class="shortcut"><kbd>Space</kbd> <span>המשך לשלב הבא</span></div>
          <div class="shortcut"><kbd>Enter</kbd> <span>המשך לשלב הבא</span></div>
          <div class="shortcut"><kbd>←</kbd> <span>פסוק קודם</span></div>
          <div class="shortcut"><kbd>→</kbd> <span>פסוק הבא</span></div>
          <div class="shortcut"><kbd>↑</kbd> <span>שלב קודם</span></div>
          <div class="shortcut"><kbd>↓</kbd> <span>שלב הבא</span></div>
          <div class="shortcut"><kbd>1</kbd> <span>קריאה ראשונה</span></div>
          <div class="shortcut"><kbd>2</kbd> <span>קריאה שנייה</span></div>
          <div class="shortcut"><kbd>3</kbd> <span>תרגום</span></div>
          <div class="shortcut"><kbd>M</kbd> <span>סמן כנקרא</span></div>
          <div class="shortcut"><kbd>U</kbd> <span>בטל סימון</span></div>
          <div class="shortcut"><kbd>?</kbd> <span>עזרה זו</span></div>
          <div class="shortcut"><kbd>Esc</kbd> <span>חזרה לרשימה</span></div>
        </div>
        <button @click="showHelp = false" class="close-help-btn">סגור</button>
      </div>
    </div>

    <!-- Settings Modal -->
    <SettingsModal v-if="showSettings" :focusMode="true" @close="showSettings = false" />

    <!-- Main Content - Sequential 3-Step Display -->
    <div class="focus-content" @click="advanceStep">
      <!-- Step Label -->
      <div class="step-label">{{ stepLabel }}</div>

      <!-- Hebrew Text (Steps 1 & 2) -->
      <div
        v-if="currentStep === 1 || currentStep === 2"
        class="text-display torah font-sbl"
        :class="{ 'step-complete': currentStep === 1 ? progress.hebrew1 : progress.hebrew2 }"
      >
        {{ formattedTorahText }}
      </div>

      <!-- Targum (Step 3) -->
      <div
        v-if="currentStep === 3 && settings.targumType === 'onkelos'"
        class="text-display targum font-sbl"
        :class="{ 'step-complete': progress.targum }"
        v-html="currentVerse.targum"
      ></div>

      <div
        v-if="currentStep === 3 && settings.targumType === 'rashi' && currentVerse.rashi"
        class="text-display targum"
        :class="{ 'step-complete': progress.targum, 'font-rashi': settings.fontRashi }"
        v-html="currentVerse.rashi.join('  ')"
      ></div>

      <div
        v-if="currentStep === 3 && settings.targumType === 'english'"
        class="text-display targum english-targum"
        :class="{ 'step-complete': progress.targum }"
      >
        {{ currentVerse.english || 'No English translation available' }}
      </div>

      <!-- Instruction -->
      <div class="instruction">
        <span v-if="currentStep < 3">לחץ או [Space] להמשיך</span>
        <span v-else-if="currentIndex < totalVerses - 1">לחץ או [Space] לפסוק הבא</span>
        <span v-else>לחץ או [Space] לסיים</span>
      </div>

      <!-- Additional Reference Texts (always visible if enabled) -->
      <div v-if="settings.showEnglish && settings.targumType !== 'english' && currentVerse.english" class="reference-section">
        <div class="reference-label">English</div>
        <div class="english reference-text" v-html="currentVerse.english"></div>
      </div>

      <div v-if="currentVerse.rashi && settings.showRashi && settings.targumType !== 'rashi'" class="reference-section">
        <div class="reference-label">רש"י</div>
        <div class="rashi reference-text" :class="{ 'font-rashi': settings.fontRashi }" v-html="currentVerse.rashi.join('  ')"></div>
      </div>
    </div>

    <!-- Side Navigation Buttons -->
    <button
      @click.stop="previousVerse"
      :disabled="currentIndex === 0"
      class="nav-btn nav-btn-left"
      title="פסוק קודם (←)"
    >
      ←
    </button>
    <button
      @click.stop="nextVerse"
      :disabled="currentIndex === totalVerses - 1"
      class="nav-btn nav-btn-right"
      title="פסוק הבא (→)"
    >
      →
    </button>

    <!-- Progress Footer -->
    <div class="focus-footer">
      <div class="progress-indicator">
        פסוק {{ currentIndex + 1 }} / {{ totalVerses }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useProgress } from '../composables/useProgress'
import { formatHebrewText } from '../utils/hebrewUtils'
import SettingsModal from './SettingsModal.vue'

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
  },
  // () => { key, phase } | null — the next unread step in the active reading
  // style, derived from progress by the parent (useReadingState). Called after
  // each mark so Space always advances to "the next thing to read".
  pointerFn: {
    type: Function,
    default: null
  },
  // (perek, pasuk) => Hebrew aliyah name | null
  aliyahOf: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['exit'])

const { getVerseProgress, setVerseProgress } = useProgress()

const showSettings = ref(false)
const showHelp = ref(false)
const currentIndex = ref(props.startIndex)
const currentStep = ref(1) // 1 = first Hebrew, 2 = second Hebrew, 3 = Targum
const lastAction = ref(null) // For undo functionality
const skipStepReset = ref(false) // Flag to skip step reset during arrow navigation

const currentVerse = computed(() => props.verses[currentIndex.value] || {})
const totalVerses = computed(() => props.verses.length)

const verseKey = computed(() => {
  const v = currentVerse.value
  return `${v.perekNum}:${v.pasukNum}`
})

const progress = computed(() => getVerseProgress(props.parasha, verseKey.value))

const aliyaLabel = computed(() => {
  const v = currentVerse.value
  if (props.aliyahOf && v.perekNum !== undefined) return props.aliyahOf(v.perekNum, v.pasukNum)
  return v.aliya || null
})

const PHASE_STEP = { hebrew1: 1, hebrew2: 2, targum: 3 }

// Where the pointer sits inside the displayed verses, or null
const pointerPosition = () => {
  const ptr = props.pointerFn ? props.pointerFn() : null
  if (!ptr) return null
  const index = props.verses.findIndex(v => `${v.perekNum}:${v.pasukNum}` === ptr.key)
  if (index < 0) return null
  return { index, step: PHASE_STEP[ptr.phase] || 1 }
}

const formattedTorahText = computed(() => {
  return formatHebrewText(currentVerse.value.torah, props.settings.showTrop)
})

const stepLabel = computed(() => {
  if (currentStep.value === 1) return 'קריאה ראשונה'
  if (currentStep.value === 2) return 'קריאה שנייה'
  const labels = {
    onkelos: 'תרגום אונקלוס',
    rashi: 'רש"י',
    english: 'English Translation'
  }
  return labels[props.settings.targumType] || 'תרגום'
})

// Determine starting step: the pointer's phase when the pointer is on this
// verse (respects the active reading style), else this verse's first unread.
const determineStartingStep = () => {
  const pos = pointerPosition()
  if (pos && pos.index === currentIndex.value) return pos.step
  const p = progress.value
  if (!p.hebrew1) return 1
  if (!p.hebrew2) return 2
  if (!p.targum) return 3
  return 1 // All done, start over
}

// Reset step when changing verses (unless skipped by arrow navigation)
watch(currentIndex, () => {
  if (skipStepReset.value) {
    skipStepReset.value = false
    return
  }
  currentStep.value = determineStartingStep()
})

// Initialize step on mount
onMounted(() => {
  currentStep.value = determineStartingStep()
})

// After a mark, jump to the pointer (next unread in the active style) when it
// is among the displayed verses. Returns false when there is no such step.
const followPointer = () => {
  const pos = pointerPosition()
  // Never yank the reader backwards to an earlier skipped verse
  if (!pos || pos.index < currentIndex.value) return false
  if (pos.index !== currentIndex.value) {
    skipStepReset.value = true
    currentIndex.value = pos.index
  }
  currentStep.value = pos.step
  return true
}

const advanceStep = () => {
  if (showSettings.value || showHelp.value) return // Don't advance when overlays are open

  if (currentStep.value === 1) {
    lastAction.value = { type: 'progress', parasha: props.parasha, key: verseKey.value, field: 'hebrew1', prevValue: progress.value.hebrew1 }
    setVerseProgress(props.parasha, verseKey.value, 'hebrew1', true)
    if (!followPointer()) currentStep.value = 2
  } else if (currentStep.value === 2) {
    lastAction.value = { type: 'progress', parasha: props.parasha, key: verseKey.value, field: 'hebrew2', prevValue: progress.value.hebrew2 }
    setVerseProgress(props.parasha, verseKey.value, 'hebrew2', true)
    if (!followPointer()) currentStep.value = 3
  } else {
    lastAction.value = { type: 'progress', parasha: props.parasha, key: verseKey.value, field: 'targum', prevValue: progress.value.targum }
    setVerseProgress(props.parasha, verseKey.value, 'targum', true)

    if (followPointer()) return

    // Move to next verse or exit
    if (currentIndex.value < totalVerses.value - 1) {
      currentIndex.value++
      currentStep.value = 1
    } else {
      emit('exit')
    }
  }
}

const jumpToStep = (step) => {
  currentStep.value = step
}

const markCurrentComplete = () => {
  const field = currentStep.value === 1 ? 'hebrew1' : currentStep.value === 2 ? 'hebrew2' : 'targum'
  lastAction.value = { type: 'progress', parasha: props.parasha, key: verseKey.value, field, prevValue: progress.value[field] }
  setVerseProgress(props.parasha, verseKey.value, field, true)
}

const undoLastAction = () => {
  if (lastAction.value && lastAction.value.type === 'progress') {
    setVerseProgress(lastAction.value.parasha, lastAction.value.key, lastAction.value.field, lastAction.value.prevValue)
    lastAction.value = null
  }
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
  // Don't handle keys when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
    return
  }

  // When overlays are open, only allow Escape to close them
  if (showSettings.value || showHelp.value) {
    if (e.key === 'Escape') {
      showSettings.value = false
      showHelp.value = false
    }
    return
  }

  switch (e.key) {
    case 'Escape':
      emit('exit')
      break
    case ' ':
    case 'Enter':
      e.preventDefault()
      advanceStep()
      break
    case 'ArrowRight':
      e.preventDefault()
      previousVerse() // RTL: right = backward
      break
    case 'ArrowLeft':
      e.preventDefault()
      nextVerse() // RTL: left = forward
      break
    case 'ArrowDown':
      e.preventDefault()
      if (currentStep.value < 3) {
        jumpToStep(currentStep.value + 1)
      } else if (currentIndex.value < totalVerses.value - 1) {
        skipStepReset.value = true
        currentIndex.value++
        currentStep.value = 1
      }
      break
    case 'ArrowUp':
      e.preventDefault()
      if (currentStep.value > 1) {
        jumpToStep(currentStep.value - 1)
      } else if (currentIndex.value > 0) {
        skipStepReset.value = true
        currentIndex.value--
        currentStep.value = 3
      }
      break
    case '1':
      jumpToStep(1)
      break
    case '2':
      jumpToStep(2)
      break
    case '3':
      jumpToStep(3)
      break
    case 'm':
    case 'M':
      markCurrentComplete()
      break
    case 'u':
    case 'U':
      undoLastAction()
      break
    case '?':
      showHelp.value = !showHelp.value
      break
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
  flex-wrap: wrap;
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

/* Step Indicators */
.step-indicator {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.step-indicator span {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e5e7eb;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.step-indicator span.active {
  background: #3b82f6;
  color: white;
  transform: scale(1.1);
}

.step-indicator span.done {
  background: #10b981;
  color: white;
}

.step-indicator span:hover {
  transform: scale(1.2);
}

.header-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.help-btn,
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

.help-btn {
  background: #6366f1;
}

.help-btn:hover {
  background: #4f46e5;
}

.settings-btn:hover,
.exit-btn:hover {
  background: #1f2937;
}

/* Help Overlay */
.help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 102;
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-panel {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 450px;
  width: 90%;
  padding: 2rem;
}

.help-panel h3 {
  margin-bottom: 1.5rem;
  color: #1f2937;
  font-size: 1.3rem;
  text-align: center;
}

.shortcuts-grid {
  display: grid;
  gap: 0.75rem;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  border-radius: 8px;
  background: #f9fafb;
}

.shortcut kbd {
  background: linear-gradient(180deg, #f9fafb 0%, #e5e7eb 100%);
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  font-family: monospace;
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
  min-width: 60px;
  text-align: center;
  box-shadow: 0 2px 0 #d1d5db;
}

.shortcut span {
  color: #4b5563;
  font-size: 0.95rem;
}

.close-help-btn {
  width: 100%;
  margin-top: 1.5rem;
  padding: 0.75rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.close-help-btn:hover {
  background: #2563eb;
}

/* Main Content - Sequential Display */
.focus-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.step-label {
  font-size: 1.1rem;
  color: #6b7280;
  margin-bottom: 1.5rem;
  font-weight: 500;
  text-align: center;
}

.text-display {
  width: 100%;
  max-width: 800px;
  padding: 2.5rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
  transition: all 0.3s ease;
  border: 3px solid transparent;
}

.text-display:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.text-display.step-complete {
  border-color: #10b981;
  background: #f0fdf4;
}

.torah {
  font-size: 2rem;
  line-height: 2;
  color: #1f2937;
}

.targum {
  font-size: 1.6rem;
  color: #374151;
  line-height: 1.9;
}

.english-targum {
  direction: ltr;
  text-align: center;
}

.instruction {
  margin-top: 2rem;
  font-size: 0.9rem;
  color: #9ca3af;
  text-align: center;
}

/* Reference Sections */
.reference-section {
  width: 100%;
  max-width: 800px;
  margin-top: 1.5rem;
}

.reference-label {
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.reference-text {
  padding: 1.5rem;
  border-radius: 12px;
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

/* Navigation Buttons */
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
  /* allow-opacity: disabled side button at the first/last verse, not text */
  opacity: 0.3;
  cursor: not-allowed;
  background: #d1d5db;
  box-shadow: none;
}

/* Footer */
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

/* Mobile Responsive */
@media (max-width: 768px) {
  .focus-header {
    padding: 0.75rem 1rem;
  }

  .verse-info {
    gap: 0.5rem;
  }

  .step-indicator {
    order: 3;
    width: 100%;
    justify-content: center;
    margin-top: 0.5rem;
  }

  .torah {
    font-size: 1.5rem;
  }

  .targum {
    font-size: 1.3rem;
  }

  .text-display {
    padding: 1.5rem;
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

  .help-panel {
    padding: 1.5rem;
  }

  .shortcut kbd {
    min-width: 50px;
    font-size: 0.8rem;
  }
}
</style>
