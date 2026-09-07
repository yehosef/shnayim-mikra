<template>
  <div>
    <!-- Header -->
    <div class="header">
      <div class="container">
        <div class="title-section">
          <h1>פרשת {{ parashaHe }}</h1>
          <DailyGuide v-if="aliyotEntry" :guide="guide" :status="status" :isHebrew="isHebrew" />
          <!-- The other week is always one click away (coming week, or the one
               we are still finishing during the lenient Sunday-Tuesday window) -->
          <p v-if="otherWeek">
            <a :href="`#${otherWeek.route}`">{{ otherWeekText }}</a>
          </p>
          <!-- aliyot.json failed to load: the aliyah bar and the pointer are
               missing until it succeeds, so say so and offer a retry -->
          <p v-if="aliyotError && !aliyotData">
            <span>{{ isHebrew ? 'לא ניתן לטעון את גבולות העליות.' : 'Could not load aliyah boundaries.' }}</span>
            <button type="button" class="btn" @click="retryAliyot">{{ isHebrew ? 'נסה שוב' : 'Retry' }}</button>
          </p>
          <AliyahBar
            v-if="aliyotEntry"
            :stats="aliyahStatsList"
            :currentN="currentAliyahN"
            :selectedN="settings.displayMode === 'aliyah' ? settings.currentAliyah : null"
            :guideAliyot="guide.aliyot"
            :isHebrew="isHebrew"
            @select="selectAliyah"
          />
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

    <!-- Focus Mode (Fullscreen) — never over stale verses. A parsha change
         closes it and empties `data` (see the watcher), so an in-flight or
         failed navigation can no longer render the old parsha's verses while
         writing progress under the new route. Gating on `loading` itself would
         unmount it on a same-parsha layer reload (toggling Rashi from inside
         focus mode) and throw the reader back to where they entered. -->
    <FocusMode
      v-if="showFocusMode && !error && displayVerses.length > 0"
      :verses="displayVerses"
      :startIndex="focusIndex"
      :parasha="parasha"
      :settings="settings"
      :pointerFn="() => scopedPointer"
      :aliyahOf="aliyahLabelFor"
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
        :isPointer="isPointer(verse.perekNum, verse.pasukNum)"
        :inCurrentAliyah="inCurrentAliyah(verse.perekNum, verse.pasukNum)"
        :data-verse-index="i"
        @focus="enterFocusMode"
        @click="selectVerse(i)"
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
import { useAliyot } from '../composables/useAliyot'
import { useReadingState } from '../composables/useReadingState'
import { useDailyGuide, useNow } from '../composables/useDailyGuide'
import { parseKey, isRouteComplete } from '../lib/progressMath'
import { toHebrew } from '../utils/hebrewUtils'
import VerseView from './VerseView.vue'
import FocusMode from './FocusMode.vue'
import SettingsModal from './SettingsModal.vue'
import AliyahBar from './AliyahBar.vue'
import DailyGuide from './DailyGuide.vue'

const props = defineProps({
  parasha: {
    type: String,
    required: true
  },
  // Resolved by App.vue: { route, shabbat, late, previous, next }. Optional so
  // the component still renders standalone.
  week: {
    type: Object,
    default: null
  }
})

const { loadParsha, loading, error, data, chapterLengths, loadedChumash } = useData()
const { settings } = useSettings()
const { parshiyotList, getDefaultWeek } = useParsha()
const { progress, setVerseProgress, getVerseProgress } = useProgress()
const { getAliyot, aliyotData, aliyotError, retryAliyot, verseInAliyah, aliyahFor } = useAliyot()
const now = useNow()

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
  // Reading ahead in focus mode moved the pointer; without re-seeding, the
  // list-view selection still points at something already read and the next
  // Space would un-mark it.
  seedSelectionFromPointer()
}

const parashaHe = computed(() => {
  return parshiyotList.find(p => p.route === props.parasha)?.he || ''
})

const isHebrew = computed(() => settings.value.interfaceLanguage === 'he')

// Aliyah boundaries come from the generated aliyot.json (never from parshiyot.js)
const aliyotEntry = computed(() => (aliyotData.value ? getAliyot(props.parasha) : null))

// Number of aliyot for the current parsha (read from the data; 7 until loaded)
const aliyahCount = computed(() => aliyotEntry.value?.aliyot.length || 7)

// Derived reading state: per-aliyah rollups, pointer, containing aliyah.
// `pointer` stays the whole-parsha truth (AliyahBar's current chip);
// `scopedPointer` is the same thing narrowed to the aliyah on screen.
const {
  aliyahStatsList,
  scopedPointer,
  currentAliyahN,
  isPointer,
  inCurrentAliyah
} = useReadingState({
  aliyotEntry: () => aliyotEntry.value,
  chapterLengths: () => chapterLengths.value,
  loadedChumash: () => loadedChumash.value,
  progress: () => progress.value[props.parasha] || {},
  style: () => settings.value.readingStyle,
  scope: () => (settings.value.displayMode === 'aliyah' ? settings.value.currentAliyah : null)
})

// Which week the app considers current. App.vue passes it in; the fallback
// keeps this component usable on its own.
const isRouteDone = (route) => {
  const entry = aliyotData.value ? getAliyot(route) : null
  if (!entry) return true
  return isRouteComplete(progress.value[route] || {}, entry)
}
const week = computed(() => {
  if (props.week) return props.week
  void now.value
  return getDefaultWeek(settings.value.location, isRouteDone)
})

// The Shabbat the parsha ON SCREEN is read on — the coming one, or last week's
// while we are still finishing it. Without this, urgency could only ever look
// forward and 'late' / 'past' were unreachable.
const viewedShabbat = computed(() => {
  const w = week.value
  if (!w) return null
  if (w.next?.route === props.parasha) return w.next.shabbat
  if (w.previous?.route === props.parasha) return w.previous.shabbat
  if (w.route === props.parasha) return w.shabbat
  return null
})

// A link to the other week is always available: the coming week from anywhere
// else, and last week's while the coming week is what we are showing.
const otherWeek = computed(() => {
  const w = week.value
  if (!w?.next?.route) return null
  if (props.parasha !== w.next.route) return { route: w.next.route, kind: 'next' }
  if (w.previous?.route && w.previous.route !== w.next.route) {
    return { route: w.previous.route, kind: 'previous' }
  }
  return null
})

const otherWeekText = computed(() => {
  const o = otherWeek.value
  if (!o) return ''
  const name = parshiyotList.find(p => p.route === o.route)?.he || o.route
  if (o.kind === 'next') return isHebrew.value ? `לשבוע הבא: ${name}` : `Coming week: ${name}`
  return isHebrew.value ? `לשבוע שעבר: ${name}` : `Last week: ${name}`
})

// Advisory daily guide (never gates anything)
const { guide, status } = useDailyGuide({
  aliyahCount: () => aliyahCount.value,
  // urgency applies to whichever week's parsha is on screen
  shabbat: () => viewedShabbat.value,
  route: () => props.parasha,
  location: () => settings.value.location
})

// Hebrew label of the aliyah containing a verse (for markers and focus header)
const aliyahLabelFor = (perek, pasuk) => {
  const a = aliyahFor(aliyotEntry.value, perek, pasuk)
  return a ? aliyahNames[a.n - 1] : null
}

const selectAliyah = (n) => {
  settings.value.displayMode = 'aliyah'
  settings.value.currentAliyah = n
}

// Filter verses based on display mode, and label the first verse of each aliyah
const displayVerses = computed(() => {
  const entry = aliyotEntry.value
  let verses = data.value

  if (settings.value.displayMode === 'aliyah' && entry) {
    const aliyah = entry.aliyot[settings.value.currentAliyah - 1]
    if (aliyah) verses = verses.filter(v => verseInAliyah(aliyah, v.perekNum, v.pasukNum))
  }

  const labelled = entry ? labelAliyot(verses, entry) : verses
  return withLeadingPerek(labelled)
})

// useData attaches a chapter label only to pasuk 0 of a chapter, so a list that
// starts mid-chapter (any single aliyah, and the 24 parshiyot that start
// mid-chapter) would show no chapter at all. Give the first displayed verse a
// label without touching the underlying verse objects.
const withLeadingPerek = (verses) => {
  const first = verses[0]
  if (!first || first.perek) return verses
  const copy = verses.slice()
  copy[0] = { ...first, perek: toHebrew(first.perekNum + 1) }
  return copy
}

const labelAliyot = (verses, entry) => {
  const starts = new Map(entry.aliyot.map(a => [`${a.start[0]}:${a.start[1]}`, aliyahNames[a.n - 1]]))
  return verses.map(v => {
    const aliya = starts.get(`${v.perekNum}:${v.pasukNum}`) || null
    return aliya === (v.aliya || null) ? v : { ...v, aliya }
  })
}

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
  // Focus mode holds its own index into the old verse list, and the old verses
  // would be rendered while progress is written under the new route.
  showFocusMode.value = false
  data.value = []
  // Recovers from a first fetch of aliyot.json that failed (no-op once loaded)
  retryAliyot()
  await loadParsha(newParasha, {
    showRashi: settings.value.showRashi,
    targumType: settings.value.targumType
  })
}, { immediate: true })

// Reload when the layers we fetch change (showRashi, or picking Rashi as the
// obligation layer — an array source, so unrelated settings writes don't reload)
watch(
  () => [settings.value.showRashi, settings.value.targumType],
  async () => {
    await loadParsha(props.parasha, {
      showRashi: settings.value.showRashi,
      targumType: settings.value.targumType
    })
  }
)

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
  if (!wasRead) advanceSelection()
}

const phaseOf = (ptr) => (ptr.phase === 'hebrew1' ? 1 : ptr.phase === 'hebrew2' ? 2 : 3)

// Move the keyboard selection to the pointer (next unread step in the active
// reading style).
//
// In 'verse' style the pointer only ever moves forward, so a backward pointer
// means it is behind us and we step on by hand. In 'aliyah' style the pointer
// legitimately jumps back to the top of the same aliyah at every pass boundary
// (all of hebrew1, then all of hebrew2, then all of targum) — refusing that
// abandoned the pointer after the first pass, which silently discarded the
// chosen reading style. So we follow it inside the same aliyah block.
const advanceSelection = () => {
  const ptr = scopedPointer.value
  if (ptr) {
    const [p, v] = parseKey(ptr.key)
    const i = displayVerses.value.findIndex(x => x.perekNum === p && x.pasukNum === v)
    const current = displayVerses.value[selectedIndex.value]
    const sameAliyah =
      !!current &&
      aliyahFor(aliyotEntry.value, p, v)?.n ===
        aliyahFor(aliyotEntry.value, current.perekNum, current.pasukNum)?.n
    const follow =
      i >= 0 && (i >= selectedIndex.value || (settings.value.readingStyle === 'aliyah' && sameAliyah))
    if (follow) {
      selectedIndex.value = i
      selectedPhase.value = phaseOf(ptr)
      return
    }
  }
  const maxIndex = displayVerses.value.length - 1
  if (selectedPhase.value < 3) {
    selectedPhase.value++
  } else if (selectedIndex.value < maxIndex) {
    selectedIndex.value++
    selectedPhase.value = 1
  }
}

// Clicking the card chrome selects that verse. The phase must move with the
// index, or the pointer marker and the actual selection disagree and the next
// Space un-marks something already read.
const selectVerse = (i) => {
  const verse = displayVerses.value[i]
  if (!verse) return
  selectedIndex.value = i
  const rec = getVerseProgress(props.parasha, getVerseKey(verse))
  selectedPhase.value = !rec.hebrew1 ? 1 : !rec.hebrew2 ? 2 : 3
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
  if (!wasRead) advanceSelection()
}

// Keyboard navigation for list view - navigates by phase (section) within verses
const handleKeydown = (e) => {
  // Don't handle if focus mode is active, settings open, or typing in inputs
  if (showFocusMode.value || showSettings.value) return
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
  // Never swallow browser/OS shortcuts (Alt/Cmd+Arrow = Back, Ctrl+Space, ...)
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.shiftKey && e.key === ' ') return

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
      }
      break
    case 'ArrowRight':
      e.preventDefault()
      // RTL: right = backward (previous verse)
      if (selectedIndex.value > 0) {
        selectedIndex.value--
      }
      break
    case 'ArrowLeft':
      e.preventDefault()
      // RTL: left = forward (next verse)
      if (selectedIndex.value < maxIndex) {
        selectedIndex.value++
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

// Scroll the SELECTED PHASE into view, not just the verse: at large font sizes
// a phase change alone can move the selection off-screen, and the arrow keys
// have already cancelled the page's own scrolling.
const scrollToSelected = () => {
  nextTick(() => {
    const verseEl = document.querySelector(`[data-verse-index="${selectedIndex.value}"]`)
    if (!verseEl) return
    const el = verseEl.querySelector('.phase-selected') || verseEl
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

// Every selection change — index or phase, keyboard or click — scrolls.
watch([selectedIndex, selectedPhase], scrollToSelected)

// Seed the keyboard selection at the reading pointer (the next unread step)
// so Space always marks "the next thing to read". Falls back to the top.
const seedSelectionFromPointer = () => {
  const ptr = scopedPointer.value
  if (ptr) {
    const [p, v] = parseKey(ptr.key)
    const i = displayVerses.value.findIndex(x => x.perekNum === p && x.pasukNum === v)
    if (i >= 0) {
      selectedIndex.value = i
      selectedPhase.value = ptr.phase === 'hebrew1' ? 1 : ptr.phase === 'hebrew2' ? 2 : 3
      return
    }
  }
  selectedIndex.value = 0
  selectedPhase.value = 1
}

// Re-seed when display mode / aliyah changes, or when the verse list is (re)loaded
watch([() => settings.value.displayMode, () => settings.value.currentAliyah], seedSelectionFromPointer)
watch(() => displayVerses.value.length, seedSelectionFromPointer)
watch(aliyotEntry, seedSelectionFromPointer)
watch(loading, (isLoading) => { if (!isLoading) seedSelectionFromPointer() })

// A transient offline start leaves aliyot.json unloaded for the session
const onOnline = () => { retryAliyot() }

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('online', onOnline)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('online', onOnline)
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
