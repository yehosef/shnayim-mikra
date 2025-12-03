<template>
  <div class="aliyah-reading-container">
    <!-- Progress Bar -->
    <div class="progress-section">
      <div class="progress-info">
        <span class="progress-label">התקדמות:</span>
        <span class="progress-numbers">{{ completedCount }}/21</span>
        <span class="progress-percent">{{ progressPercent }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <!-- Reading Items List -->
    <div class="reading-items-list">
      <AliyahReadingItem
        v-for="(item, idx) in readingItems"
        :key="item.id"
        :data-item-index="idx"
        :item="item"
        :isCurrent="isCurrent(item)"
        :isCompleted="isCompleted(item)"
        :isSelected="idx === selectedIndex"
        @click="selectAndJump(idx, item)"
      />
    </div>

    <!-- Keyboard Hint -->
    <div class="spacebar-hint">
      💡 <kbd>↑</kbd><kbd>↓</kbd> לנווט · <kbd>SPACE</kbd> לסמן כקראתי · <kbd>ENTER</kbd> לפרטים
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useAliyahNavigation } from '../composables/useAliyahNavigation'
import { useData } from '../composables/useData'
import AliyahReadingItem from './AliyahReadingItem.vue'

const props = defineProps({
  parasha: {
    type: String,
    required: true
  },
  verses: {
    type: Array,
    required: true
  }
})

const {
  currentPosition,
  aliyotData,
  initializeParsha,
  isPhaseCompleted,
  completeCurrentPhase,
  handleSpacebarPress: handleAliyahSpacebarPress,
  getAliyotWithStatus,
  getCurrentPhase
} = useAliyahNavigation()

const readingItems = ref([])
const selectedIndex = ref(0) // For keyboard navigation

/**
 * Generate reading items from aliyot data
 * Creates 3 items per aliyah: rishon, sheni, shlishi
 */
function generateReadingItems() {
  const items = []
  const aliyotWithStatus = getAliyotWithStatus()

  aliyotWithStatus.forEach((aliyah) => {
    // Get verses for this aliyah from props.verses
    const aliyahVerses = getVersesForAliyah(aliyah)

    // Rishon (first Torah reading)
    items.push({
      id: `${props.parasha}-a${aliyah.number}-rishon`,
      aliyahNum: aliyah.number,
      phase: 'rishon',
      phaseLabel: 'ראשון',
      type: 'torah',
      label: `עליה ${toHebrewNum(aliyah.number)} - ראשון`,
      verses: aliyahVerses,
      verseRange: getVerseRange(aliyah)
    })

    // Sheni (second Torah reading)
    items.push({
      id: `${props.parasha}-a${aliyah.number}-sheni`,
      aliyahNum: aliyah.number,
      phase: 'sheni',
      phaseLabel: 'שני',
      type: 'torah',
      label: `עליה ${toHebrewNum(aliyah.number)} - שני`,
      verses: aliyahVerses,
      verseRange: getVerseRange(aliyah)
    })

    // Shlishi (Targum reading)
    items.push({
      id: `${props.parasha}-a${aliyah.number}-shlishi`,
      aliyahNum: aliyah.number,
      phase: 'shlishi',
      phaseLabel: 'שלישי',
      type: 'targum',
      label: `עליה ${toHebrewNum(aliyah.number)} - תרגום`,
      verses: aliyahVerses,
      verseRange: getVerseRange(aliyah)
    })
  })

  return items
}

/**
 * Get all verses in an aliyah based on start/end positions
 * Note: aliyah.start/end are 1-indexed from aliyot.json, but verse indices are 0-indexed
 */
function getVersesForAliyah(aliyah) {
  // Convert from 1-indexed (JSON) to 0-indexed (verses)
  const [startPerek, startPasuk] = aliyah.start.map(i => i - 1)
  const [endPerek, endPasuk] = aliyah.end.map(i => i - 1)

  return props.verses.filter((verse) => {
    const versePerek = verse.perekNum
    const versePasuk = verse.pasukNum

    // Check if verse is within aliyah range
    if (versePerek < startPerek || versePerek > endPerek) return false
    if (versePerek === startPerek && versePasuk < startPasuk) return false
    if (versePerek === endPerek && versePasuk > endPasuk) return false

    return true
  })
}

/**
 * Get human-readable verse range (e.g., "בראשית א:א-ה")
 */
function getVerseRange(aliyah) {
  const [startPerek, startPasuk] = aliyah.start
  const [endPerek, endPasuk] = aliyah.end

  // Get Hebrew perek names
  const startVerseNum = toHebrewNum(startPasuk + 1)
  const endVerseNum = toHebrewNum(endPasuk + 1)
  const perekNum = toHebrewNum(startPerek + 1)

  if (startPerek === endPerek) {
    return `${perekNum}:${startVerseNum}-${endVerseNum}`
  } else {
    return `${toHebrewNum(startPerek + 1)}:${startVerseNum} - ${toHebrewNum(endPerek + 1)}:${endVerseNum}`
  }
}

/**
 * Convert number to Hebrew numeral
 */
function toHebrewNum(num) {
  if (num < 1 || num > 9999) return num.toString()

  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת']

  if (num === 15 || num === 16) {
    // Special cases for 15 and 16
    return ones[9] + ones[num - 9]
  }

  let result = ''

  if (num >= 100) {
    const h = Math.floor(num / 100)
    result += hundreds[h]
    num = num % 100
  }

  if (num >= 10) {
    const t = Math.floor(num / 10)
    result += tens[t]
    num = num % 10
  }

  result += ones[num]

  return result
}

/**
 * Check if item is currently active
 */
function isCurrent(item) {
  if (!currentPosition.value) return false
  return (
    currentPosition.value.aliyahNum === item.aliyahNum &&
    currentPosition.value.phase === item.phase
  )
}

/**
 * Check if item is completed
 */
function isCompleted(item) {
  return isPhaseCompleted(item.aliyahNum, item.phase)
}

/**
 * Select and jump to a specific reading item
 */
function selectAndJump(idx, item) {
  selectedIndex.value = idx
  console.log('Selected:', item.label)
}

/**
 * Scroll selected item into view
 */
function scrollToSelected() {
  nextTick(() => {
    const el = document.querySelector(`[data-item-index="${selectedIndex.value}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

/**
 * Handle keyboard navigation
 */
function handleKeydown(event) {
  // Don't handle if typing in inputs
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT' || event.target.tagName === 'TEXTAREA') return

  const maxIndex = readingItems.value.length - 1

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      event.stopPropagation()
      if (selectedIndex.value < maxIndex) {
        selectedIndex.value++
        scrollToSelected()
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      event.stopPropagation()
      if (selectedIndex.value > 0) {
        selectedIndex.value--
        scrollToSelected()
      }
      break
    case 'ArrowRight':
      event.preventDefault()
      event.stopPropagation()
      // Move to next aliyah (3 items per aliyah)
      if (selectedIndex.value < maxIndex) {
        selectedIndex.value = Math.min(selectedIndex.value + 3, maxIndex)
        scrollToSelected()
      }
      break
    case 'ArrowLeft':
      event.preventDefault()
      event.stopPropagation()
      // Move to previous aliyah (3 items per aliyah)
      if (selectedIndex.value > 0) {
        selectedIndex.value = Math.max(selectedIndex.value - 3, 0)
        scrollToSelected()
      }
      break
    case ' ':
      event.preventDefault()
      event.stopPropagation()
      completeCurrentPhase()
      break
    case 'Enter':
      event.preventDefault()
      event.stopPropagation()
      // Could expand to show details or enter focus mode in future
      const item = readingItems.value[selectedIndex.value]
      if (item) {
        console.log('Enter pressed on:', item.label)
      }
      break
  }
}

/**
 * Initialize component
 */
onMounted(async () => {
  await initializeParsha(props.parasha)
  readingItems.value = generateReadingItems()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

/**
 * Regenerate items if verses change
 */
watch(
  () => props.verses,
  () => {
    readingItems.value = generateReadingItems()
  },
  { deep: true }
)

/**
 * Computed properties
 */
const completedCount = computed(() => {
  if (!readingItems.value) return 0
  return readingItems.value.filter((item) => isCompleted(item)).length
})

const progressPercent = computed(() => {
  if (readingItems.value.length === 0) return 0
  return Math.round((completedCount.value / readingItems.value.length) * 100)
})
</script>

<style scoped>
.aliyah-reading-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
  direction: rtl;
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
  .aliyah-reading-container {
    padding: 0.75rem;
  }

  .reading-items-list {
    gap: 0.75rem;
  }
}
</style>
