<template>
  <div>
    <!-- Header -->
    <div ref="headerEl" class="header">
      <div class="container">
        <div class="title-section">
          <h1>פרשת {{ parashaHe }}</h1>
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
            :guideAliyot="todayAliyot"
            :isHebrew="isHebrew"
            @select="selectAliyah"
          />
          <!-- Aliyah Selector (shown in aliyah mode) -->
          <div v-if="settings.displayMode === 'aliyah'" class="aliyah-selector">
            <span class="aliyah-label">{{ isHebrew ? 'עלייה:' : 'Aliyah:' }}</span>
            <select v-model="settings.currentAliyah" class="aliyah-dropdown" dir="rtl" lang="he" :aria-label="t('עלייה', 'Aliyah')">
              <option v-for="n in aliyahCount" :key="n" :value="n">{{ aliyahNames[n - 1] }}</option>
            </select>
          </div>
          <!-- Progress Indicator. Its caption row also carries the advisory
               status pill (Shabbat / after Shabbat only) and the link to the
               other week, so neither needs a header line of its own. -->
          <div v-if="displayVerses.length > 0 || otherWeek" class="progress-bar">
            <div class="progress-row">
              <div v-if="displayVerses.length > 0" class="progress-text">
                {{ isHebrew ? 'התקדמות:' : 'Progress:' }} <bdi dir="ltr" class="progress-num">{{ completedCount }}/{{ displayVerses.length }} ({{ progressPercent }}%)</bdi>
              </div>
              <DailyGuide v-if="aliyotEntry" :status="status" :complete="viewedComplete" :isHebrew="isHebrew" />
              <!-- The coming week is always one click away from any other
                   parsha; last week only while it is started and unfinished -->
              <a v-if="otherWeek" class="other-week-link" :href="`#${otherWeek.route}`">{{ otherWeekText }}</a>
            </div>
            <div v-if="displayVerses.length > 0" class="progress-track">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
          </div>
        </div>
        <div class="controls">
          <button
            @click="showSettings = !showSettings"
            class="btn"
            :title="t('הגדרות', 'Settings')"
            :aria-label="t('הגדרות', 'Settings')"
          >⚙️</button>
          <!-- ✓ every piece of the parsha is read, ◐ partly read (derived from
               progress, see parshaMarks) -->
          <select
            v-model="selectedParsha"
            @change="navigateToParsha"
            class="parsha-select"
            dir="rtl"
            lang="he"
            :title="t('✓ הושלמה · ◐ בקריאה', '✓ finished · ◐ in progress')"
            :aria-label="t('בחירת פרשה', 'Choose a parsha')"
          >
            <option v-for="p in parshiyotList" :key="p.route" :value="p.route">{{ p.he }}{{ parshaMarks[p.route] }}</option>
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
    <!-- The store rejected the last write (quota, blocked storage): marks made in
         this session will not survive a reload. Advisory only — nothing is hidden. -->
    <div v-if="persistFailed" class="error" role="alert">
      {{ isHebrew
        ? 'לא ניתן לשמור את ההתקדמות בדפדפן זה — הסימונים יאבדו בטעינה מחדש.'
        : 'Progress could not be saved in this browser — marks made now will be lost on reload.' }}
    </div>

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
      :pointerAt="isPointer"
      :inScopeAt="inCurrentAliyah"
      @exit="exitFocusMode"
    />

    <!-- Content -->
    <div v-if="!loading && !error && !showFocusMode" class="content">
      <!-- One pasuk at a time. A pasuk change uses the shared motion
           (src/lib/motion.js, motion-* classes in src/style.css): forward
           enters from the left, backward from the right. -->
      <template v-if="pasukMode">
        <!-- Arrow row above the card. RTL: previous on the right, next on the left. -->
        <div class="pasuk-nav-row">
          <button
            class="pasuk-nav"
            :disabled="selectedIndex <= 0"
            @click.stop="stepVerse(-1)"
            :title="t('פסוק קודם (→)', 'Previous pasuk (→)')"
            :aria-label="t('פסוק קודם', 'Previous pasuk')"
          >→</button>
          <!-- Disabled until the aliyah boundaries have loaded: before that the
               aliyah filter cannot apply and the whole parsha would show. -->
          <button class="mode-toggle" :disabled="!aliyotEntry" @click.stop="switchDisplayMode('aliyah')">
            {{ isHebrew ? 'הצג את העלייה' : 'Show the aliyah' }}
          </button>
          <button
            class="pasuk-nav"
            :disabled="selectedIndex >= displayVerses.length - 1"
            @click.stop="stepVerse(1)"
            :title="t('פסוק הבא (←)', 'Next pasuk (←)')"
            :aria-label="t('פסוק הבא', 'Next pasuk')"
          >←</button>
        </div>
        <!-- The wrapper carries the motion classes: VerseView's own scoped
             `transition` would otherwise override them. -->
        <Transition
          :name="pasukTransition"
          mode="out-in"
          @before-leave="onPasukMotionStart"
          @before-enter="onPasukMotionStart"
          @enter="onPasukEnter"
          @after-enter="onPasukMotionEnd"
          @enter-cancelled="onPasukMotionEnd"
        >
          <div
            v-if="visibleVerses[0]"
            :key="visiblePasukKey"
            class="pasuk-card"
          >
            <VerseView v-bind="verseBindings(visibleVerses[0])" />
          </div>
        </Transition>
      </template>
      <template v-else>
        <div class="pasuk-nav-row">
          <button class="mode-toggle" @click.stop="switchDisplayMode('pasuk')">
            {{ isHebrew ? 'פסוק אחד בכל פעם' : 'One pasuk at a time' }}
          </button>
        </div>
        <VerseView
          v-for="item in visibleVerses"
          :key="`${item.verse.perekNum}-${item.verse.pasukNum}`"
          v-bind="verseBindings(item)"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useData } from '../composables/useData'
import { useSettings } from '../composables/useSettings'
import { useParsha } from '../composables/useParsha'
import { useProgress } from '../composables/useProgress'
import { useCycles } from '../composables/useCycles'
import { useAliyot } from '../composables/useAliyot'
import { useReadingState } from '../composables/useReadingState'
import { useDailyGuide, useNow } from '../composables/useDailyGuide'
import { parseKey, routeProgressState, catchUpPending } from '../lib/progressMath'
import {
  nextListSelection,
  seedListSelection,
  keyboardMarkAction,
  listPhaseDown,
  listPhaseUp,
  selectionAfterViewChange,
  pasukOrdinal
} from '../lib/listStep'
import { neighbourIndex } from '../lib/focusStep'
import { listKeyAction, mayAdvance } from '../lib/inputGuard'
import {
  MARK_HOLD_MS,
  MOTION_GUARD_MAX_MS,
  TRANSITION_FORWARD,
  classifyMove,
  transitionNameFor,
  holdBeforeMove
} from '../lib/motion'
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
const { progress, externalRevision, persistFailed, setVerseProgress, getVerseProgress } = useProgress()
const { bulkRevision } = useCycles()
const { getAliyot, aliyotData, aliyotError, retryAliyot, verseInAliyah, aliyahFor } = useAliyot()
const now = useNow()

const showSettings = ref(false)
const selectedParsha = ref(props.parasha)
const showFocusMode = ref(false)
const focusIndex = ref(0)
const selectedIndex = ref(0) // Which verse is selected
// Which phase within the verse: 1=hebrew1, 2=hebrew2, 3=targum, and 0 = none,
// used when everything on screen is already read so that Space has nothing to
// un-mark (VerseView already treats 0 as "no phase highlighted").
const selectedPhase = ref(1)
// False while the selection is only the placeholder seeded before the reading
// pointer could be derived (aliyot.json / the chumash still loading) and the
// reader has not moved it. Such a selection follows the pointer once it
// appears; a selection the reader made, or one seeded from the pointer, stays
// on its pasuk when the view changes (selectionAfterViewChange).
const anchored = ref(false)

// One-pasuk mode motion: the hold after a mark that changes the pasuk, and the
// guard that keeps a press from marking a card that is not fully shown yet.
const holding = ref(false)
let holdTimer = null
const pasukTransition = ref(TRANSITION_FORWARD)
const pasukMoving = ref(false)
let pasukGuardTimer = null
// Set by an advance just before it moves the selection, so a backward move
// (the jump back to the top of the aliyah) is classified as such.
let moveIsAdvance = false

const cancelHold = () => {
  if (holdTimer !== null) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
  holding.value = false
}

// Aliyah names in Hebrew
const aliyahNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי']

const enterFocusMode = (index) => {
  cancelHold()
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
const t = (he, en) => (isHebrew.value ? he : en)

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
  scopeComplete,
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
// keeps this component usable on its own. Same rule as App.vue: only a parsha
// that was started and not finished keeps the reader on last week.
const isRouteDone = (route) => {
  const entry = aliyotData.value ? getAliyot(route) : null
  return !catchUpPending(progress.value[route] || {}, entry)
}
// Mark per parsha for the picker: ✓ when every piece is read, ◐ when partly
// read, nothing otherwise. Judged from stored progress and the aliyot entry's
// verse ranges (routeProgressState), so no parsha text has to be loaded; a
// parsha with no aliyot entry yet (aliyot.json still loading) gets no mark.
const parshaMarks = computed(() => {
  const marks = {}
  for (const p of parshiyotList) {
    const state = aliyotData.value
      ? routeProgressState(progress.value[p.route] || {}, getAliyot(p.route))
      : null
    marks[p.route] = state === 'complete' ? ' ✓' : state === 'partial' ? ' ◐' : ''
  }
  return marks
})

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

// The link to the other week: the coming week from any other parsha (the way
// back), and last week's from the coming week only while last week is started
// and unfinished. A reader who never began it, or finished it, has no reason
// to go back.
const otherWeek = computed(() => {
  const w = week.value
  if (!w?.next?.route) return null
  if (props.parasha !== w.next.route) return { route: w.next.route, kind: 'next' }
  const prev = w.previous?.route
  if (prev && prev !== w.next.route && aliyotData.value &&
      catchUpPending(progress.value[prev] || {}, getAliyot(prev))) {
    return { route: prev, kind: 'previous' }
  }
  return null
})

const otherWeekText = computed(() => {
  const o = otherWeek.value
  if (!o) return ''
  const name = `\u2068${parshiyotList.find(p => p.route === o.route)?.he || o.route}\u2069`
  if (o.kind === 'next') return isHebrew.value ? `לשבוע הבא: ${name}` : `Coming week: ${name}`
  return isHebrew.value ? `לשבוע שעבר: ${name}` : `Last week: ${name}`
})

// Advisory daily guide (never gates anything)
const { guide: weekGuide, status } = useDailyGuide({
  aliyahCount: () => aliyahCount.value,
  // urgency applies to whichever week's parsha is on screen
  shabbat: () => viewedShabbat.value,
  route: () => props.parasha,
  location: () => settings.value.location
})

// True while the parsha on screen is the one we are still finishing from LAST
// week (the lenient Sunday-Tuesday window).
const viewingLateWeek = computed(() => {
  const w = week.value
  if (!w?.late) return false
  return w.previous?.route === props.parasha && w.next?.route !== props.parasha
})

// The per-day suggestion ("today: rishon and sheni") is a schedule for the
// COMING Shabbat, so it says nothing about last week's parsha: during the
// lenient window it would label aliyot 1-2 of a parsha that is already overdue
// as today's reading, right next to the 'late' status. Show the catch-up
// variant instead — still advisory, still nothing hidden or gated.
const guide = computed(() =>
  viewingLateWeek.value ? { aliyot: [], review: true } : weekGuide.value
)

// Today's aliyot for the chips' "today" tag: only on the coming week's parsha
// (the schedule belongs to the coming Shabbat). AliyahBar drops the tag from
// an aliyah once it is fully read. Advisory only.
const todayAliyot = computed(() =>
  week.value?.next?.route === props.parasha ? guide.value.aliyot : []
)

// The parsha on screen is fully read: the status pill has nothing to urge.
const viewedComplete = computed(() =>
  aliyotEntry.value
    ? routeProgressState(progress.value[props.parasha] || {}, aliyotEntry.value) === 'complete'
    : false
)

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

// What the list actually renders. 'pasuk' mode ("verse by verse") shows ONE
// pasuk — the selected one, i.e. the next thing to read — twice plus its
// targum, and nothing else; the other modes render the whole scope. Selection,
// pointer and keyboard logic all keep working on the full `displayVerses`
// index space; only the rendering is narrowed. The single verse always
// carries its chapter label, since there is no list context to infer it from.
const pasukMode = computed(() => settings.value.displayMode === 'pasuk')

const visibleVerses = computed(() => {
  const verses = displayVerses.value
  if (!pasukMode.value) return verses.map((verse, i) => ({ verse, i }))
  if (verses.length === 0) return []
  const i = Math.min(Math.max(selectedIndex.value, 0), verses.length - 1)
  const verse = verses[i]
  return [{ verse: verse.perek ? verse : { ...verse, perek: toHebrew(verse.perekNum + 1) }, i }]
})

// Identity of the one pasuk on screen in one-pasuk mode ('perek-pasuk').
const visiblePasukKey = computed(() => {
  if (!pasukMode.value) return null
  const v = visibleVerses.value[0]?.verse
  return v ? `${v.perekNum}-${v.pasukNum}` : null
})

const ordinalOfKey = (key) => {
  const [p, v] = key.split('-').map(Number)
  return pasukOrdinal(p, v)
}

// Pick the direction of a pasuk change before the new card renders (a 'pre'
// watcher runs before the render that swaps the keyed card).
watch(visiblePasukKey, (key, old) => {
  const advance = moveIsAdvance
  moveIsAdvance = false
  if (!key || !old) return
  const move = classifyMove({
    from: { index: ordinalOfKey(old) },
    to: { index: ordinalOfKey(key) },
    advance
  })
  pasukTransition.value = transitionNameFor(move)
})

// True from the moment the old card starts leaving until the new one has
// finished entering (mode="out-in" runs leave, then enter, back to back). A
// Space or tap then must not mark anything: it would land on a card that is
// not the one the reader is looking at.
const pasukBusy = computed(() => pasukMode.value && pasukMoving.value)

const clearPasukGuardTimer = () => {
  if (pasukGuardTimer !== null) {
    clearTimeout(pasukGuardTimer)
    pasukGuardTimer = null
  }
}

const onPasukMotionStart = () => {
  pasukMoving.value = true
  clearPasukGuardTimer()
  // Safety net: never leave input blocked if after-enter does not fire.
  pasukGuardTimer = setTimeout(() => {
    pasukGuardTimer = null
    pasukMoving.value = false
  }, MOTION_GUARD_MAX_MS)
}

// Scroll only once the new card is in the page; before that the lookup finds
// nothing and a long previous pasuk leaves the new one scrolled down.
const onPasukEnter = () => {
  scrollToSelected()
}

const onPasukMotionEnd = () => {
  clearPasukGuardTimer()
  pasukMoving.value = false
}

// Props + listeners for one VerseView; shared by the one-pasuk and list renders.
const verseBindings = ({ verse, i }) => ({
  verse,
  index: i,
  parasha: props.parasha,
  settings: settings.value,
  isSelected: selectedIndex.value === i,
  selectedPhase: selectedIndex.value === i ? selectedPhase.value : 0,
  isPointer: isPointer(verse.perekNum, verse.pasukNum),
  inCurrentAliyah: inCurrentAliyah(verse.perekNum, verse.pasukNum),
  'data-verse-index': i,
  onFocus: enterFocusMode,
  onClick: () => selectVerse(i),
  onPhaseClick: (eventData) => handlePhaseClick(i, eventData),
  onToggleComplete: () => toggleVerseComplete(i)
})

// One-tap switch between "one pasuk" and "the aliyah". The selection stays on
// the same pasuk across the switch (the mode watchers re-seed from the pointer,
// so it is put back by key afterwards); going to the aliyah view opens the
// aliyah that pasuk is in, which is what "where am I in the aliyah" means.
const switchDisplayMode = async (mode) => {
  cancelHold()
  // Without aliyah boundaries the aliyah filter cannot apply (the button is
  // disabled too; this also covers any other caller).
  if (mode === 'aliyah' && !aliyotEntry.value) return
  const verse = displayVerses.value[selectedIndex.value]
  const phase = selectedPhase.value
  if (mode === 'aliyah' && verse && aliyotEntry.value) {
    const n = aliyahFor(aliyotEntry.value, verse.perekNum, verse.pasukNum)?.n
    if (n) settings.value.currentAliyah = n
  }
  settings.value.displayMode = mode
  await nextTick()
  if (!verse) return
  const i = displayVerses.value.findIndex(x => x.perekNum === verse.perekNum && x.pasukNum === verse.pasukNum)
  if (i < 0) return
  selectedIndex.value = i
  selectedPhase.value = phase
}

// The on-screen arrows and ArrowLeft / ArrowRight (next is on the left).
// Landing on a pasuk selects its first unread reading (selectVerse), so Space
// keeps meaning "the next thing to read" — the arrow keys used to keep the old
// phase, so Space could mark the new pasuk's translation first.
const stepVerse = (delta) => {
  cancelHold()
  const i = neighbourIndex({ index: selectedIndex.value, delta, lastIndex: displayVerses.value.length - 1 })
  if (i === null) return
  selectVerse(i)
}

// useData attaches a chapter label only to pasuk 0 of a chapter, so a list that
// starts mid-chapter (any single aliyah, and the 24 parshiyot that start
// mid-chapter) would show no chapter at all. Give the first displayed verse a
// label without touching the underlying verse objects.
function withLeadingPerek(verses) {
  const first = verses[0]
  if (!first || first.perek) return verses
  const copy = verses.slice()
  copy[0] = { ...first, perek: toHebrew(first.perekNum + 1) }
  return copy
}

function labelAliyot(verses, entry) {
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
  cancelHold()
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

// Whether a tap / Space / the corner check may mark now. In one-pasuk mode a
// mark that changes the pasuk holds first, and the next card then enters; a
// press in either window would land on a card that is not the one shown (the
// second tap of a double tap used to un-mark the translation just marked).
const canMarkNow = () => mayAdvance({ holding: holding.value, moving: pasukBusy.value })

// Handle click on a phase in VerseView
const handlePhaseClick = (verseIndex, { phase, field, wasRead }) => {
  if (!canMarkNow()) return
  anchored.value = true
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

// The corner check on a card: mark the whole pasuk (all three readings) when
// it is incomplete, clear all three when it is complete. Marking advances the
// selection like finishing the pasuk by hand would; clearing leaves the
// selection on the pasuk's first reading.
const toggleVerseComplete = (verseIndex) => {
  if (!canMarkNow()) return
  const verse = displayVerses.value[verseIndex]
  if (!verse) return
  anchored.value = true
  const verseKey = getVerseKey(verse)
  const rec = getVerseProgress(props.parasha, verseKey)
  const complete = !!(rec.hebrew1 && rec.hebrew2 && rec.targum)
  for (const field of ['hebrew1', 'hebrew2', 'targum']) {
    setVerseProgress(props.parasha, verseKey, field, !complete)
  }
  selectedIndex.value = verseIndex
  if (complete) {
    selectedPhase.value = 1
  } else {
    selectedPhase.value = 3
    advanceSelection()
  }
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
// chosen reading style. So we follow it inside the same aliyah block. See
// src/lib/listStep.js (nextListSelection) for the pure decision, including
// the last-resort fallback when neither the pointer nor a manual step moves
// the selection (the end of a scope: Space must park, not sit still).
//
// In one-pasuk mode, when the next selection is on another pasuk, the marked
// piece first holds its green (MARK_HOLD_MS), the same hold as the focus view.
// Any navigation during the hold cancels it (cancelHold).
const advanceSelection = () => {
  const next = nextSelection()
  cancelHold()
  if (holdBeforeMove({ view: 'list', pasukMode: pasukMode.value, fromIndex: selectedIndex.value, toIndex: next.index })) {
    holding.value = true
    holdTimer = setTimeout(() => {
      holdTimer = null
      holding.value = false
      applyAdvance(next)
    }, MARK_HOLD_MS)
    return
  }
  applyAdvance(next)
}

const applyAdvance = (next) => {
  moveIsAdvance = pasukMode.value && next.index !== selectedIndex.value
  selectedIndex.value = next.index
  selectedPhase.value = next.phase
}

const nextSelection = () => {
  const ptr = scopedPointer.value
  let pointerIndex = null
  let pointerPhase = null
  let sameAliyah = false
  if (ptr) {
    const [p, v] = parseKey(ptr.key)
    const i = displayVerses.value.findIndex(x => x.perekNum === p && x.pasukNum === v)
    if (i >= 0) {
      pointerIndex = i
      pointerPhase = phaseOf(ptr)
      const current = displayVerses.value[selectedIndex.value]
      sameAliyah =
        !!current &&
        aliyahFor(aliyotEntry.value, p, v)?.n ===
          aliyahFor(aliyotEntry.value, current.perekNum, current.pasukNum)?.n
    }
  }

  return nextListSelection({
    selectedIndex: selectedIndex.value,
    selectedPhase: selectedPhase.value,
    pointerIndex,
    pointerPhase,
    sameAliyah,
    readingStyle: settings.value.readingStyle,
    maxIndex: displayVerses.value.length - 1,
    scopeComplete: scopeComplete.value
  })
}

// Clicking the card chrome selects that verse. The phase must move with the
// index, or the pointer marker and the actual selection disagree and the next
// Space un-marks something already read.
const selectVerse = (i) => {
  const verse = displayVerses.value[i]
  if (!verse) return
  cancelHold()
  anchored.value = true
  selectedIndex.value = i
  const rec = getVerseProgress(props.parasha, getVerseKey(verse))
  selectedPhase.value = !rec.hebrew1 ? 1 : !rec.hebrew2 ? 2 : 3
}

// Mark the current phase read and advance — the keyboard path (Space/Enter).
// Unlike VerseView's text click (handlePhaseClick), this NEVER un-marks: a
// phase reached already read (by arrowing onto it, or because the scope just
// completed) is left alone and Space simply advances, so Space can never
// become a toggle loop.
const toggleCurrentPhase = () => {
  if (!canMarkNow()) return
  const verse = displayVerses.value[selectedIndex.value]
  if (!verse) return
  // No phase selected (everything in scope is read): nothing to mark, and
  // marking "the current phase" here would un-mark a completed reading.
  if (selectedPhase.value < 1 || selectedPhase.value > 3) return
  anchored.value = true

  const verseKey = getVerseKey(verse)
  const phaseField = selectedPhase.value === 1 ? 'hebrew1' : selectedPhase.value === 2 ? 'hebrew2' : 'targum'

  const currentProgress = getVerseProgress(props.parasha, verseKey)
  const wasRead = currentProgress[phaseField]

  if (keyboardMarkAction({ wasRead })) {
    setVerseProgress(props.parasha, verseKey, phaseField, true)
  }
  advanceSelection()
}

// Move the selection by hand (arrow keys within / across pesukim).
const setSelectionByHand = (next) => {
  cancelHold()
  anchored.value = true
  selectedIndex.value = next.index
  selectedPhase.value = next.phase
}

// Keyboard navigation for list view - navigates by phase (section) within
// verses. Which key does what is decided in src/lib/inputGuard.js
// (listKeyAction); this only dispatches.
const handleKeydown = (e) => {
  // Don't handle if focus mode is active or settings open
  if (showFocusMode.value || showSettings.value) return

  const { action, preventDefault } = listKeyAction({
    key: e.key,
    repeat: e.repeat,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    targetTag: e.target?.tagName,
    // Space / Enter on a focused button or link belong to that control
    targetIsControl: !!e.target?.closest?.('button, a[href], [role="button"]')
  })
  if (preventDefault) e.preventDefault()

  const maxIndex = displayVerses.value.length - 1

  switch (action) {
    case 'phase-down':
      setSelectionByHand(listPhaseDown({ index: selectedIndex.value, phase: selectedPhase.value, maxIndex }))
      break
    case 'phase-up':
      setSelectionByHand(listPhaseUp({ index: selectedIndex.value, phase: selectedPhase.value }))
      break
    case 'next-verse':
      stepVerse(1)
      break
    case 'previous-verse':
      stepVerse(-1)
      break
    case 'mark':
      // Mark the current phase read (if unread) and always advance
      toggleCurrentPhase()
      break
    case 'focus':
      enterFocusMode(selectedIndex.value)
      break
  }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Scroll the SELECTED PHASE into view, not just the verse: at large font sizes
// a phase change alone can move the selection off-screen, and the arrow keys
// have already cancelled the page's own scrolling. In one-pasuk mode a new
// card is not in the page yet when the selection changes; onPasukEnter calls
// this again once it is.
const scrollToSelected = () => {
  nextTick(() => {
    const verseEl = document.querySelector(`.verse[data-verse-index="${selectedIndex.value}"]`)
    if (!verseEl) return
    const el = verseEl.querySelector('.phase-selected') || verseEl
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
  })
}

// Every selection change — index or phase, keyboard or click — scrolls.
watch([selectedIndex, selectedPhase], scrollToSelected)

// Seed the keyboard selection at the reading pointer (the next unread step)
// so Space always marks "the next thing to read".
//
// With no pointer the fallback depends on WHY there is none. When everything
// in scope is read (finishing the parsha in focus mode, or reopening a
// finished aliyah in 'aliyah' display mode) the old fallback to verse 0 /
// phase 1 parked the selection on an already-read phase, and the next Space
// silently un-marked the first reading of the first verse and persisted it.
// Park at the end of what is on screen with no phase selected instead. Only
// when nothing is derived yet (aliyot.json / the chumash still loading) is the
// top of the list the right place to start — and that placeholder is not
// anchored, so it follows the pointer as soon as one can be derived.
const seedSelectionFromPointer = () => {
  cancelHold()
  const ptr = scopedPointer.value
  let pointerIndex = null
  let pointerPhase = null
  if (ptr) {
    const [p, v] = parseKey(ptr.key)
    const i = displayVerses.value.findIndex(x => x.perekNum === p && x.pasukNum === v)
    if (i >= 0) {
      pointerIndex = i
      pointerPhase = phaseOf(ptr)
    }
  }
  const next = seedListSelection({
    pointerIndex,
    pointerPhase,
    scopeComplete: scopeComplete.value,
    maxIndex: displayVerses.value.length - 1
  })
  anchored.value = pointerIndex !== null || !!scopeComplete.value
  selectedIndex.value = next.index
  selectedPhase.value = next.phase
}

// The displayed list changed (display mode, aliyah, a layer or aliyot.json
// finished loading, a parsha loaded). Keep the selected pasuk when it is still
// on screen — re-seeding unconditionally made the one-pasuk card jump to the
// pointer whenever a setting changed — and re-seed only when it is gone or the
// selection is still the unanchored placeholder.
watch(displayVerses, (list, old) => {
  const prev = old?.[selectedIndex.value]
  const keptIndex = prev
    ? list.findIndex(x => x.perekNum === prev.perekNum && x.pasukNum === prev.pasukNum)
    : -1
  const kept = selectionAfterViewChange({ keptIndex, phase: selectedPhase.value, anchored: anchored.value })
  if (!kept) {
    seedSelectionFromPointer()
    return
  }
  if (kept.index !== selectedIndex.value) {
    // A pending advance was computed in the old list's index space.
    cancelHold()
    selectedIndex.value = kept.index
  }
})
// Another tab (or a resume from the bfcache) changed progress under us. The
// reader's pasuk stays (Space never un-marks, so a phase the other tab marked
// is simply stepped over); only an unanchored placeholder follows the pointer.
watch(externalRevision, () => {
  if (!anchored.value) seedSelectionFromPointer()
})
// A whole parsha was cleared or restored (start over, undo, new cycle): the
// old selection no longer describes "the next thing to read".
watch(bulkRevision, () => { seedSelectionFromPointer() })

// A transient offline start leaves aliyot.json unloaded for the session
const onOnline = () => { retryAliyot() }

// The sticky header's height, published as --list-header-h so the
// previous/next row can stick just below it instead of sliding underneath.
const headerEl = ref(null)
let headerObserver = null
const publishHeaderHeight = () => {
  const h = headerEl.value ? headerEl.value.offsetHeight : 0
  document.documentElement.style.setProperty('--list-header-h', `${h}px`)
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('online', onOnline)
  publishHeaderHeight()
  if (typeof ResizeObserver !== 'undefined' && headerEl.value) {
    headerObserver = new ResizeObserver(publishHeaderHeight)
    headerObserver.observe(headerEl.value)
  }
})

onUnmounted(() => {
  cancelHold()
  clearPasukGuardTimer()
  if (headerObserver) headerObserver.disconnect()
  document.documentElement.style.removeProperty('--list-header-h')
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('online', onOnline)
})
</script>

<style scoped>
.header {
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border-soft);
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  /* Header text is sized in rem, reading text in em: nothing up here grows
     with the reading text-size setting (App.vue sets that on the root). */
  font-size: 1rem;
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
  color: var(--c-scope);
  font-weight: 500;
  margin: 0.5rem 0;
}

.progress-bar {
  margin-top: 0.5rem;
}

.progress-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  margin-bottom: 0.25rem;
}

.progress-text {
  font-size: 0.85rem;
  color: var(--c-muted);
}

.progress-num {
  color: var(--c-text-2);
}

/* The other week: small and quiet, at the inline end of the caption row. */
.other-week-link {
  font-size: 0.85rem;
  color: var(--c-muted);
  text-decoration: none;
  margin-inline-start: auto;
}

.other-week-link:hover,
.other-week-link:focus-visible {
  text-decoration: underline;
  color: var(--c-text-2);
}

.progress-track {
  height: 8px;
  background: var(--c-border-soft);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--c-read-strong) 0%, var(--c-read-border) 100%);
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
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color var(--motion-base) var(--ease-out),
    border-color var(--motion-base) var(--ease-out),
    transform var(--motion-base) var(--ease-out);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.btn:hover {
  background: var(--c-border-soft);
  border-color: var(--c-faint);
  transform: translateY(-1px);
}

.btn:active {
  transform: translateY(0);
}

.study-mode-btn {
  font-weight: 500;
}

.study-mode-btn.active {
  background: var(--c-read-bg);
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

/* Phone: the header was nearly half of a 375x812 screen. Title and the
   settings / parsha picker share one row; the aliyah chips (AliyahBar) scroll
   sideways in one row; the progress bar is thinner; padding is smaller. Every
   element is still there, in the same order. `display: contents` lets the
   title block's children join the container's grid. */
@media (max-width: 600px) {
  .study-mode-btn .label {
    display: none;
  }

  .header {
    padding: 0.4rem 0.75rem 0.5rem;
  }

  .container {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 0.5rem;
    row-gap: 0.15rem;
  }

  .title-section {
    display: contents;
  }

  .title-section > * {
    grid-column: 1 / -1;
    min-width: 0;
  }

  h1 {
    grid-column: 1;
    grid-row: 1;
    font-size: 1.15rem;
    margin-bottom: 0;
  }

  .controls {
    grid-column: 2;
    grid-row: 1;
    gap: 0.35rem;
  }

  .controls .btn {
    padding: 0.3rem 0.6rem;
  }

  .parsha-select {
    padding: 0.3rem;
    max-width: 9.5rem;
    font-size: 0.9rem;
  }

  .progress-bar {
    margin-top: 0.2rem;
  }

  .progress-row {
    margin-bottom: 0.15rem;
  }

  .progress-text {
    font-size: 0.95rem;
  }

  .progress-track {
    height: 4px;
  }

  .aliyah-selector {
    margin: 0.2rem 0;
  }

  .content {
    margin: 0.75rem auto;
    padding: 0 0.5rem;
  }
}

.parsha-select {
  padding: 0.5rem;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
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
  color: var(--c-text-2);
  font-weight: 500;
}

.aliyah-dropdown {
  padding: 0.4rem 0.75rem;
  border: 2px solid var(--c-scope);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  color: var(--c-scope-text);
  background: linear-gradient(135deg, #eff6ff 0%, var(--c-scope-bg) 100%);
  cursor: pointer;
  transition: border-color var(--motion-base) var(--ease-out);
}

.aliyah-dropdown:hover {
  background: linear-gradient(135deg, var(--c-scope-bg) 0%, #bfdbfe 100%);
  border-color: var(--c-scope-strong);
}

.aliyah-dropdown:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--c-scope-rgb), 0.3);
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


/* The one-pasuk card moves with the shared motion-forward / motion-back
   classes in src/style.css. */

/* Arrow row above the single card: previous on the right, next on the left */
.pasuk-nav-row {
  direction: rtl;
  display: flex;
  justify-content: space-between;
  margin: 0 0 0.5rem;
  /* stays in reach just below the sticky header while the card scrolls */
  position: sticky;
  top: var(--list-header-h, 0px);
  z-index: 5;
  padding: 0.35rem 0;
  background: var(--c-bg);
}

.mode-toggle {
  background: var(--c-surface);
  color: var(--c-read-strong);
  border: 1px solid var(--c-read-soft);
  padding: 0.4rem 0.9rem;
  border-radius: 10px;
  font-size: 0.95rem;
  cursor: pointer;
}

.pasuk-nav {
  background: linear-gradient(135deg, var(--c-read-border) 0%, var(--c-read-strong) 100%);
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 10px;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.pasuk-nav:disabled {
  /* allow-opacity: disabled side arrow at the first/last pasuk, not text */
  opacity: 0.3;
  cursor: not-allowed;
  background: var(--c-border);
  box-shadow: none;
}
</style>
