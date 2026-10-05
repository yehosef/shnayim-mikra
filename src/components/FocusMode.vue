<template>
  <div class="focus-mode">
    <!-- Header — describes the card on screen (`shown`), so during a move it
         changes when the new card enters, not while the old one is leaving.
         Labels use the same Hebrew font and sizes as the list view. -->
    <div class="focus-header">
      <div class="verse-info">
        <span
          v-if="aliyaLabel"
          class="aliya-label font-sbl"
          :class="{ 'aliya-label-emphasis': emphasizeAliyah, 'in-scope': shownInScope }"
          :title="shownInScope ? t('בעלייה שנבחרה', 'In the selected aliyah') : null"
          @animationend="emphasizeAliyah = false"
        >{{ aliyaLabel }}</span>
        <span class="perek-pasuk font-sbl">
          <span
            v-if="shownIsPointer"
            class="pointer-mark"
            role="img"
            :title="t('כאן אתה נמצא', 'You are here')"
            :aria-label="t('כאן אתה נמצא', 'You are here')"
          >▶</span>
          <span v-if="perekLabel" class="perek">{{ t('פרק', 'Perek') }} {{ perekLabel }}</span>
          <span v-if="perekLabel" class="separator">:</span>
          <span class="pasuk">{{ t('פסוק', 'Pasuk') }} {{ shownVerse.pasuk }}</span>
        </span>
        <!-- Step Indicators -->
        <div class="step-indicator">
          <span
            :class="{ active: shown.step >= 1, done: shownProgress.hebrew1 }"
            @click="jumpToStep(1)"
            :title="t('קריאה ראשונה (1)', 'First reading (1)')"
            :aria-label="t('קריאה ראשונה', 'First reading')"
          >●</span>
          <span
            :class="{ active: shown.step >= 2, done: shownProgress.hebrew2 }"
            @click="jumpToStep(2)"
            :title="t('קריאה שנייה (2)', 'Second reading (2)')"
            :aria-label="t('קריאה שנייה', 'Second reading')"
          >●</span>
          <span
            :class="{ active: shown.step >= 3, done: shownProgress.targum }"
            @click="jumpToStep(3)"
            :title="t('תרגום (3)', 'Translation (3)')"
            :aria-label="t('תרגום', 'Translation')"
          >●</span>
        </div>
      </div>
      <div class="header-controls">
        <button
          @click="showHelp = !showHelp"
          class="help-btn"
          :title="t('קיצורי מקלדת (?)', 'Keyboard shortcuts (?)')"
          :aria-label="t('קיצורי מקלדת', 'Keyboard shortcuts')"
        >?</button>
        <button
          @click="showSettings = !showSettings"
          class="settings-btn"
          :title="t('הגדרות', 'Settings')"
          :aria-label="t('הגדרות', 'Settings')"
        >⚙️</button>
        <button
          @click="$emit('exit')"
          class="exit-btn"
          :title="t('חזרה לרשימה (Esc)', 'Back to the list (Esc)')"
          :aria-label="t('חזרה לרשימה', 'Back to the list')"
        >✕</button>
      </div>
    </div>

    <!-- Keyboard Help Overlay -->
    <div v-if="showHelp" class="help-overlay" @click.self="showHelp = false">
      <div class="help-panel" role="dialog" :aria-label="t('קיצורי מקלדת', 'Keyboard shortcuts')">
        <h3>{{ t('קיצורי מקלדת', 'Keyboard shortcuts') }}</h3>
        <div class="shortcuts-grid">
          <div class="shortcut"><kbd>Space</kbd> <span>{{ t('המשך לשלב הבא', 'Continue to the next step') }}</span></div>
          <div class="shortcut"><kbd>Enter</kbd> <span>{{ t('המשך לשלב הבא', 'Continue to the next step') }}</span></div>
          <div class="shortcut"><kbd>←</kbd> <span>{{ t('פסוק הבא', 'Next pasuk') }}</span></div>
          <div class="shortcut"><kbd>→</kbd> <span>{{ t('פסוק קודם', 'Previous pasuk') }}</span></div>
          <div class="shortcut"><kbd>↑</kbd> <span>{{ t('שלב קודם', 'Previous step') }}</span></div>
          <div class="shortcut"><kbd>↓</kbd> <span>{{ t('שלב הבא', 'Next step') }}</span></div>
          <div class="shortcut"><kbd>1</kbd> <span>{{ t('קריאה ראשונה', 'First reading') }}</span></div>
          <div class="shortcut"><kbd>2</kbd> <span>{{ t('קריאה שנייה', 'Second reading') }}</span></div>
          <div class="shortcut"><kbd>3</kbd> <span>{{ t('תרגום', 'Translation') }}</span></div>
          <div class="shortcut"><kbd>M</kbd> <span>{{ t('סמן כנקרא', 'Mark as read') }}</span></div>
          <div class="shortcut"><kbd>U</kbd> <span>{{ t('בטל סימון', 'Undo the mark') }}</span></div>
          <div class="shortcut"><kbd>?</kbd> <span>{{ t('עזרה זו', 'This help') }}</span></div>
          <div class="shortcut"><kbd>Esc</kbd> <span>{{ t('חזרה לרשימה', 'Back to the list') }}</span></div>
        </div>
        <button @click="showHelp = false" class="close-help-btn">{{ t('סגור', 'Close') }}</button>
      </div>
    </div>

    <!-- Settings Modal -->
    <SettingsModal v-if="showSettings" :focusMode="true" @close="showSettings = false" />

    <!-- Main Content - Sequential 3-Step Display -->
    <div ref="contentEl" class="focus-content" @pointerdown="handlePointerDown">
      <!-- The piece being read. Motion vocabulary: src/lib/motion.js and the
           motion-* classes in src/style.css.
           - A new pasuk replaces the whole stage (keyed by pasuk), sliding in
             the direction of the move (forward: enters from the left).
           - Another piece of the same pasuk keeps the card; only the label and
             the text crossfade, and the card's green resets.
           On a mark, advanceStep first holds the green card, then moves.
           The label travels with the stage so it cannot announce the next
           piece while the previous card is still on its way out. -->
      <Transition
        :name="cardTransition"
        mode="out-in"
        @before-enter="onCardBeforeEnter"
        @enter="onPasukEnter"
        @after-enter="onCardAfterEnter"
      >
        <div class="text-stage" :key="currentIndex">
          <!-- Step Label -->
          <Transition name="motion-fade" mode="out-in">
            <div class="step-label" :key="stepLabel">{{ stepLabel }}</div>
          </Transition>

          <!-- Read state is the border + background; the stripe on the
               reading-start edge is the pointer (gold) / selected aliyah
               (blue), the same channels as the list view's card. -->
          <div
            class="text-display"
            :class="{ 'step-complete': currentStepDone, 'is-pointer': cardIsPointer, 'in-scope': cardInScope }"
            @click="handleTextClick"
          >
            <Transition
              name="motion-fade"
              mode="out-in"
              @before-enter="onCardBeforeEnter"
              @after-enter="onCardAfterEnter"
            >
              <!-- Hebrew Text (Steps 1 & 2) -->
              <div
                v-if="currentStep === 1 || currentStep === 2"
                :key="`hebrew${currentStep}`"
                class="torah font-sbl"
                dir="rtl"
                lang="he"
              >{{ formattedTorahText }}</div>

              <!-- Targum (Step 3) -->
              <div
                v-else-if="targumLayer === 'onkelos'"
                key="targum-onkelos"
                class="targum font-sbl"
                dir="rtl"
                lang="he"
                v-html="currentVerse.targum"
              ></div>

              <div
                v-else-if="targumLayer === 'rashi'"
                key="targum-rashi"
                class="targum"
                dir="rtl"
                lang="he"
                :class="{ 'font-rashi': settings.fontRashi }"
                v-html="currentVerse.rashi.join('  ')"
              ></div>

              <div
                v-else
                key="targum-english"
                class="targum english-targum"
                dir="ltr"
                lang="en"
                v-html="currentVerse.english || t('אין תרגום לאנגלית', 'No English translation available')"
              ></div>
            </Transition>
          </div>
        </div>
      </Transition>

      <!-- Instruction -->
      <div class="instruction">
        <span v-if="shown.step < 3">{{ t('לחץ או [Space] להמשיך', 'Tap or press [Space] to continue') }}</span>
        <span v-else-if="shown.index < totalVerses - 1">{{ t('לחץ או [Space] לפסוק הבא', 'Tap or press [Space] for the next pasuk') }}</span>
        <span v-else-if="pointerElsewhere">{{ t('לחץ או [Space] להשלמת מה שנותר', 'Tap or press [Space] to finish what is left') }}</span>
        <span v-else>{{ t('לחץ או [Space] לסיים', 'Tap or press [Space] to finish') }}</span>
      </div>

      <!-- Additional Reference Texts (always visible if enabled) -->
      <div v-if="settings.showEnglish && settings.targumType !== 'english' && shownVerse.english" class="reference-section" dir="ltr">
        <div class="reference-label">{{ t('אנגלית', 'English') }}</div>
        <div class="english reference-text" v-html="shownVerse.english"></div>
      </div>

      <div v-if="shownVerse.rashi?.length && settings.showRashi && settings.targumType !== 'rashi'" class="reference-section" dir="rtl" lang="he">
        <div class="reference-label">רש"י</div>
        <div class="rashi reference-text" :class="{ 'font-rashi': settings.fontRashi }" v-html="shownVerse.rashi.join('  ')"></div>
      </div>
    </div>

    <!-- Side Navigation Buttons, right-to-left like the list view and the
         arrow keys: next pasuk on the left (←), previous on the right (→). -->
    <button
      @click.stop="nextVerse"
      :disabled="currentIndex === totalVerses - 1"
      class="nav-btn nav-btn-left"
      :title="t('פסוק הבא (←)', 'Next pasuk (←)')"
      :aria-label="t('פסוק הבא', 'Next pasuk')"
    >
      ←
    </button>
    <button
      @click.stop="previousVerse"
      :disabled="currentIndex === 0"
      class="nav-btn nav-btn-right"
      :title="t('פסוק קודם (→)', 'Previous pasuk (→)')"
      :aria-label="t('פסוק קודם', 'Previous pasuk')"
    >
      →
    </button>

    <!-- Progress Footer -->
    <div class="focus-footer">
      <div class="progress-indicator">
        {{ t('פסוק', 'Pasuk') }} <bdi dir="ltr">{{ shown.index + 1 }} / {{ totalVerses }}</bdi>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useProgress } from '../composables/useProgress'
import { formatHebrewText, toHebrew } from '../utils/hebrewUtils'
import { nextFocusPosition, stepDownPosition, stepUpPosition, neighbourIndex } from '../lib/focusStep'
import { focusKeyAction, mayAdvance } from '../lib/inputGuard'
import {
  MARK_HOLD_MS,
  MOTION_GUARD_MAX_MS,
  TRANSITION_FORWARD,
  classifyMove,
  transitionNameFor,
  isSettled
} from '../lib/motion'
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
  },
  // (perek, pasuk) => boolean — the same derived state the list view uses for
  // its gold "you are here" cue (isPointer) and its blue "in the selected
  // aliyah" cue (inCurrentAliyah), both from useReadingState. Nothing stored.
  pointerAt: {
    type: Function,
    default: null
  },
  inScopeAt: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['exit'])

const { getVerseProgress, setVerseProgress } = useProgress()

// Interface language (settings.interfaceLanguage: 'en' default | 'he'). Torah
// text, aliyah names and perek / pasuk numerals stay Hebrew either way.
const isHebrew = computed(() => props.settings.interfaceLanguage === 'he')
const t = (he, en) => (isHebrew.value ? he : en)

const contentEl = ref(null)
const showSettings = ref(false)
const showHelp = ref(false)
// The reader's position: where Space marks and where navigation starts from.
const currentIndex = ref(props.startIndex)
const currentStep = ref(1) // 1 = first Hebrew, 2 = second Hebrew, 3 = Targum
const lastAction = ref(null) // For undo functionality

const totalVerses = computed(() => props.verses.length)

const keyAt = (index) => {
  const v = props.verses[index]
  if (!v || !Number.isInteger(v.perekNum) || !Number.isInteger(v.pasukNum)) return null
  return `${v.perekNum}:${v.pasukNum}`
}

const currentVerse = computed(() => props.verses[currentIndex.value] || {})

// null when the current index does not point at a real verse (a stale index
// after the verse list changed). Progress is never written under such a key —
// that is what produced 'undefined:undefined' entries in localStorage.
const verseKey = computed(() => keyAt(currentIndex.value))

const progress = computed(() => getVerseProgress(props.parasha, verseKey.value))

const fieldOf = (step) => (step === 1 ? 'hebrew1' : step === 2 ? 'hebrew2' : 'targum')

const currentStepDone = computed(() => !!progress.value[fieldOf(currentStep.value)])

// What is on screen. During a move to another pasuk the old card is still
// leaving while `currentIndex` already names the new one; the header, footer,
// instruction and reference blocks follow `shown`, which is updated when the
// new card starts entering, so nothing around the card runs ahead of it.
const shown = ref({ index: props.startIndex, step: 1 })

const shownVerse = computed(() => {
  const list = props.verses
  if (!list.length) return {}
  return list[Math.min(Math.max(shown.value.index, 0), list.length - 1)] || {}
})

const shownProgress = computed(() => {
  const v = shownVerse.value
  const key = Number.isInteger(v.perekNum) && Number.isInteger(v.pasukNum) ? `${v.perekNum}:${v.pasukNum}` : null
  return getVerseProgress(props.parasha, key)
})

// useData only sets `perek` on the first verse of a chapter (it drives the
// list-view chapter marker), so the header must derive the chapter itself or
// every other verse shows a bare pasuk number.
const perekLabel = computed(() => {
  const n = shownVerse.value.perekNum
  return Number.isInteger(n) ? toHebrew(n + 1) : null
})

const aliyaLabel = computed(() => {
  const v = shownVerse.value
  if (props.aliyahOf && v.perekNum !== undefined) return props.aliyahOf(v.perekNum, v.pasukNum)
  return v.aliya || null
})

const cueFor = (fn, v) =>
  !!(fn && v && Number.isInteger(v.perekNum) && Number.isInteger(v.pasukNum) && fn(v.perekNum, v.pasukNum))

// Cues for the pasuk in the header (follows `shown`) and for the card (follows
// the position, like the card's green).
const shownIsPointer = computed(() => cueFor(props.pointerAt, shownVerse.value))
const shownInScope = computed(() => cueFor(props.inScopeAt, shownVerse.value))
const cardIsPointer = computed(() => cueFor(props.pointerAt, currentVerse.value))
const cardInScope = computed(() => cueFor(props.inScopeAt, currentVerse.value))

const aliyahAt = (index) => {
  const v = props.verses[index]
  if (!v || !props.aliyahOf) return null
  return props.aliyahOf(v.perekNum, v.pasukNum)
}

const PHASE_STEP = { hebrew1: 1, hebrew2: 2, targum: 3 }

// Where the pointer sits inside the displayed verses, or null
const pointerPosition = () => {
  const ptr = props.pointerFn ? props.pointerFn() : null
  if (!ptr) return null
  const index = props.verses.findIndex(v => `${v.perekNum}:${v.pasukNum}` === ptr.key)
  if (index < 0) return null
  return { index, step: PHASE_STEP[ptr.phase] || 1 }
}

// Whether a displayed verse sits in the same aliyah block as the current one.
// Two unknown labels are NOT "the same aliyah" — without aliyot data we must
// not treat the whole parsha as one block.
const sameAliyahAsCurrent = (index) => {
  const la = aliyahAt(index)
  return !!la && la === aliyahAt(currentIndex.value)
}

// On the last verse, Space goes back to a pointer left behind instead of
// exiting, so the instruction line must not promise "finish".
const pointerElsewhere = computed(() => {
  const pos = pointerPosition()
  return !!pos && pos.index !== shown.value.index
})

const formattedTorahText = computed(() => {
  return formatHebrewText(currentVerse.value.torah, props.settings.showTrop)
})

// Layer shown as "targum" for this verse; Onkelos when the chosen layer is
// unavailable (offline before download, or a verse with no Rashi).
const targumLayer = computed(() => {
  const type = props.settings.targumType
  const v = currentVerse.value
  if (type === 'rashi' && v.rashi?.length) return 'rashi'
  if (type === 'english' && v.english) return 'english'
  return 'onkelos'
})

const stepLabel = computed(() => {
  if (currentStep.value === 1) return t('קריאה ראשונה', 'First reading')
  if (currentStep.value === 2) return t('קריאה שנייה', 'Second reading')
  const labels = {
    onkelos: t('תרגום אונקלוס', 'Targum Onkelos'),
    rashi: 'רש"י',
    english: t('תרגום לאנגלית', 'English translation')
  }
  return labels[targumLayer.value] || t('תרגום', 'Translation')
})

// The piece to open a pasuk on: the pointer's phase when the pointer is on
// that pasuk (respects the active reading style), else its first unread piece.
const startingStepFor = (index) => {
  const pos = pointerPosition()
  if (pos && pos.index === index) return pos.step
  const p = getVerseProgress(props.parasha, keyAt(index))
  if (!p.hebrew1) return 1
  if (!p.hebrew2) return 2
  if (!p.targum) return 3
  return 1 // All done, start over
}

// Initialize the step synchronously (not in onMounted): the card is keyed by
// verse and step, so setting it after mount would animate the first card for
// no reason the moment focus mode opens.
currentStep.value = startingStepFor(currentIndex.value)
shown.value = { index: currentIndex.value, step: currentStep.value }

// ---- Motion -------------------------------------------------------------
// Decisions are pure (src/lib/motion.js); this only wires them to the
// Transition hooks and timers.

const cardTransition = ref(TRANSITION_FORWARD)
// True from a move until its card has finished entering. A Space or tap in
// that window would mark the piece that has not been shown yet.
const moving = ref(false)
// True while a just-marked card holds its green before the move.
const holding = ref(false)
// Brief colour emphasis on the aliyah label when a move crosses into another
// aliyah (cleared by the label's animationend).
const emphasizeAliyah = ref(false)
let pendingMove = null
let advanceTimer = null
let motionGuardTimer = null

const clearMotionGuardTimer = () => {
  if (motionGuardTimer !== null) {
    clearTimeout(motionGuardTimer)
    motionGuardTimer = null
  }
}

// Make what is on screen and the position agree, and release the guard.
const settle = () => {
  clearMotionGuardTimer()
  shown.value = { index: currentIndex.value, step: currentStep.value }
  moving.value = false
}

// Any navigation (arrows, 1/2/3, the dots, undo, exit) cancels a pending
// advance, so the hold can never carry the reader somewhere they navigated
// away from.
const cancelPendingAdvance = () => {
  if (advanceTimer !== null) {
    clearTimeout(advanceTimer)
    advanceTimer = null
  }
  holding.value = false
}

// The single place the position changes. Classifies the move (same-pasuk
// step, next / previous pasuk, new aliyah, jump back to the top of the aliyah)
// and picks the transition before the key changes.
const moveTo = (target, { advance = false } = {}) => {
  if (!target) return
  const from = { index: currentIndex.value, step: currentStep.value }
  const move = classifyMove({
    from,
    to: target,
    fromAliyah: aliyahAt(from.index),
    toAliyah: aliyahAt(target.index),
    advance
  })
  if (move.kind === 'none') return
  pendingMove = move
  if (move.direction) cardTransition.value = transitionNameFor(move)
  currentIndex.value = target.index
  currentStep.value = target.step
  moving.value = true
  clearMotionGuardTimer()
  motionGuardTimer = setTimeout(() => {
    motionGuardTimer = null
    settle()
  }, MOTION_GUARD_MAX_MS)
}

// A card (a new pasuk, or a new piece's text) starts entering: it is the
// latest position, so the surroundings switch to it now.
const onCardBeforeEnter = () => {
  shown.value = { index: currentIndex.value, step: currentStep.value }
  if (pendingMove?.emphasizeAliyah) emphasizeAliyah.value = true
  pendingMove = null
}

// A new pasuk is in the page: start it at the top (a long previous pasuk can
// leave the reader scrolled down). Done here, after insertion, not before.
const onPasukEnter = () => {
  if (contentEl.value) contentEl.value.scrollTop = 0
}

const onCardAfterEnter = () => {
  if (isSettled(shown.value, { index: currentIndex.value, step: currentStep.value })) settle()
}

// The verse list can be replaced under us (a layer reload keeps focus mode
// mounted on purpose, so we cannot rely on a remount to re-seed the index).
watch(() => props.verses, (list, old) => {
  const length = Array.isArray(list) ? list.length : 0
  if (length !== (Array.isArray(old) ? old.length : 0)) cancelPendingAdvance()
  if (length === 0) {
    currentIndex.value = 0
    return
  }
  const index = Math.min(Math.max(currentIndex.value, 0), length - 1)
  if (index !== currentIndex.value) moveTo({ index, step: startingStepFor(index) })
})

onUnmounted(() => {
  cancelPendingAdvance()
  clearMotionGuardTimer()
})

// Single write path: refuses to touch storage when the index is stale.
const markPhase = (field, value) => {
  const key = verseKey.value
  if (!key) return false
  lastAction.value = { type: 'progress', parasha: props.parasha, key, field, prevValue: progress.value[field] }
  setVerseProgress(props.parasha, key, field, value)
  return true
}

const canMarkNow = () =>
  mayAdvance({
    overlayOpen: showSettings.value || showHelp.value,
    hasVerse: !!verseKey.value,
    holding: holding.value,
    moving: moving.value
  })

const advanceStep = () => {
  if (!canMarkNow()) return

  markPhase(fieldOf(currentStep.value), true)

  // The pointer is recomputed by the parent from progress, so it must be read
  // AFTER the mark above.
  const pointer = pointerPosition()
  const next = nextFocusPosition({
    step: currentStep.value,
    currentIndex: currentIndex.value,
    lastIndex: totalVerses.value - 1,
    pointer,
    readingStyle: props.settings.readingStyle,
    sameAliyah: pointer ? sameAliyahAsCurrent(pointer.index) : false
  })

  // Let the card show its read state (green) before it moves on.
  holding.value = true
  advanceTimer = setTimeout(() => {
    advanceTimer = null
    holding.value = false
    // null = nothing left to read anywhere in this view.
    if (!next) {
      emit('exit')
      return
    }
    moveTo(next, { advance: true })
  }, MARK_HOLD_MS)
}

const jumpToStep = (step) => {
  cancelPendingAdvance()
  moveTo({ index: currentIndex.value, step })
}

const markCurrentComplete = () => {
  if (!canMarkNow()) return
  markPhase(fieldOf(currentStep.value), true)
}

// A pointer that moved more than this between down and up is a drag
// (text selection / scroll), not a tap on the reading card.
const DRAG_THRESHOLD_PX = 8
let pointerStart = null

const handlePointerDown = (e) => {
  pointerStart = { x: e.clientX, y: e.clientY }
}

// Only the pasuk / targum card advances the reading — the step label, the
// instruction line, the padding and the English/Rashi reference blocks are not
// click targets — and a drag that selects text must not mark the phase read.
const handleTextClick = (event) => {
  const start = pointerStart
  pointerStart = null

  const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null
  if (sel && sel.toString()) return

  if (start && event && typeof event.clientX === 'number') {
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return
  }

  advanceStep()
}

const undoLastAction = () => {
  cancelPendingAdvance()
  if (lastAction.value && lastAction.value.type === 'progress') {
    setVerseProgress(lastAction.value.parasha, lastAction.value.key, lastAction.value.field, lastAction.value.prevValue)
    lastAction.value = null
  }
}

const goToNeighbour = (delta) => {
  cancelPendingAdvance()
  const i = neighbourIndex({ index: currentIndex.value, delta, lastIndex: totalVerses.value - 1 })
  if (i === null) return
  moveTo({ index: i, step: startingStepFor(i) })
}

const nextVerse = () => goToNeighbour(1)
const previousVerse = () => goToNeighbour(-1)

const exitFocus = () => {
  cancelPendingAdvance()
  emit('exit')
}

// Keyboard navigation. Which key does what is decided in
// src/lib/inputGuard.js (focusKeyAction); this only dispatches.
const handleKeydown = (e) => {
  const { action, step, preventDefault } = focusKeyAction({
    key: e.key,
    repeat: e.repeat,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    targetTag: e.target?.tagName,
    overlayOpen: showSettings.value || showHelp.value
  })
  if (preventDefault) e.preventDefault()

  switch (action) {
    case 'close-overlays':
      showSettings.value = false
      showHelp.value = false
      break
    case 'exit':
      exitFocus()
      break
    case 'advance':
      advanceStep()
      break
    case 'next-verse':
      nextVerse()
      break
    case 'previous-verse':
      previousVerse()
      break
    case 'step-down':
      cancelPendingAdvance()
      moveTo(stepDownPosition({ index: currentIndex.value, step: currentStep.value, lastIndex: totalVerses.value - 1 }))
      break
    case 'step-up':
      cancelPendingAdvance()
      moveTo(stepUpPosition({ index: currentIndex.value, step: currentStep.value }))
      break
    case 'jump':
      jumpToStep(step)
      break
    case 'mark':
      markCurrentComplete()
      break
    case 'undo':
      undoLastAction()
      break
    case 'help':
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
  background: var(--c-bg);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.focus-header {
  background: var(--c-surface);
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--c-border-soft);
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

/* Labels: same sizes, weights and colours as the list view's aliyah chip,
   perek and pasuk (VerseView .aliya-marker / .perek / .pasuk). */
.aliya-label {
  background: var(--c-border-soft);
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.9em;
  color: var(--c-text-2);
}

/* The shown pasuk is in the selected aliyah: blue ring and tint. */
.aliya-label.in-scope {
  background: var(--c-scope-bg);
  color: var(--c-scope-text);
  box-shadow: 0 0 0 2px var(--c-scope);
}

/* A move into another aliyah: brief colour emphasis, no movement. */
.aliya-label-emphasis {
  animation: aliyahEmphasis var(--motion-emphasis) var(--ease-out);
}

@keyframes aliyahEmphasis {
  0% { background-color: var(--c-scope-bg); color: var(--c-scope-text); }
  100% { background-color: var(--c-border-soft); color: var(--c-text-2); }
}

.perek-pasuk {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.perek {
  font-weight: 600;
  font-size: 1.1em;
  color: var(--c-text-2);
}

.separator {
  color: var(--c-faint);
}

.pasuk {
  font-weight: 600;
  font-size: 0.9em;
  color: var(--c-muted);
}

/* The shown pasuk holds the reading pointer ("you are here"). */
.pointer-mark {
  color: var(--c-pointer);
  font-size: 1.1em;
  font-weight: bold;
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
  background: var(--c-border-soft);
  color: var(--c-faint);
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color var(--motion-base) var(--ease-out),
    color var(--motion-base) var(--ease-out),
    transform var(--motion-base) var(--ease-out);
}

.step-indicator span.active {
  background: var(--c-scope);
  color: white;
  transform: scale(1.1);
}

.step-indicator span.done {
  background: var(--c-read-border);
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

/* The list view's light bordered .btn look. */
.help-btn,
.settings-btn,
.exit-btn {
  background: var(--c-surface-2);
  color: var(--c-text-2);
  border: 1px solid var(--c-border);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 1.1rem;
  transition:
    background-color var(--motion-base) var(--ease-out),
    border-color var(--motion-base) var(--ease-out);
  font-weight: 600;
}

.help-btn:hover,
.settings-btn:hover,
.exit-btn:hover {
  background: var(--c-border-soft);
  border-color: var(--c-faint);
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
  background: var(--c-surface);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 450px;
  width: 90%;
  padding: 2rem;
}

.help-panel h3 {
  margin-bottom: 1.5rem;
  color: var(--c-text);
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
  border-radius: var(--radius-md);
  background: var(--c-bg);
}

.shortcut kbd {
  background: linear-gradient(180deg, var(--c-surface) 0%, var(--c-border-soft) 100%);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.6rem;
  font-family: monospace;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--c-text-2);
  min-width: 60px;
  text-align: center;
  box-shadow: 0 2px 0 var(--c-border);
}

.shortcut span {
  color: var(--c-text-2);
  font-size: 0.95rem;
}

.close-help-btn {
  width: 100%;
  margin-top: 1.5rem;
  padding: 0.75rem;
  background: var(--c-scope);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--motion-base) var(--ease-out);
}

.close-help-btn:hover {
  background: var(--c-scope-strong);
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
  /* the sliding card must not flash a horizontal scrollbar */
  overflow-x: hidden;
}

.step-label {
  font-size: 1.1rem;
  color: var(--c-muted);
  margin-bottom: 1.5rem;
  font-weight: 500;
  text-align: center;
}

/* The card: same 2px grey border and radius as a piece box in the list view
   (.clickable-text); read state swaps in the 3px green. The padding gives back
   the border's extra pixel so the text does not shift when it turns green.
   --cue is the pointer / selected-aliyah stripe on the reading-start edge. */
.text-display {
  --cue: transparent;
  width: 100%;
  max-width: 800px;
  padding: calc(2.5rem + 1px);
  background: var(--c-surface);
  border-radius: var(--radius-md);
  box-shadow: inset -6px 0 0 var(--cue), 0 4px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
  /* Green appears within --motion-colour; colours and the hover lift only. */
  transition:
    background-color var(--motion-colour) var(--ease-out),
    border-color var(--motion-colour) var(--ease-out),
    transform var(--motion-fast) var(--ease-out);
  border: 2px solid var(--c-border);
}

/* The stage holds one pasuk's card; the motion-forward / motion-back classes
   (src/style.css) move it between pesukim. */
.text-stage {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* In the selected aliyah (blue); the pointer (gold) is declared after it and
   wins, as in the list view. Neither touches the read-state border. */
.text-display.in-scope {
  --cue: var(--c-scope);
}

.text-display.is-pointer {
  --cue: var(--c-pointer);
}

.text-display:hover {
  box-shadow: inset -6px 0 0 var(--cue), 0 8px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .text-display:hover {
    transform: none;
  }
}

/* Read: the same green as a read card in the list view, so the cue is
   unmistakable during the hold before the card slides away. */
.text-display.step-complete {
  border-width: 3px;
  padding: 2.5rem;
  border-color: var(--c-read-border);
  background: var(--c-read-bg);
  box-shadow: inset -6px 0 0 var(--cue), 0 4px 16px rgba(16, 185, 129, 0.35);
}

.torah {
  font-size: var(--fs-hebrew);
  line-height: var(--lh-hebrew);
  color: var(--c-text);
}

.targum {
  font-size: var(--fs-translation);
  color: var(--c-text-2);
  line-height: var(--lh-translation);
}

.english-targum {
  direction: ltr;
  text-align: center;
}

.instruction {
  margin-top: 2rem;
  font-size: 0.9rem;
  color: var(--c-faint);
  text-align: center;
}

/* Reference blocks (English / Rashi when they are not the counted
   translation): the list view's quieter treatment — a rule above, no box. */
.reference-section {
  width: 100%;
  max-width: 800px;
  margin-top: 1.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--c-border-soft);
}

.reference-label {
  font-size: 0.85rem;
  color: var(--c-muted);
  margin-bottom: 0.35rem;
  font-weight: 500;
}

.reference-text {
  font-size: var(--fs-reference);
  line-height: var(--lh-translation);
  color: var(--c-text-2);
}

.english {
  direction: ltr;
  text-align: left;
}

.font-rashi {
  font-family: 'Rashi', serif;
}

/* Navigation Buttons */
.nav-btn {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(135deg, var(--c-read-border) 0%, var(--c-read-strong) 100%);
  color: white;
  border: none;
  padding: 1.5rem 1rem;
  border-radius: var(--radius-lg);
  font-size: 2rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--motion-base) var(--ease-out), background-color var(--motion-base) var(--ease-out);
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
  background: var(--c-border);
  box-shadow: none;
}

/* Footer */
.focus-footer {
  background: var(--c-surface);
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--c-border-soft);
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 -2px 4px rgba(0,0,0,0.05);
}

.progress-indicator {
  font-size: 1rem;
  color: var(--c-muted);
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

  /* Same Hebrew : translation ratio as on a wide screen, scaled down. */
  .torah {
    font-size: calc(var(--fs-hebrew) * 0.8);
  }

  .targum {
    font-size: calc(var(--fs-translation) * 0.8);
  }

  .text-display {
    padding: calc(1.5rem + 1px);
  }

  .text-display.step-complete {
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

  .perek,
  .pasuk {
    white-space: nowrap;
  }

  .help-panel {
    padding: 1.5rem;
  }

  .shortcut kbd {
    min-width: 50px;
    font-size: 0.8rem;
  }
}

/* Phone: slimmer edge buttons, and side padding so the card never sits
   underneath them. */
@media (max-width: 600px) {
  .focus-content {
    padding: 1rem 2.75rem;
  }

  .nav-btn {
    padding: 1.25rem 0.4rem;
    font-size: 1.25rem;
  }

  .nav-btn-left {
    left: 0.25rem;
  }

  .nav-btn-right {
    right: 0.25rem;
  }

  .text-display {
    padding: calc(1rem + 1px);
  }

  .text-display.step-complete {
    padding: 1rem;
  }
}
</style>
