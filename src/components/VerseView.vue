<template>
  <div
    class="verse"
    dir="rtl"
    lang="he"
    :class="{
      'completed': isCompleted,
      'current-verse': isPointer,
      'in-current-aliyah': inCurrentAliyah,
      'selected': isSelected
    }"
    :data-perek="verse.perekNum"
    :data-pasuk="verse.pasukNum"
    :data-verse-index="index"
    @pointerdown="handlePointerDown"
    @click="handleRootClick"
  >
    <!-- Verse Pointer (next unread step lives in this verse) -->
    <div v-if="isPointer" class="verse-pointer" :title="pointerTitle" role="img" :aria-label="pointerLabel">
      <span class="pointer-icon">▶</span>
    </div>

    <!-- Completion Indicator — also a toggle for the whole pasuk: marks all
         three readings when incomplete, clears all three when complete. -->
    <div
      class="completion-indicator"
      :class="{ 'complete': isCompleted }"
      role="button"
      tabindex="0"
      :aria-pressed="isCompleted"
      :title="completeTitle"
      :aria-label="completeTitle"
      @click.stop="emit('toggle-complete')"
      @keydown.enter.prevent.stop="emit('toggle-complete')"
      @keydown.space.prevent.stop="emit('toggle-complete')"
    >
      <span v-if="isCompleted" class="completion-checkmark">✓</span>
      <span v-else class="completion-dot"></span>
    </div>

    <!-- Focus Button -->
    <button @click="$emit('focus', index)" class="focus-btn" :title="focusTitle" :aria-label="focusTitle">🔍</button>

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
      @click="handlePhaseClick(1, 'hebrew1', $event)"
    >
      {{ formattedTorahText }}
    </div>

    <!-- Hebrew Text - Second Reading -->
    <div
      class="torah font-sbl clickable-text"
      :class="{ 'reading-done': progress.hebrew2, 'phase-selected': selectedPhase === 2 }"
      @click="handlePhaseClick(2, 'hebrew2', $event)"
    >
      {{ formattedTorahText }}
    </div>

    <!-- Targum - Clickable (shown if Onkelos is selected as targum type) -->
    <div
      v-if="targumLayer === 'onkelos'"
      class="targum font-sbl clickable-text"
      :class="{ 'reading-done': progress.targum, 'phase-selected': selectedPhase === 3 }"
      @click="handlePhaseClick(3, 'targum', $event)"
      v-html="verse.targum"
    ></div>

    <!-- Rashi - Clickable (shown if selected as targum type) -->
    <div
      v-if="targumLayer === 'rashi'"
      class="rashi clickable-text"
      :class="{ 'reading-done': progress.targum, 'font-rashi': settings.fontRashi, 'phase-selected': selectedPhase === 3 }"
      @click="handlePhaseClick(3, 'targum', $event)"
      v-html="verse.rashi.join('  ')"
    ></div>

    <!-- English - Clickable (shown if selected as targum type) -->
    <div
      v-if="targumLayer === 'english'"
      class="english clickable-text"
      lang="en"
      :class="{ 'reading-done': progress.targum, 'phase-selected': selectedPhase === 3 }"
      @click="handlePhaseClick(3, 'targum', $event)"
      v-html="verse.english"
    ></div>

    <!-- English (shown if enabled in settings AND not selected as targum type) -->
    <div
      v-if="settings.showEnglish && settings.targumType !== 'english' && verse.english"
      class="english"
      lang="en"
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

// 'click' is declared so the parent's @click on <VerseView> is a component
// event, not a fallthrough native listener on the root div (a native root
// listener fired after the phase click and reverted the advanced selection).
const emit = defineEmits(['focus', 'phase-click', 'click', 'toggle-complete'])

const { getVerseProgress } = useProgress()

const verseKey = computed(() => `${props.verse.perekNum}:${props.verse.pasukNum}`)
const progress = computed(() => getVerseProgress(props.parasha, verseKey.value))

const isCompleted = computed(() => {
  return progress.value.hebrew1 && progress.value.hebrew2 && progress.value.targum
})

// The layer that counts as "targum" for this verse. Falls back to Onkelos
// when the chosen layer is unavailable (offline before Rashi/English were
// downloaded, or a verse with no Rashi), so the obligation stays completable.
const targumLayer = computed(() => {
  const type = props.settings.targumType
  if (type === 'rashi' && props.verse.rashi?.length) return 'rashi'
  if (type === 'english' && props.verse.english) return 'english'
  return 'onkelos'
})

// Interface language (settings.interfaceLanguage: 'en' default | 'he').
const isHebrew = computed(() => props.settings.interfaceLanguage === 'he')
const t = (he, en) => (isHebrew.value ? he : en)

const completeTitle = computed(() =>
  isCompleted.value
    ? t('בטל סימון הפסוק', 'Clear this pasuk')
    : t('סמן את כל הפסוק כנקרא', 'Mark the whole pasuk as read')
)
const focusTitle = computed(() => t('התמקד בפסוק זה', 'Focus on this pasuk'))

const pointerTitle = computed(() => {
  const p = progress.value
  if (!p.hebrew1) return t('קריאה ראשונה', 'First reading')
  if (!p.hebrew2) return t('קריאה שנייה', 'Second reading')
  return t('תרגום', 'Translation')
})
const pointerLabel = computed(() => `${t('כאן אתה נמצא', 'You are here')}: ${pointerTitle.value}`)

// A pointer that moved more than this between down and up is a drag
// (text selection / scroll), not a tap on a reading target.
const DRAG_THRESHOLD_PX = 8

let pointerStart = null

const handlePointerDown = (e) => {
  pointerStart = { x: e.clientX, y: e.clientY }
}

/** True when a live (non-collapsed) selection is anchored inside `el`. */
const hasSelectionInside = (el) => {
  if (!el || typeof window === 'undefined' || !window.getSelection) return false
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
  const anchor = sel.anchorNode
  if (!anchor) return false
  const node = anchor.nodeType === 1 ? anchor : anchor.parentNode
  return !!(node && el.contains(node))
}

// Handle click on a phase - emit to parent which handles toggle + advance logic
const handlePhaseClick = (phase, field, event) => {
  const start = pointerStart
  pointerStart = null

  const target = event?.currentTarget || null
  // Drag-to-select (to copy/quote) must not mark the phase read.
  if (hasSelectionInside(target)) return
  if (start && event && typeof event.clientX === 'number') {
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return
  }

  // Check if currently read before emitting
  const wasRead = progress.value[field]
  emit('phase-click', { phase, field, wasRead })
}

// Only the non-text chrome of the card selects the verse; clicks on a reading
// target or the focus button are handled by their own handlers.
const handleRootClick = (e) => {
  if (e.target?.closest?.('.clickable-text, .focus-btn, .completion-indicator')) return
  emit('click', e)
}

const formattedTorahText = computed(() => {
  return formatHebrewText(props.verse.torah, props.settings.showTrop)
})
</script>

<style scoped>
.verse {
  background: var(--c-surface);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition:
    background-color var(--motion-base) var(--ease-out),
    border-color var(--motion-base) var(--ease-out);
  position: relative;
}

.verse:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.verse {
  border-right: 4px solid var(--c-read-border);
  padding-right: 2.5rem;
}

.verse.completed {
  background: linear-gradient(to left, var(--c-read-tint) 0%, var(--c-surface) 100%);
  border-right-color: var(--c-read-strong);
}

.focus-btn {
  position: absolute;
  top: 1rem;
  left: 0.75rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--motion-base) var(--ease-out), transform var(--motion-base) var(--ease-out);
  font-size: 1.2rem;
}

.focus-btn:hover {
  background: var(--c-border-soft);
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
  transition: background-color var(--motion-base) var(--ease-out);
  cursor: pointer;
}

.completion-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c-border);
}

.completion-indicator.complete {
  background: var(--c-read-strong);
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
  background: var(--c-border-soft);
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  margin-bottom: 0.75rem;
  font-size: 0.9em;
  color: var(--c-text-2);
}

.verse-header {
  margin-bottom: 0.75rem;
}

.perek {
  font-weight: 600;
  margin-left: 0.5rem;
  font-size: 1.1em;
  color: var(--c-text-2);
}

.pasuk {
  font-weight: 600;
  margin-left: 0.5rem;
  font-size: 0.9em;
  color: var(--c-muted);
}

.clickable-text {
  cursor: pointer;
  padding: 1rem;
  margin-bottom: 0.75rem;
  border-radius: var(--radius-md);
  border: 2px solid var(--c-border);
  /* Green appears within --motion-colour; colours and the hover lift only. */
  transition:
    background-color var(--motion-colour) var(--ease-out),
    border-color var(--motion-colour) var(--ease-out),
    transform var(--motion-fast) var(--ease-out);
  background: var(--c-surface);
}

.clickable-text:hover {
  background: var(--c-surface-2);
  border-color: var(--c-faint);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.clickable-text.reading-done {
  background: var(--c-read-bg);
  border-color: var(--c-read-border);
  border-width: 3px;
}

.clickable-text.reading-done:hover {
  background: #bbf7d0;
}

/* Phase selected (keyboard navigation) */
.clickable-text.phase-selected {
  border-color: var(--c-select);
  background: linear-gradient(135deg, rgba(var(--c-select-rgb), 0.1) 0%, rgba(var(--c-select-rgb), 0.05) 100%);
  box-shadow: 0 0 0 2px rgba(var(--c-select-rgb), 0.4), 0 2px 8px rgba(var(--c-select-rgb), 0.2);
}

.clickable-text.phase-selected:hover {
  box-shadow: 0 0 0 2px rgba(var(--c-select-rgb), 0.5), 0 4px 12px rgba(var(--c-select-rgb), 0.25);
}

.clickable-text.phase-selected.reading-done {
  background: linear-gradient(135deg, rgba(var(--c-select-rgb), 0.15) 0%, var(--c-read-bg) 100%);
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
  margin-bottom: 0.5rem;
}

/* Rashi / English: reference size and the darker translation grey. */
.rashi,
.english {
  font-size: var(--fs-reference);
  line-height: var(--lh-translation);
  color: var(--c-text-2);
}

/* When one of them is the counted translation it is a piece box and takes the
   translation size, like Onkelos and like the focus card. */
.rashi.clickable-text,
.english.clickable-text {
  font-size: var(--fs-translation);
}

/* The rule above a reference block belongs to the NON-clickable variants only.
   These rules used to apply to the piece box too and overrode its border and
   padding, so a read Rashi/English box showed a thin grey top edge. */
.rashi:not(.clickable-text),
.english:not(.clickable-text) {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--c-border-soft);
}

.english {
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
  color: var(--c-pointer);
  font-size: 1.5rem;
  font-weight: bold;
}

@keyframes pointerPulse {
  0%, 100% { opacity: 1; transform: translateX(0); } /* allow-opacity: decorative non-text pointer icon pulse */
  50% { opacity: 0.6; transform: translateX(-4px); } /* allow-opacity: decorative non-text pointer icon pulse */
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
  background: var(--c-read-border);
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
    background: var(--c-read-border);
  }
  100% {
    /* allow-opacity: fade-out of the checkmark badge, not text */
    opacity: 0;
    transform: scale(0.5);
  }
}

/* Verse background when showing completion */
.verse.showing-completion {
  background: linear-gradient(to left, rgba(16, 185, 129, 0.1) 0%, var(--c-surface) 100%);
}

/* Verses in the current aliyah - subtle highlighting */
.verse.in-current-aliyah {
  border-right-color: var(--c-scope);
  background: linear-gradient(to left, rgba(var(--c-scope-rgb), 0.03) 0%, var(--c-surface) 100%);
}

.verse.in-current-aliyah:hover {
  background: linear-gradient(to left, rgba(var(--c-scope-rgb), 0.08) 0%, var(--c-surface) 100%);
}

/* Current verse (holds the reading pointer) - stronger emphasis.
   Declared after .in-current-aliyah so it wins by source order. */
.verse.current-verse {
  border-right-color: var(--c-pointer);
  background: linear-gradient(to left, rgba(var(--c-pointer-rgb), 0.1) 0%, var(--c-surface) 100%);
  box-shadow: 0 2px 8px rgba(var(--c-pointer-rgb), 0.1);
}

.verse.current-verse:hover {
  box-shadow: 0 4px 12px rgba(var(--c-pointer-rgb), 0.15);
}

/* Selected verse (keyboard navigation) */
.verse.selected {
  border-right-color: var(--c-select);
  background: linear-gradient(to left, rgba(var(--c-select-rgb), 0.08) 0%, var(--c-surface) 100%);
  box-shadow: 0 0 0 2px rgba(var(--c-select-rgb), 0.3), 0 4px 12px rgba(var(--c-select-rgb), 0.15);
}

.verse.selected:hover {
  box-shadow: 0 0 0 2px rgba(var(--c-select-rgb), 0.4), 0 6px 16px rgba(var(--c-select-rgb), 0.2);
}

/* Reduced motion: no pulsing pointer, no pop, no hover lift. The colours
   (read, pointer, selection) are unchanged. */
@media (prefers-reduced-motion: reduce) {
  .verse-pointer,
  .completion-indicator.complete,
  .feedback-checkmark {
    animation: none;
  }

  .clickable-text:hover,
  .focus-btn:hover {
    transform: none;
  }
}

/* Phone: tighter card and piece boxes so the three pieces of a short pasuk
   fit under the compact header. Spacing only; nothing is hidden. */
@media (max-width: 600px) {
  .verse {
    padding: 0.75rem;
    padding-right: 2.25rem;
    margin-bottom: 0.75rem;
  }

  .focus-btn {
    top: 0.6rem;
  }

  .completion-indicator {
    top: 0.6rem;
  }

  .aliya-marker {
    margin-bottom: 0.4rem;
  }

  .verse-header {
    margin-bottom: 0.4rem;
  }

  .clickable-text {
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.5rem;
  }

  .targum {
    margin-bottom: 0.25rem;
  }
}
</style>
