<template>
  <div
    class="verse"
    :class="{
      'completed': isCompleted,
      'current-verse': isPointer,
      'in-current-aliyah': inCurrentAliyah,
      'selected': isSelected
    }"
    :data-perek="verse.perekNum"
    :data-pasuk="verse.pasukNum"
    :data-verse-index="index"
  >
    <!-- Verse Pointer (next unread step lives in this verse) -->
    <div v-if="isPointer" class="verse-pointer" :title="pointerTitle">
      <span class="pointer-icon">▶</span>
    </div>

    <!-- Completion Indicator -->
    <div class="completion-indicator" :class="{ 'complete': isCompleted }">
      <span v-if="isCompleted" class="completion-checkmark">✓</span>
      <span v-else class="completion-dot"></span>
    </div>

    <!-- Focus Button -->
    <button @click="$emit('focus', index)" class="focus-btn" title="התמקד בפסוק זה">🔍</button>

    <!-- Aliya marker -->
    <span v-if="verse.aliya" class="aliya-marker">{{ verse.aliya }}</span>

    <!-- Verse numbers -->
    <div class="verse-header font-sbl">
      <span v-if="verse.perek" class="perek">{{ verse.perek }}</span>
      <span class="pasuk">{{ verse.pasuk }}</span>
    </div>

    <!-- Hebrew Text - First Reading -->
    <div
      class="torah font-sbl clickable-text"
      :class="{ 'reading-done': progress.hebrew1, 'phase-selected': selectedPhase === 1 }"
      @click="handlePhaseClick(1, 'hebrew1')"
    >
      {{ formattedTorahText }}
    </div>

    <!-- Hebrew Text - Second Reading -->
    <div
      class="torah font-sbl clickable-text"
      :class="{ 'reading-done': progress.hebrew2, 'phase-selected': selectedPhase === 2 }"
      @click="handlePhaseClick(2, 'hebrew2')"
    >
      {{ formattedTorahText }}
    </div>

    <!-- Targum - Clickable (shown if Onkelos is selected as targum type) -->
    <div
      v-if="settings.targumType === 'onkelos'"
      class="targum font-sbl clickable-text"
      :class="{ 'reading-done': progress.targum, 'phase-selected': selectedPhase === 3 }"
      @click="handlePhaseClick(3, 'targum')"
      v-html="verse.targum"
    ></div>

    <!-- Rashi - Clickable (shown if selected as targum type) -->
    <div
      v-if="settings.targumType === 'rashi' && verse.rashi?.length"
      class="rashi clickable-text"
      :class="{ 'reading-done': progress.targum, 'font-rashi': settings.fontRashi, 'phase-selected': selectedPhase === 3 }"
      @click="handlePhaseClick(3, 'targum')"
      v-html="verse.rashi.join('  ')"
    ></div>

    <!-- English - Clickable (shown if selected as targum type) -->
    <div
      v-if="settings.targumType === 'english' && verse.english"
      class="english clickable-text"
      :class="{ 'reading-done': progress.targum, 'phase-selected': selectedPhase === 3 }"
      @click="handlePhaseClick(3, 'targum')"
      v-html="verse.english"
    ></div>

    <!-- English (shown if enabled in settings AND not selected as targum type) -->
    <div
      v-if="settings.showEnglish && settings.targumType !== 'english' && verse.english"
      class="english"
      v-html="verse.english"
    ></div>

    <!-- Rashi (shown if enabled in settings AND not selected as targum type) -->
    <div
      v-if="verse.rashi?.length && settings.showRashi && settings.targumType !== 'rashi'"
      class="rashi"
      :class="{ 'font-rashi': settings.fontRashi }"
      v-html="verse.rashi.join('  ')"
    ></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useProgress } from '../composables/useProgress'
import { formatHebrewText } from '../utils/hebrewUtils'

const props = defineProps({
  verse: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    required: true
  },
  parasha: {
    type: String,
    required: true
  },
  settings: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  selectedPhase: {
    type: Number,
    default: 0 // 0 = none, 1 = hebrew1, 2 = hebrew2, 3 = targum
  },
  // Derived by the parent from per-verse progress (see useReadingState)
  isPointer: {
    type: Boolean,
    default: false
  },
  inCurrentAliyah: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['focus', 'phase-click'])

const { getVerseProgress } = useProgress()

const verseKey = computed(() => `${props.verse.perekNum}:${props.verse.pasukNum}`)
const progress = computed(() => getVerseProgress(props.parasha, verseKey.value))

const isCompleted = computed(() => {
  return progress.value.hebrew1 && progress.value.hebrew2 && progress.value.targum
})

const pointerTitle = computed(() => {
  const p = progress.value
  if (!p.hebrew1) return 'קריאה ראשונה'
  if (!p.hebrew2) return 'קריאה שנייה'
  return 'תרגום'
})

// Handle click on a phase - emit to parent which handles toggle + advance logic
const handlePhaseClick = (phase, field) => {
  // Check if currently read before emitting
  const wasRead = progress.value[field]
  emit('phase-click', { phase, field, wasRead })
}

const formattedTorahText = computed(() => {
  return formatHebrewText(props.verse.torah, props.settings.showTrop)
})
</script>

<style scoped>
.verse {
  background: white;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  position: relative;
}

.verse:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.verse {
  border-right: 4px solid #10b981;
  padding-right: 2.5rem;
}

.verse.completed {
  background: linear-gradient(to left, #f0fdf4 0%, #ffffff 100%);
  border-right-color: #059669;
}

.focus-btn {
  position: absolute;
  top: 1rem;
  left: 0.75rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.2rem;
}

.focus-btn:hover {
  background: #e5e7eb;
  transform: scale(1.1);
}

.completion-indicator {
  position: absolute;
  top: 1rem;
  right: 0.75rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.completion-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #d1d5db;
}

.completion-indicator.complete {
  background: #059669;
  animation: celebration 0.5s ease;
}

.completion-checkmark {
  color: white;
  font-size: 14px;
  font-weight: bold;
}

@keyframes celebration {
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.aliya-marker {
  display: inline-block;
  background: #e5e7eb;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-weight: 600;
  margin-bottom: 0.75rem;
  font-size: 0.9em;
}

.verse-header {
  margin-bottom: 0.75rem;
}

.perek {
  font-weight: 600;
  margin-left: 0.5rem;
  font-size: 1.1em;
  color: #374151;
}

.pasuk {
  font-weight: 600;
  margin-left: 0.5rem;
  font-size: 0.9em;
  color: #6b7280;
}

.clickable-text {
  cursor: pointer;
  padding: 1rem;
  margin-bottom: 0.75rem;
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

/* Phase selected (keyboard navigation) */
.clickable-text.phase-selected {
  border-color: #8b5cf6;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.4), 0 2px 8px rgba(139, 92, 246, 0.2);
}

.clickable-text.phase-selected:hover {
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.5), 0 4px 12px rgba(139, 92, 246, 0.25);
}

.clickable-text.phase-selected.reading-done {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, #dcfce7 100%);
}

.torah {
  font-size: 1.5em;
  line-height: 1.8;
  color: #1f2937;
}

.targum {
  font-size: 1.1em;
  color: #666;
  line-height: 1.7;
  margin-bottom: 0.5rem;
}

.rashi {
  font-size: 0.85em;
  line-height: 1.6;
  color: #444;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
}

.english {
  font-size: 0.95em;
  line-height: 1.6;
  color: #555;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
  direction: ltr;
  text-align: left;
}

.font-rashi {
  font-family: 'Rashi', serif;
}

/* Current Verse Indicator */
.verse-pointer {
  position: absolute;
  left: -12px;
  top: 1.5rem;
  animation: pointerPulse 1.5s ease-in-out infinite;
}

.pointer-icon {
  color: #d4a574;
  font-size: 1.5rem;
  font-weight: bold;
}

@keyframes pointerPulse {
  0%, 100% { opacity: 1; transform: translateX(0); }
  50% { opacity: 0.6; transform: translateX(-4px); }
}

/* Completion Feedback Animation */
.completion-feedback {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.feedback-checkmark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #10b981;
  color: white;
  border-radius: 50%;
  font-size: 1.5rem;
  font-weight: bold;
  animation: completionFadeOut 0.6s ease-out forwards;
}

@keyframes completionFadeOut {
  0% {
    /* allow-opacity: fade-out of the checkmark badge, not text */
    opacity: 1;
    transform: scale(1);
  }
  50% {
    background: #10b981;
  }
  100% {
    /* allow-opacity: fade-out of the checkmark badge, not text */
    opacity: 0;
    transform: scale(0.5);
  }
}

/* Verse background when showing completion */
.verse.showing-completion {
  background: linear-gradient(to left, rgba(16, 185, 129, 0.1) 0%, #ffffff 100%);
}

/* Verses in the current aliyah - subtle highlighting */
.verse.in-current-aliyah {
  border-right-color: #3b82f6;
  background: linear-gradient(to left, rgba(59, 130, 246, 0.03) 0%, #ffffff 100%);
}

.verse.in-current-aliyah:hover {
  background: linear-gradient(to left, rgba(59, 130, 246, 0.08) 0%, #ffffff 100%);
}

/* Current verse (holds the reading pointer) - stronger emphasis.
   Declared after .in-current-aliyah so it wins by source order. */
.verse.current-verse {
  border-right-color: #d4a574;
  background: linear-gradient(to left, rgba(212, 165, 116, 0.1) 0%, #ffffff 100%);
  box-shadow: 0 2px 8px rgba(212, 165, 116, 0.1);
}

.verse.current-verse:hover {
  box-shadow: 0 4px 12px rgba(212, 165, 116, 0.15);
}

/* Selected verse (keyboard navigation) */
.verse.selected {
  border-right-color: #8b5cf6;
  background: linear-gradient(to left, rgba(139, 92, 246, 0.08) 0%, #ffffff 100%);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3), 0 4px 12px rgba(139, 92, 246, 0.15);
}

.verse.selected:hover {
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.4), 0 6px 16px rgba(139, 92, 246, 0.2);
}
</style>
