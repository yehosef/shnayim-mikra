<template>
  <div class="verse" :class="{ 'completed': isCompleted }">
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

    <!-- Targum - Clickable (shown if Onkelos is selected as targum type) -->
    <div
      v-if="settings.targumType === 'onkelos'"
      class="targum font-sbl clickable-text"
      :class="{ 'reading-done': progress.targum }"
      @click="toggleReading('targum')"
      v-html="verse.targum"
    ></div>

    <!-- Rashi - Clickable (shown if selected as targum type) -->
    <div
      v-if="settings.targumType === 'rashi' && verse.rashi"
      class="rashi clickable-text"
      :class="{ 'reading-done': progress.targum, 'font-rashi': settings.fontRashi }"
      @click="toggleReading('targum')"
      v-html="verse.rashi.join('  ')"
    ></div>

    <!-- English - Clickable (shown if selected as targum type) -->
    <div
      v-if="settings.targumType === 'english' && verse.english"
      class="english clickable-text"
      :class="{ 'reading-done': progress.targum }"
      @click="toggleReading('targum')"
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
      v-if="verse.rashi && settings.showRashi && settings.targumType !== 'rashi'"
      class="rashi"
      :class="{ 'font-rashi': settings.fontRashi }"
      v-html="verse.rashi.join('  ')"
    ></div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
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
  }
})

const { getVerseProgress, setVerseProgress } = useProgress()

const verseKey = computed(() => `${props.verse.perek || ''}:${props.verse.pasuk}`)
const progress = computed(() => getVerseProgress(props.parasha, verseKey.value))
const celebrating = ref(false)

const isCompleted = computed(() => {
  return progress.value.hebrew1 && progress.value.hebrew2 && progress.value.targum
})

const targumLabelShort = computed(() => {
  const labels = {
    onkelos: 'תרגום',
    rashi: 'רש"י',
    english: 'English'
  }
  return labels[props.settings.targumType] || 'תרגום'
})

const toggleReading = (field) => {
  const wasCompleted = isCompleted.value
  const currentValue = progress.value[field]
  setVerseProgress(props.parasha, verseKey.value, field, !currentValue)

  // Trigger celebration if just completed
  if (!wasCompleted && !currentValue && isCompleted.value) {
    celebrating.value = true
    setTimeout(() => {
      celebrating.value = false
    }, 800)
  }
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
</style>
