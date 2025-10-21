<template>
  <div class="reading-list-container">
    <!-- Daily Aliyah Guide (optional) -->
    <div v-if="dailyGuide && settings.dailyAliyahGuide" class="daily-guide">
      <div class="daily-info">
        <span class="label">היום:</span>
        <span class="aliyot">{{ dailyGuide }}</span>
      </div>
      <button v-if="todaysAliyot" @click="jumpTodaysAliyah" class="jump-btn">
        קפוץ ליום →
      </button>
    </div>

    <!-- Yesterday Warning (if applicable) -->
    <div v-if="yesterdayWarning && !dismissedWarning" class="yesterday-warning">
      <span class="warning-text">⚠️ {{ yesterdayWarning.message }}</span>
      <button @click="dismissYesterdayWarning" class="dismiss-btn">×</button>
    </div>

    <!-- Progress Bar -->
    <div class="progress-section">
      <div class="progress-info">
        <span class="progress-label">התקדמות:</span>
        <span class="progress-numbers">{{ progressStats.completed }}/{{ progressStats.total }}</span>
        <span class="progress-percent">{{ progressStats.percentComplete }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressStats.percentComplete + '%' }"></div>
      </div>
    </div>

    <!-- Reading Items List -->
    <div class="reading-items-list">
      <div
        v-for="(item, idx) in readingItems"
        :key="item.id"
        :data-item-id="item.id"
        class="reading-item"
        :class="{
          'is-current': isCurrent(item.id),
          'is-completed': isItemCompleted(item.id),
          'is-upcoming': isUpcoming(item.id)
        }"
        @click="selectItem(item.id)"
      >
        <!-- Completion Checkbox -->
        <div class="item-checkbox">
          <input
            type="checkbox"
            :checked="isItemCompleted(item.id)"
            :disabled="!isCurrent(item.id)"
            @click.stop="toggleItem(item.id)"
          />
        </div>

        <!-- Item Content -->
        <div class="item-content">
          <!-- Item Label -->
          <div class="item-label">{{ item.label }}</div>

          <!-- Item Text (Hebrew) -->
          <div v-if="isCurrent(item.id) || isUpcoming(item.id)" class="item-text">
            <div v-for="verse in item.verses.slice(0, 5)" :key="`${verse.perekNum}-${verse.pasukNum}`" class="verse-snippet">
              <span class="verse-ref">{{ verse.perek }}:{{ verse.pasuk }}</span>
              <span class="verse-content">{{ getVersePreview(verse) }}</span>
            </div>
            <div v-if="item.verses.length > 5" class="more-verses">
              +{{ item.verses.length - 5 }} more verses...
            </div>
          </div>

          <!-- Current Item Indicator -->
          <div v-if="isCurrent(item.id)" class="current-indicator">
            עכשיו לקרוא ↓
          </div>
        </div>

        <!-- Completion Feedback Animation -->
        <div v-if="completionFeedback.isVisible && completionFeedback.itemId === item.id" class="completion-feedback">
          <span class="feedback-checkmark">✓</span>
        </div>
      </div>
    </div>

    <!-- Spacebar Hint -->
    <div class="spacebar-hint">
      💡 הקש <kbd>SPACE</kbd> כדי לסימן כמתוגמר
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useReadingProgress } from '../composables/useReadingProgress'
import { useDailyAliyah } from '../composables/useDailyAliyah'
import { useSettings } from '../composables/useSettings'

const props = defineProps({
  readingItems: {
    type: Array,
    required: true
  },
  parasha: {
    type: String,
    required: true
  }
})

const {
  currentItem,
  currentItemId,
  completionFeedback,
  progressStats,
  isItemCompleted,
  completeCurrentItem,
  jumpToItem,
  jumpToAliyah,
  handleSpacebarPress,
  initializeParsha
} = useReadingProgress()

const { settings } = useSettings()
const { getTodaysAliyah, getTodaysAliyahDisplay, getIncompleteAliyot, showYesterdayWarning } = useDailyAliyah()

const dismissedWarning = ref(false)

// Initialize progress with reading items
onMounted(() => {
  initializeParsha(props.parasha, props.readingItems, settings.value.readingApproach)
  window.addEventListener('keydown', handleSpacebarPress)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleSpacebarPress)
})

// Re-initialize if items or approach changes
watch([() => props.readingItems, () => settings.value.readingApproach], ([newItems, newApproach]) => {
  if (newItems && newItems.length > 0) {
    initializeParsha(props.parasha, newItems, newApproach)
  }
}, { deep: true })

// Computed properties
const todaysAliyot = computed(() => getTodaysAliyah())

const dailyGuide = computed(() => {
  if (!settings.value.dailyAliyahGuide) return null
  return getTodaysAliyahDisplay()
})

const yesterdayWarning = computed(() => {
  const incomplete = getIncompleteAliyot(
    progressStats.value?.completedItemIds || [],
    props.readingItems
  )
  return showYesterdayWarning(
    progressStats.value?.completedItemIds || [],
    props.readingItems
  )
})

const readingItems = computed(() => props.readingItems)

// Methods
function isCurrent(itemId) {
  return itemId === currentItemId.value
}

function isUpcoming(itemId) {
  if (!currentItemId.value) return false
  const currentIdx = readingItems.value.findIndex((i) => i.id === currentItemId.value)
  const itemIdx = readingItems.value.findIndex((i) => i.id === itemId)
  return itemIdx > currentIdx
}

function getVersePreview(verse) {
  const text = verse.torah || ''
  return text.substring(0, 60) + (text.length > 60 ? '...' : '')
}

function selectItem(itemId) {
  jumpToItem(itemId)
}

function toggleItem(itemId) {
  if (isCurrent(itemId)) {
    completeCurrentItem()
  }
}

function jumpTodaysAliyah() {
  if (todaysAliyot.value && todaysAliyot.value.length > 0) {
    jumpToAliyah(todaysAliyot.value[0])
  }
}

function dismissYesterdayWarning() {
  dismissedWarning.value = true
}
</script>

<style scoped>
.reading-list-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
  direction: rtl;
}

/* Daily Guide */
.daily-guide {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
  border: 2px solid #0ea5e9;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  font-size: 0.95rem;
}

.daily-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.daily-info .label {
  font-weight: 600;
  color: #0c4a6e;
}

.daily-info .aliyot {
  font-size: 1.1rem;
  color: #0284c7;
  font-weight: 500;
}

.jump-btn {
  background: #0ea5e9;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.jump-btn:hover {
  background: #0284c7;
  transform: translateY(-2px);
}

/* Yesterday Warning */
.yesterday-warning {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 4px;
}

.warning-text {
  color: #92400e;
  font-size: 0.9rem;
}

.dismiss-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #92400e;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dismiss-btn:hover {
  opacity: 0.7;
}

/* Progress Bar */
.progress-section {
  margin-bottom: 2rem;
}

.progress-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.progress-label {
  font-weight: 600;
  color: #4b5563;
}

.progress-numbers {
  font-weight: 500;
  color: #0ea5e9;
}

.progress-percent {
  color: #64748b;
  font-size: 0.85rem;
}

.progress-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0ea5e9 0%, #06b6d4 100%);
  transition: width 0.3s ease;
  border-radius: 4px;
}

/* Reading Items List */
.reading-items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

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
  transform: scale(0.6);
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

.reading-item.is-upcoming {
  transform: scale(0.7);
  opacity: 0.7;
  order: 100;
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
  disabled: opacity(0.5);
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
}

.item-text {
  font-size: 0.95rem;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 0.5rem;
}

.verse-snippet {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.verse-ref {
  font-weight: 600;
  color: #64748b;
  min-width: 50px;
}

.verse-content {
  flex: 1;
  color: #475569;
  word-break: break-word;
}

.more-verses {
  color: #94a3b8;
  font-size: 0.85rem;
  font-style: italic;
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

/* Spacebar Hint */
.spacebar-hint {
  text-align: center;
  margin-top: 3rem;
  padding: 1rem;
  color: #64748b;
  font-size: 0.9rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px dashed #cbd5e1;
}

kbd {
  display: inline-block;
  background: #e2e8f0;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85em;
  font-weight: 500;
}

/* Mobile Responsive */
@media (max-width: 640px) {
  .reading-list-container {
    padding: 0.75rem;
  }

  .reading-item {
    flex-direction: column;
    padding: 1rem;
    gap: 0.75rem;
  }

  .item-checkbox {
    align-items: center;
  }

  .daily-guide {
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }

  .daily-info {
    width: 100%;
    justify-content: center;
  }

  .jump-btn {
    width: 100%;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .reading-item,
  .progress-fill,
  .jump-btn,
  .feedback-checkmark {
    transition: none;
    animation: none;
  }
}
</style>
