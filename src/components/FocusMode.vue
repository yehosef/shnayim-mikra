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
          <!-- Full reference; under 400px the compact "א:יג" replaces it
               (CSS), keeping the full wording as its label. -->
          <span class="ref-full">
            <span v-if="perekLabel" class="perek">{{ t('פרק', 'Perek') }} {{ perekLabel }}</span>
            <span v-if="perekLabel" class="separator">:</span>
            <span class="pasuk">{{ t('פסוק', 'Pasuk') }} {{ shownVerse.pasuk }}</span>
          </span>
          <span
            class="ref-compact"
            dir="rtl"
            role="img"
            :title="fullReference"
            :aria-label="fullReference"
          >{{ compactReference }}</span>
        </span>
        <!-- Step Indicators -->
        <!-- Step Indicators: one button per piece. Ring = not read,
             gold = the piece on screen, green = read. -->
        <div class="step-indicator">
          <button
            v-for="dot in stepDots"
            :key="dot.step"
            type="button"
            class="step-dot"
            :class="{ active: shown.step >= dot.step, current: shown.step === dot.step, done: shownProgress[dot.field] }"
            :aria-current="shown.step === dot.step ? 'step' : null"
            :title="dot.title"
            :aria-label="dot.label"
            @click="jumpToStep(dot.step)"
          ></button>
        </div>
      </div>
      <div class="header-controls">
        <button
          @click="showHelp = !showHelp"
          class="help-btn"
          :title="t('איך זה עובד (?)', 'How it works (?)')"
          :aria-label="t('איך זה עובד', 'How it works')"
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

    <!-- "How it works" sheet: touch first, then the colour key, then the
         keyboard. Scrolls inside itself; Close stays at the bottom. -->
    <div v-if="showHelp" class="help-overlay" @click.self="showHelp = false">
      <div class="help-panel" role="dialog" :aria-label="t('איך זה עובד', 'How it works')">
        <h3>{{ t('איך זה עובד', 'How it works') }}</h3>

        <section class="help-section">
          <h4>{{ t('במסך מגע', 'On a touch screen') }}</h4>
          <ul class="help-list">
            <li>{{ t('הקישו על הטקסט כדי לסמן אותו כנקרא ולעבור הלאה.', 'Tap the text to mark it read and move on.') }}</li>
            <li>{{ t('הכפתורים בצדי המסך עוברים לפסוק הבא או לפסוק הקודם.', 'The buttons at the sides of the screen move to the next or previous pasuk.') }}</li>
            <li>{{ t('שלוש הנקודות למעלה הן קריאה ראשונה, קריאה שנייה ותרגום. הקישו על נקודה כדי לעבור אליה.', 'The three dots at the top are the first reading, the second reading and the translation. Tap a dot to go to it.') }}</li>
            <li>{{ t('אחרי כל סימון מופיע כפתור ״ביטול״ בתחתית המסך לכמה שניות.', 'After each mark, an Undo button appears at the bottom for a few seconds.') }}</li>
          </ul>
        </section>

        <section class="help-section">
          <h4>{{ t('צבעים', 'Colours') }}</h4>
          <ul class="colour-key">
            <li><span class="swatch swatch-read" aria-hidden="true"></span>{{ t('ירוק: נקרא', 'Green: read') }}</li>
            <li><span class="swatch-mark pointer-mark" aria-hidden="true">▶</span>{{ t('זהב: כאן אתם נמצאים', 'Gold: where you are') }}</li>
            <li><span class="swatch swatch-scope" aria-hidden="true"></span>{{ t('כחול: העלייה שנבחרה', 'Blue: the selected aliyah') }}</li>
          </ul>
        </section>

        <section class="help-section">
          <h4>{{ t('מקלדת', 'Keyboard') }}</h4>
          <div class="shortcuts-grid">
            <div class="shortcut"><span class="keys"><kbd>Space</kbd><kbd>Enter</kbd></span> <span>{{ t('המשך לשלב הבא', 'Continue to the next step') }}</span></div>
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
        </section>

        <div class="help-actions">
          <button @click="showHelp = false" class="close-help-btn">{{ t('סגור', 'Close') }}</button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <SettingsModal v-if="showSettings" :focusMode="true" @close="showSettings = false" />

    <!-- Main Content - Sequential 3-Step Display -->
    <div ref="contentEl" class="focus-content" @pointerdown="handlePointerDown">
      <!-- Auto margins centre short content and let tall content start at
           the top, inside the scroll range (plain flex centring pushed the
           top of a tall pasuk above the scroll start). -->
      <div class="focus-inner">
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
              <div class="step-label" :key="stepLabel + fallbackNote">
                {{ stepLabel }}
                <div v-if="fallbackNote" class="step-note">{{ fallbackNote }}</div>
              </div>
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

        <!-- Instruction: touch devices get the tap wording, others the key. -->
        <div class="instruction">
          <span class="hint-touch">{{ hint.touch }}</span>
          <span class="hint-keys">{{ hint.keys }}</span>
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

    <!-- After a mark: a few seconds to take it back (a stray tap on a phone
         would otherwise record a reading that did not happen). -->
    <Transition name="motion-fade">
      <div v-if="undoBarVisible" class="undo-bar" role="status">
        <span>{{ t('סומן', 'Marked') }}</span>
        <button type="button" class="undo-bar-btn" @click.stop="undoFromBar">{{ t('ביטול', 'Undo') }}</button>
      </div>
    </Transition>

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

// 'complete': nothing is left to read in this view (fired just before that
// 'exit'); the parent decides whether that finished the whole parsha.
const emit = defineEmits(['exit', 'complete'])

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

// "פרק א : פסוק יג" for the label, "א:יג" for narrow screens.
const fullReference = computed(() => {
  const pasuk = shownVerse.value.pasuk
  if (!perekLabel.value) return `${t('פסוק', 'Pasuk')} ${pasuk ?? ''}`.trim()
  return `${t('פרק', 'Perek')} ${perekLabel.value} : ${t('פסוק', 'Pasuk')} ${pasuk ?? ''}`.trim()
})
const compactReference = computed(() => {
  const pasuk = shownVerse.value.pasuk ?? ''
  return perekLabel.value ? `${perekLabel.value}:${pasuk}` : `${pasuk}`
})

const stepDots = computed(() => [
  { step: 1, field: 'hebrew1', title: t('קריאה ראשונה (1)', 'First reading (1)'), label: t('קריאה ראשונה', 'First reading') },
  { step: 2, field: 'hebrew2', title: t('קריאה שנייה (2)', 'Second reading (2)'), label: t('קריאה שנייה', 'Second reading') },
  { step: 3, field: 'targum', title: t('תרגום (3)', 'Translation (3)'), label: t('תרגום', 'Translation') }
])

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

// Says why the counted Rashi / English was replaced by Onkelos on this pasuk.
// Display only: the same `targum` field is marked either way.
const fallbackNote = computed(() => {
  if (currentStep.value !== 3 || targumLayer.value !== 'onkelos') return ''
  const type = props.settings.targumType
  if (type === 'rashi') return t('אין רש"י על פסוק זה: אונקלוס במקום', 'No Rashi on this pasuk: Onkelos instead')
  if (type === 'english') return t('אין תרגום לאנגלית לפסוק זה: אונקלוס במקום', 'No English on this pasuk: Onkelos instead')
  return ''
})

// The line under the card. Touch devices see `touch`, others `keys` (CSS).
const hint = computed(() => {
  const s = shown.value
  if (s.step < 3) {
    return { touch: t('הקישו על הטקסט להמשך', 'Tap the text to continue'), keys: t('לחצו או [Space] להמשך', 'Tap or press [Space] to continue') }
  }
  if (s.index < totalVerses.value - 1) {
    return { touch: t('הקישו על הטקסט לפסוק הבא', 'Tap the text for the next pasuk'), keys: t('לחצו או [Space] לפסוק הבא', 'Tap or press [Space] for the next pasuk') }
  }
  if (pointerElsewhere.value) {
    return { touch: t('הקישו על הטקסט להשלמת מה שנותר', 'Tap the text to finish what is left'), keys: t('לחצו או [Space] להשלמת מה שנותר', 'Tap or press [Space] to finish what is left') }
  }
  return { touch: t('הקישו על הטקסט לסיום', 'Tap the text to finish'), keys: t('לחצו או [Space] לסיום', 'Tap or press [Space] to finish') }
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
  hideUndoBar()
})

// Single write path: refuses to touch storage when the index is stale.
const markPhase = (field, value) => {
  const key = verseKey.value
  if (!key) return false
  lastAction.value = { type: 'progress', parasha: props.parasha, key, field, prevValue: progress.value[field] }
  setVerseProgress(props.parasha, key, field, value)
  return true
}

// "Marked · Undo" bar, shown for a few seconds after each mark.
const UNDO_BAR_MS = 4000
const undoBarVisible = ref(false)
let undoBarTimer = null

const hideUndoBar = () => {
  if (undoBarTimer !== null) {
    clearTimeout(undoBarTimer)
    undoBarTimer = null
  }
  undoBarVisible.value = false
}

const showUndoBar = () => {
  hideUndoBar()
  undoBarVisible.value = true
  undoBarTimer = setTimeout(() => {
    undoBarTimer = null
    undoBarVisible.value = false
  }, UNDO_BAR_MS)
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

  if (markPhase(fieldOf(currentStep.value), true)) showUndoBar()

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
      emit('complete')
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
  if (markPhase(fieldOf(currentStep.value), true)) showUndoBar()
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

// The bar's Undo: the same undo as the U key, then back to the piece that was
// unmarked (by then the card has usually moved on to the next piece).
const undoFromBar = () => {
  const action = lastAction.value
  hideUndoBar()
  undoLastAction()
  if (!action || action.type !== 'progress' || action.parasha !== props.parasha) return
  const index = props.verses.findIndex(v => `${v.perekNum}:${v.pasukNum}` === action.key)
  if (index >= 0) moveTo({ index, step: PHASE_STEP[action.field] || 1 })
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
      hideUndoBar()
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
  /* Side buttons: distance from the screen edge, width, and the gap the
     content keeps from them. The content padding is derived from these. */
  --nav-edge: 1rem;
  --nav-w: 4rem;
  --nav-gap: 1rem;
}

/* The header is sized in rem: only the reading text follows the text-size
   setting, so the exit and settings buttons stay on screen at any size. */
.focus-header {
  background: var(--c-surface);
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--c-border-soft);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.verse-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  /* A 10rem basis keeps the buttons on the first row of a phone header;
     the labels and dots wrap inside this box instead. */
  flex: 1 1 10rem;
  min-width: 0;
}

/* Labels: same weights and colours as the list view's aliyah chip, perek
   and pasuk (VerseView .aliya-marker / .perek / .pasuk), at the sizes the
   list shows at the default text size (20px). */
.aliya-label {
  background: var(--c-border-soft);
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 1.125rem;
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
  font-size: 1.25rem;
}

.ref-full {
  display: contents;
}

.ref-compact {
  display: none;
  font-weight: 600;
  font-size: 1.1em;
  color: var(--c-text-2);
  white-space: nowrap;
}

.perek {
  font-weight: 600;
  font-size: 1.1em;
  color: var(--c-text-2);
}

.separator {
  color: var(--c-muted);
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

/* In Hebrew the mark sits at the right edge: point it inward. */
[dir="rtl"] .pointer-mark {
  display: inline-block;
  transform: scaleX(-1);
}

/* Step Indicators: a 32px button around a 16px dot. Ring = not read,
   gold (the pointer colour) = the piece on screen, green = read. */
.step-indicator {
  display: flex;
  gap: 0;
  align-items: center;
}

.step-indicator .step-dot {
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.step-dot::before {
  content: '';
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--c-muted);
  background: var(--c-surface);
  transition:
    background-color var(--motion-base) var(--ease-out),
    border-color var(--motion-base) var(--ease-out),
    transform var(--motion-base) var(--ease-out);
}

.step-dot.current::before {
  border-color: var(--c-pointer);
  background: var(--c-pointer);
  transform: scale(1.15);
}

.step-dot.done::before {
  border-color: var(--c-read-border);
  background: var(--c-read-border);
}

/* Read and on screen: green dot with a gold ring. */
.step-dot.current.done::before {
  box-shadow: 0 0 0 2px var(--c-surface), 0 0 0 4px var(--c-pointer);
}

.step-dot:hover::before {
  transform: scale(1.2);
}

.header-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-shrink: 0;
  margin-inline-start: auto;
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

/* Scrolls inside itself on short screens; Close is sticky at the bottom. */
.help-panel {
  background: var(--c-surface);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 450px;
  width: 90%;
  max-height: calc(100vh - 2rem);
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  padding: 2rem 2rem 0;
}

.help-panel h3 {
  margin-bottom: 1rem;
  color: var(--c-text);
  font-size: 1.3rem;
  text-align: center;
}

.help-section + .help-section {
  margin-top: 1.25rem;
}

.help-section h4 {
  margin-bottom: 0.5rem;
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
}

.help-list {
  padding-inline-start: 1.25rem;
  color: var(--c-text-2);
  font-size: 0.95rem;
  line-height: 1.5;
}

.help-list li + li {
  margin-top: 0.35rem;
}

.colour-key {
  list-style: none;
  display: grid;
  gap: 0.5rem;
  color: var(--c-text-2);
  font-size: 0.95rem;
}

.colour-key li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.swatch {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
}

.swatch-read {
  background: var(--c-read-bg);
  border: 3px solid var(--c-read-border);
}

.swatch-scope {
  background: var(--c-scope-bg);
  border: 3px solid var(--c-scope);
}

.swatch-mark {
  width: 1.25rem;
  flex-shrink: 0;
  text-align: center;
}

.help-actions {
  position: sticky;
  bottom: 0;
  background: var(--c-surface);
  padding: 1rem 0 2rem;
  margin-top: 0.5rem;
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

.shortcut .keys {
  display: flex;
  gap: 0.35rem;
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

/* Main Content - Sequential Display.
   Side padding keeps the card clear of the fixed side buttons at every
   width: the buttons' reach (edge + width + gap) minus the margin the 900px
   cap already leaves on each side; never less than 2rem. Percentages in
   padding resolve against .focus-mode's width. */
.focus-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  padding-inline: max(2rem, calc(var(--nav-edge) + var(--nav-w) + var(--nav-gap) - max(0px, (100% - 900px) / 2)));
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  /* the sliding card must not flash a horizontal scrollbar */
  overflow-x: hidden;
}

/* "Safe" centring: the auto margins centre short content and collapse to 0
   when the content is taller than the screen, so it starts at the top. */
.focus-inner {
  width: 100%;
  margin: auto 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-label {
  font-size: 1.1rem;
  color: var(--c-muted);
  margin-bottom: 1.5rem;
  font-weight: 500;
  text-align: center;
}

/* Why the counted Rashi / English was replaced by Onkelos here. */
.step-note {
  margin-top: 0.25rem;
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--c-text-2);
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
  color: var(--c-text-2);
  text-align: center;
}

.hint-touch {
  display: none;
}

/* A touch screen with no hover has no Space key to mention. */
@media (hover: none) and (pointer: coarse) {
  .hint-touch {
    display: inline;
  }

  .hint-keys {
    display: none;
  }
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
  width: var(--nav-w);
  padding: 1.5rem 0;
  border-radius: var(--radius-lg);
  font-size: 2rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--motion-base) var(--ease-out), background-color var(--motion-base) var(--ease-out);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
  z-index: 50;
}

.nav-btn-left {
  left: var(--nav-edge);
}

.nav-btn-right {
  right: var(--nav-edge);
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

/* "Marked · Undo", above the footer for a few seconds after a mark. */
.undo-bar {
  position: absolute;
  left: 50%;
  bottom: 4.75rem;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-block: 0.35rem;
  padding-inline: 1.1rem 0.35rem;
  background: var(--c-text);
  color: var(--c-surface);
  border-radius: 999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  font-size: 1rem;
  white-space: nowrap;
}

.undo-bar-btn {
  min-height: 40px;
  padding: 0.4rem 1rem;
  background: transparent;
  color: var(--c-read-soft);
  border: 1px solid var(--c-read-soft);
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.undo-bar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Larger screens: a bigger pasuk (and translation, keeping the ratio). */
@media (min-width: 1024px) {
  .torah {
    font-size: calc(var(--fs-hebrew) * 1.25);
  }

  .targum {
    font-size: calc(var(--fs-translation) * 1.25);
  }
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .focus-mode {
    --nav-edge: 0.5rem;
    --nav-w: 3rem;
    --nav-gap: 0.5rem;
  }

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
  }

  .text-display {
    padding: calc(1.5rem + 1px);
  }

  .text-display.step-complete {
    padding: 1.5rem;
  }

  .nav-btn {
    padding: 1rem 0;
    font-size: 1.5rem;
  }

  .perek,
  .pasuk {
    white-space: nowrap;
  }

  .help-panel {
    padding: 1.5rem 1.5rem 0;
  }

  .help-actions {
    padding-bottom: 1.5rem;
  }

  .shortcut kbd {
    min-width: 50px;
    font-size: 0.8rem;
  }
}

/* Phone: slimmer edge buttons, and side padding so the card never sits
   underneath them. */
@media (max-width: 600px) {
  .focus-mode {
    --nav-edge: 0.25rem;
    --nav-w: 2.25rem;
    --nav-gap: 0.25rem;
  }

  .focus-content {
    padding-block: 1rem;
  }

  .nav-btn {
    padding: 1.25rem 0;
    font-size: 1.25rem;
  }

  .text-display {
    padding: calc(1rem + 1px);
  }

  .text-display.step-complete {
    padding: 1rem;
  }
}

/* Narrow phones: "א:יג" instead of "Perek א : Pasuk יג". */
@media (max-width: 399px) {
  .ref-full {
    display: none;
  }

  .ref-compact {
    display: inline;
  }

  .help-btn,
  .settings-btn,
  .exit-btn {
    padding: 0.5rem 0.75rem;
  }
}
</style>
