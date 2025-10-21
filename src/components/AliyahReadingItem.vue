<template>
  <div
    class="reading-item"
    :class="{
      'is-current': isCurrent,
      'is-completed': isCompleted
    }"
    :data-item-id="item.id"
    @click="$emit('click', item)"
  >
    <!-- Completion Checkbox -->
    <div class="item-checkbox">
      <input
        type="checkbox"
        :checked="isCompleted"
        :disabled="!isCurrent"
        @click.stop="$emit('toggle')"
      />
    </div>

    <!-- Item Content -->
    <div class="item-content">
      <!-- Item Label -->
      <div class="item-label">
        {{ item.label }} <span class="verse-range">{{ item.verseRange }}</span>
      </div>

      <!-- Item Text (Hebrew) -->
      <div v-if="isCurrent || isCompleted === false" class="item-text font-sbl">
        <div v-for="(verse, idx) in item.verses" :key="`${verse.perekNum}-${verse.pasukNum}`" class="verse-block">
          <span class="verse-ref">{{ verse.perek }}:{{ verse.pasuk }}</span>
          <span class="verse-content">
            {{ getVerseText(verse) }}
          </span>
        </div>
      </div>

      <!-- Current Item Indicator -->
      <div v-if="isCurrent" class="current-indicator">
        עכשיו לקרוא ↓
      </div>
    </div>

    <!-- Completion Feedback Animation -->
    <div v-if="showFeedback && isCurrent" class="completion-feedback">
      <span class="feedback-checkmark">✓</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  isCurrent: {
    type: Boolean,
    default: false
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click', 'toggle'])

const showFeedback = ref(false)

/**
 * Get verse text based on phase
 * For rishon/sheni phases: show Torah text
 * For shlishi phase: show Targum text
 */
function getVerseText(verse) {
  if (props.item.type === 'targum') {
    return verse.targum || verse.torah || ''
  } else {
    return verse.torah || ''
  }
}

/**
 * Watch for completion and show feedback animation
 */
watch(
  () => props.isCompleted,
  (newVal) => {
    if (newVal && props.isCurrent) {
      showFeedback.value = true
      setTimeout(() => {
        showFeedback.value = false
      }, 600)
    }
  }
)
</script>

<style scoped>
.reading-item {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* Item States */
.reading-item.is-completed {
  opacity: 0.5;
  transform: scale(0.95);
  filter: grayscale(0.3);
  order: -100;
}

.reading-item.is-current {
  transform: scale(1);
  opacity: 1;
  border: 3px solid #0ea5e9;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%);
  box-shadow: 0 8px 24px rgba(14, 165, 233, 0.15);
  order: 0;
}

.reading-item:hover:not(.is-completed) {
  border-color: #0ea5e9;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.1);
}

/* Item Checkbox */
.item-checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  padding-top: 0.25rem;
}

.item-checkbox input[type='checkbox'] {
  width: 24px;
  height: 24px;
  cursor: pointer;
  accent-color: #0ea5e9;
}

.item-checkbox input[type='checkbox']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Item Content */
.item-content {
  flex: 1;
  min-width: 0;
}

.item-label {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.verse-range {
  font-size: 0.85rem;
  font-weight: 400;
  color: #64748b;
  margin-right: 0.5rem;
}

/* Item Text */
.item-text {
  font-size: 0.95rem;
  color: #475569;
  line-height: 1.8;
  margin-bottom: 0.5rem;
}

.verse-block {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 4px;
  border-left: 3px solid #e2e8f0;
}

.verse-ref {
  font-weight: 600;
  color: #64748b;
  min-width: 50px;
  flex-shrink: 0;
  font-size: 0.9rem;
}

.verse-content {
  flex: 1;
  color: #1e293b;
  word-break: break-word;
  text-align: right;
}

.current-indicator {
  color: #0ea5e9;
  font-size: 0.85rem;
  font-weight: 600;
  margin-top: 0.75rem;
}

/* Completion Feedback */
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
  width: 48px;
  height: 48px;
  background: #10b981;
  color: white;
  border-radius: 50%;
  font-size: 1.75rem;
  font-weight: bold;
  animation: completionFadeOut 0.6s ease-out forwards;
}

@keyframes completionFadeOut {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    background: #10b981;
  }
  100% {
    opacity: 0;
    transform: scale(0.5);
  }
}

/* Hebrew Font */
.font-sbl {
  font-family: 'SBL BibLit', 'Ezra SIL', serif;
}

/* Mobile Responsive */
@media (max-width: 640px) {
  .reading-item {
    flex-direction: column;
    padding: 1rem;
    gap: 0.75rem;
  }

  .item-checkbox {
    align-items: center;
  }

  .item-label {
    flex-direction: column;
    align-items: flex-end;
  }

  .verse-range {
    margin-right: 0;
    margin-top: 0.25rem;
  }

  .verse-block {
    flex-direction: column-reverse;
    align-items: flex-end;
  }

  .verse-ref {
    min-width: auto;
    text-align: right;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .reading-item,
  .feedback-checkmark {
    transition: none;
    animation: none;
  }
}
</style>
