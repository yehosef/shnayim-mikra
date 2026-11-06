<template>
  <!-- The one-reading view: the aliyah on screen in ONE reading at a time,
       as flowing text like a chumash page (Rashi stays a block per pasuk).
       Shown by ParshaDisplay for Reading order "Aliyah by aliyah" + View
       "Aliyah"; ParshaDisplay owns the selection, the marks and the keys.
       Pure decisions are in src/lib/layerStep.js. -->
  <section class="aliyah-reading" :dir="isHebrew ? 'rtl' : 'ltr'" :lang="isHebrew ? 'he' : 'en'">
    <div class="ar-head">
      <h2 class="ar-aliyah font-sbl" dir="rtl" lang="he">{{ aliyahName }}</h2>
      <!-- One tab per reading, with that reading's progress in this aliyah -->
      <div class="ar-tabs" role="group" :aria-label="t('הקריאה שעל המסך', 'Reading on screen')">
        <button
          v-for="tab in tabs"
          :key="tab.phase"
          type="button"
          class="ar-tab"
          :class="{ 'is-current': tab.phase === reading, 'is-done': tabDone(tab) }"
          :aria-pressed="tab.phase === reading"
          :title="`${readingName(tab.phase)} (${tab.phase})`"
          @click="press($event, 'show', tab.phase)"
        >
          <span class="ar-tab-name">{{ readingName(tab.phase) }}</span>
          <span v-if="tab.total > 0" class="ar-tab-count">
            <template v-if="tabDone(tab)">✓</template>
            <bdi v-else dir="ltr">{{ tab.read }}/{{ tab.total }}</bdi>
          </span>
        </button>
      </div>
      <!-- While the translation is on screen: which one counts (the same
           setting as in Settings; only one translation counts). -->
      <div v-if="reading === 3" class="ar-translation" role="group" aria-labelledby="ar-translation-label">
        <span id="ar-translation-label" class="ar-translation-label">{{ t('התרגום שנספר', 'Counted translation') }}</span>
        <span class="ar-segments">
          <button
            v-for="o in translationOptions"
            :key="o.value"
            type="button"
            class="ar-segment"
            :class="{ 'is-current': settings.targumType === o.value }"
            :aria-pressed="settings.targumType === o.value"
            @click="press($event, 'set-translation', o.value)"
          >{{ o.label }}</button>
        </span>
      </div>
    </div>

    <div ref="textEl" class="ar-text" @pointerdown="onPointerDown">
      <!-- Rashi: commentary, so a block per pasuk -->
      <div v-if="reading === 3 && plan.layout === 'rashi'" class="ar-rashi-list" dir="rtl" lang="he">
        <template v-for="(verse, i) in verses" :key="keyOf(verse)">
          <div v-if="verse.perek" class="ar-perek-head font-sbl">{{ perekLabel(verse) }}</div>
          <div
            class="ar-pasuk ar-block"
            :class="stateClasses(i)"
            :data-verse-index="i"
            role="button"
            tabindex="0"
            :aria-pressed="isRead(i)"
            @click="onTap(i, $event)"
            @keydown.enter.prevent.stop="onKey(i, $event)"
            @keydown.space.prevent.stop="onKey(i, $event)"
          >
            <div class="ar-block-head font-sbl">
              <span v-if="pointerIndex === i" class="ar-pointer" role="img" :aria-label="t('כאן אתם נמצאים', 'You are here')">▶</span>
              <span class="ar-num">{{ verse.pasuk }}</span>
            </div>
            <template v-if="layers[i] === 'rashi'">
              <div
                v-for="(comment, ci) in verse.rashi"
                :key="ci"
                class="rashi-comment"
                :class="{ 'font-rashi': settings.fontRashi }"
                v-html="comment"
              ></div>
            </template>
            <template v-else>
              <div class="ar-note" :dir="isHebrew ? 'rtl' : 'ltr'" :lang="isHebrew ? 'he' : 'en'">{{ fallbackNote }}</div>
              <div class="ar-targum-text font-sbl" lang="arc" v-html="verse.targum"></div>
            </template>
          </div>
        </template>
      </div>

      <!-- English: one LTR paragraph -->
      <div v-else-if="reading === 3 && plan.layout === 'english'" class="ar-flow ar-english" dir="ltr" lang="en">
        <template v-for="(verse, i) in verses" :key="keyOf(verse)">
          <span v-if="verse.perek" class="ar-perek">{{ `Chapter ${verse.perekNum + 1}` }}</span>
          <span
            class="ar-pasuk"
            :class="stateClasses(i)"
            :data-verse-index="i"
            role="button"
            tabindex="0"
            :aria-pressed="isRead(i)"
            @click="onTap(i, $event)"
            @keydown.enter.prevent.stop="onKey(i, $event)"
            @keydown.space.prevent.stop="onKey(i, $event)"
          ><span v-if="pointerIndex === i" class="ar-pointer" role="img" :aria-label="t('כאן אתם נמצאים', 'You are here')">▶</span><span class="ar-num">{{ verse.pasukNum + 1 }}</span><span v-if="layers[i] === 'english'" v-html="verse.english"></span><template v-else><span class="ar-note" :dir="isHebrew ? 'rtl' : 'ltr'" :lang="isHebrew ? 'he' : 'en'">({{ fallbackNote }})</span> <span class="font-sbl" dir="rtl" lang="arc" v-html="verse.targum"></span></template></span>{{ ' ' }}
        </template>
      </div>

      <!-- The two Hebrew readings, and Onkelos: one RTL paragraph -->
      <template v-else>
        <div v-if="reading === 3 && plan.note" class="ar-note ar-note-all" :dir="isHebrew ? 'rtl' : 'ltr'" :lang="isHebrew ? 'he' : 'en'">{{ fallbackNote }}</div>
        <div
          class="ar-flow font-sbl"
          :class="reading === 3 ? 'ar-targum' : 'ar-torah'"
          dir="rtl"
          :lang="reading === 3 ? 'arc' : 'he'"
        >
          <template v-for="(verse, i) in verses" :key="keyOf(verse)">
            <span v-if="verse.perek" class="ar-perek" lang="he">{{ perekLabel(verse) }}</span>
            <span
              class="ar-pasuk"
              :class="stateClasses(i)"
              :data-verse-index="i"
              role="button"
              tabindex="0"
              :aria-pressed="isRead(i)"
              @click="onTap(i, $event)"
              @keydown.enter.prevent.stop="onKey(i, $event)"
              @keydown.space.prevent.stop="onKey(i, $event)"
            ><span v-if="pointerIndex === i" class="ar-pointer" role="img" :aria-label="t('כאן אתם נמצאים', 'You are here')">▶</span><span class="ar-num">{{ verse.pasuk }}</span><template v-if="reading === 3"><span v-html="verse.targum"></span></template><template v-else>{{ hebrewText(verse) }}</template></span>{{ ' ' }}
          </template>
        </div>
      </template>
    </div>

    <!-- End of the text -->
    <div class="ar-end">
      <button v-if="end.state === 'finish'" type="button" class="ar-btn ar-finish" @click="press($event, 'finish')">
        {{ t('סיימתי את הקריאה', 'Finished this reading') }}
      </button>
      <template v-else-if="end.state === 'read'">
        <span class="ar-done">✓ {{ t('נקרא', 'Read') }}</span>
        <button type="button" class="ar-btn" @click="press($event, 'show', end.nextPhase)">{{ onToLabel(end.nextPhase) }}</button>
      </template>
      <template v-else>
        <span class="ar-done">{{ t('העלייה הושלמה ✓', 'Aliyah complete ✓') }}</span>
        <button v-if="hasNextAliyah" type="button" class="ar-btn" @click="press($event, 'next-aliyah')">
          {{ t('לעלייה הבאה', 'Next aliyah') }}
        </button>
      </template>
    </div>

    <!-- After "Finished this reading": a few seconds to take it back -->
    <Transition name="motion-fade">
      <div v-if="undoCount > 0" class="ar-undo-bar" role="status">
        <span>{{ undoText }}</span>
        <button type="button" class="ar-undo-btn" @click.stop="$emit('undo')">{{ t('ביטול', 'Undo') }}</button>
      </div>
    </Transition>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useInputMethod } from '../composables/useInputMethod'
import { formatHebrewText } from '../utils/hebrewUtils'
import { hasSelectionInside, movedTooFar } from '../utils/tapGuard'
import { translationLayerFor, translationLayout } from '../lib/layerStep'

const props = defineProps({
  /** displayVerses of the aliyah on screen */
  verses: { type: Array, required: true },
  /** the reading on screen: 1 | 2 | 3 */
  reading: { type: Number, required: true },
  /** { 1: boolean[], 2: boolean[], 3: boolean[] }, one entry per verse */
  readsByPhase: { type: Object, required: true },
  /** [{ phase, read, total }] */
  tabs: { type: Array, required: true },
  /** the keyboard selection in this reading, or -1 */
  selectedIndex: { type: Number, default: -1 },
  /** the reading pointer's pasuk when it is in this reading, or -1 */
  pointerIndex: { type: Number, default: -1 },
  aliyahName: { type: String, default: '' },
  settings: { type: Object, required: true },
  /** layerStep.readingEnd: { state, nextPhase } */
  end: { type: Object, required: true },
  hasNextAliyah: { type: Boolean, default: false },
  /** pesukim the last "Finished this reading" marked, while its Undo is offered */
  undoCount: { type: Number, default: 0 }
})

const emit = defineEmits(['tap', 'show', 'finish', 'undo', 'next-aliyah', 'set-translation'])

// Purple (keyboard selection) only after a key press, as in VerseView.
const { keyboardUsed } = useInputMethod()

const isHebrew = computed(() => props.settings.interfaceLanguage === 'he')
const t = (he, en) => (isHebrew.value ? he : en)

// A mouse or touch press on one of the view's buttons gives focus back to the
// page, so the next Space marks the selected pasuk instead of pressing the
// same button again (a second "Finished this reading" would mark the whole
// next reading). Keyboard activation (detail 0) keeps focus on the button.
const press = (event, name, arg) => {
  if (event?.detail > 0) event.currentTarget?.blur?.()
  emit(name, arg)
}

const keyOf = (verse) => `${verse.perekNum}:${verse.pasukNum}`
const read = computed(() => props.readsByPhase[props.reading] || [])
const isRead = (i) => !!read.value[i]

const translationNames = computed(() => ({
  onkelos: t('אונקלוס', 'Onkelos'),
  rashi: t('רש"י', 'Rashi'),
  english: t('אנגלית', 'English')
}))
const translationOptions = computed(() => [
  { value: 'onkelos', label: translationNames.value.onkelos },
  { value: 'rashi', label: translationNames.value.rashi },
  { value: 'english', label: translationNames.value.english }
])

const readingName = (phase) => {
  if (phase === 1) return t('קריאה ראשונה', '1st reading')
  if (phase === 2) return t('קריאה שנייה', '2nd reading')
  return translationNames.value[props.settings.targumType] || translationNames.value.onkelos
}

const onToLabel = (phase) => {
  if (phase === 1) return t('לקריאה הראשונה', 'On to the 1st reading')
  if (phase === 2) return t('לקריאה השנייה', 'On to the 2nd reading')
  return t(`ל${readingName(3)}`, `On to ${readingName(3)}`)
}

const tabDone = (tab) => tab.total > 0 && tab.read >= tab.total

// Per-pasuk translation layer: the counted one, or Onkelos where it is missing.
const layers = computed(() =>
  props.verses.map((v) =>
    translationLayerFor({ type: props.settings.targumType, hasRashi: !!v.rashi?.length, hasEnglish: !!v.english })
  )
)
const plan = computed(() => translationLayout({ type: props.settings.targumType, layers: layers.value }))

// Why Onkelos stands in for the counted Rashi / English (FocusMode's wording).
const fallbackNote = computed(() => {
  const type = props.settings.targumType
  if (type === 'rashi') return t('אין רש"י על פסוק זה: אונקלוס במקום', 'No Rashi on this pasuk: Onkelos instead')
  if (type === 'english') return t('אין תרגום לאנגלית לפסוק זה: אונקלוס במקום', 'No English on this pasuk: Onkelos instead')
  return ''
})

const perekLabel = (verse) => `פרק ${verse.perek}`
const hebrewText = (verse) => formatHebrewText(verse.torah, props.settings.showTrop)

// Read state, pointer and keyboard selection: three channels, all borders,
// backgrounds and markers; purple wins over gold (CSS order).
const stateClasses = (i) => ({
  'is-read': isRead(i),
  'is-pointer': props.pointerIndex === i,
  'is-selected': keyboardUsed.value && props.selectedIndex === i
})

const undoText = computed(() => {
  const n = props.undoCount
  if (n === 1) return t('סומן פסוק אחד', 'Marked 1 pasuk')
  return t(`סומנו ${n} פסוקים`, `Marked ${n} pesukim`)
})

// A tap marks or un-marks the pasuk; a drag or a text selection anywhere in
// the text does not (src/utils/tapGuard.js, the rule VerseView follows).
const textEl = ref(null)
let pointerStart = null
const onPointerDown = (e) => {
  pointerStart = { x: e.clientX, y: e.clientY }
}
const onTap = (i, event) => {
  const start = pointerStart
  pointerStart = null
  // A clicked pasuk must not keep focus: its own Enter / Space toggle would
  // then un-mark it on the next Space instead of marking the selection.
  if (event?.detail > 0) event.currentTarget?.blur?.()
  if (hasSelectionInside(textEl.value)) return
  if (start && event && movedTooFar(start, event)) return
  emit('tap', i)
}

// Enter / Space on a focused pasuk. A held key toggles once: its repeats are
// ignored, as the document handler ignores them (otherwise the mark flips on
// every repeat).
const onKey = (i, event) => {
  if (event?.repeat) return
  emit('tap', i)
}

// Keyboard focus on a pasuk follows the selection. After Enter / Space marks
// the focused pasuk the selection moves on, and the next Space must mark the
// pasuk now selected; left on the old one, it would un-mark it again. The
// arrow keys move the selection the same way. With nothing selected in this
// reading (parked, or the selection in another reading) the pasuk gives focus
// back to the page, whose Space never un-marks. Only when focus is already on
// a pasuk: a mouse or touch reader never gets a focus ring from this.
watch(
  () => [props.selectedIndex, props.reading],
  () => {
    const root = textEl.value
    const active = typeof document !== 'undefined' ? document.activeElement : null
    if (!root || !active || !root.contains(active) || !active.classList?.contains('ar-pasuk')) return
    const target = props.selectedIndex >= 0
      ? root.querySelector(`.ar-pasuk[data-verse-index="${props.selectedIndex}"]`)
      : null
    if (target === active) return
    if (target) target.focus({ preventScroll: true })
    else active.blur()
  },
  { flush: 'post' }
)
</script>

<style scoped>
.aliyah-reading {
  margin-bottom: 2rem;
}

.ar-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.ar-aliyah {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--c-text);
}

.ar-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.ar-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 40px;
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-pill);
  background: var(--c-surface);
  color: var(--c-text-2);
  font: inherit;
  font-size: 0.95rem;
  cursor: pointer;
  transition:
    background-color var(--motion-base) var(--ease-out),
    border-color var(--motion-base) var(--ease-out);
}

@media (hover: hover) {
  .ar-tab:hover {
    background: var(--c-surface-2);
    border-color: var(--c-faint);
  }
}

.ar-tab.is-done {
  background: var(--c-read-tint);
  border-color: var(--c-read-border);
}

/* The reading on screen: the same look as the selected aliyah chip */
.ar-tab.is-current {
  background: var(--c-scope-bg);
  border-color: var(--c-scope-strong);
  color: var(--c-scope-text);
  font-weight: 600;
}

.ar-tab:focus-visible {
  outline: 2px solid var(--c-scope);
  outline-offset: 2px;
}

.ar-tab-count {
  font-size: 0.85em;
  color: var(--c-text-2);
}

.ar-tab.is-done .ar-tab-count {
  color: var(--c-read-strong);
  font-weight: 700;
}

.ar-translation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.6rem;
  font-size: 0.9rem;
  color: var(--c-muted);
}

.ar-segments {
  display: inline-flex;
}

.ar-segment {
  min-height: 36px;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-2);
  font: inherit;
  cursor: pointer;
}

.ar-segment + .ar-segment {
  margin-inline-start: -1px;
}

.ar-segment:first-child {
  border-start-start-radius: var(--radius-md);
  border-end-start-radius: var(--radius-md);
}

.ar-segment:last-child {
  border-start-end-radius: var(--radius-md);
  border-end-end-radius: var(--radius-md);
}

.ar-segment.is-current {
  position: relative;
  background: var(--c-scope-bg);
  border-color: var(--c-scope-strong);
  color: var(--c-scope-text);
  font-weight: 600;
}

.ar-segment:focus-visible {
  position: relative;
  outline: 2px solid var(--c-scope);
  outline-offset: 1px;
}

.ar-text {
  background: var(--c-surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 3px rgba(var(--c-shadow-rgb), 0.08);
  padding: 1.25rem 1.5rem;
}

.ar-flow {
  margin: 0;
  text-align: justify;
  color: var(--c-text);
}

.ar-torah {
  font-size: var(--fs-hebrew);
  line-height: var(--lh-hebrew);
}

/* Translations: smaller than the Hebrew, with a comfortable line length */
.ar-targum,
.ar-english,
.ar-rashi-list {
  font-size: var(--fs-translation);
  line-height: var(--lh-translation);
  color: var(--c-text-2);
  max-inline-size: 36em;
  margin-inline: auto;
}

.ar-english {
  max-inline-size: 32em;
  text-align: left;
  line-height: 1.6;
}

/* One pasuk: an inline tap target. Wrapped lines each keep the background
   and edge (box-decoration-break). */
.ar-pasuk {
  cursor: pointer;
  border-radius: 4px;
  padding: 0.05em 0.15em;
  border-bottom: 2px solid transparent;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  transition:
    background-color var(--motion-colour) var(--ease-out),
    border-color var(--motion-colour) var(--ease-out),
    box-shadow var(--motion-colour) var(--ease-out);
}

@media (hover: hover) {
  .ar-pasuk:hover {
    background: var(--c-surface-2);
  }
}

.ar-pasuk.is-read {
  background: var(--c-read-bg);
  border-bottom-color: var(--c-read-border);
}

@media (hover: hover) {
  .ar-pasuk.is-read:hover {
    background: var(--c-read-hover);
  }
}

/* The reading pointer: gold edge (and the ▶ marker) */
.ar-pasuk.is-pointer {
  border-bottom-color: var(--c-pointer-strong);
}

/* Keyboard selection, only after a key press; declared last so purple wins */
.ar-pasuk.is-selected {
  border-bottom-color: var(--c-select);
  box-shadow: 0 0 0 2px var(--c-select);
}

.ar-pasuk:focus-visible {
  outline: 2px solid var(--c-scope);
  outline-offset: 1px;
}

.ar-num {
  font-size: 0.6em;
  font-weight: 700;
  color: var(--c-muted);
  vertical-align: 0.4em;
  margin-inline-end: 0.25em;
}

.ar-pointer {
  display: inline-block;
  color: var(--c-pointer-strong);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 0.6em;
  font-weight: bold;
  vertical-align: 0.4em;
  margin-inline-end: 0.15em;
  animation: arPointerPulse 1.5s ease-in-out infinite;
}

@keyframes arPointerPulse {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(2px); }
}

/* Where a new perek begins */
.ar-perek {
  display: inline-block;
  font-size: 0.6em;
  font-weight: 700;
  color: var(--c-text-2);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border-soft);
  border-radius: var(--radius-sm);
  padding: 0 0.4em;
  margin-inline: 0.2em 0.35em;
  vertical-align: 0.3em;
  white-space: nowrap;
}

.ar-perek-head {
  font-weight: 700;
  color: var(--c-text-2);
  margin: 0.5rem 0 0.4rem;
}

/* Rashi: a box per pasuk, the same three channels as the inline spans */
.ar-block {
  display: block;
  padding: 0.6rem 0.8rem;
  margin-bottom: 0.5rem;
  border: 2px solid var(--c-border-soft);
  border-radius: var(--radius-md);
}

.ar-block.is-read {
  background: var(--c-read-bg);
  border-color: var(--c-read-border);
}

.ar-block.is-pointer {
  border-color: var(--c-pointer-strong);
}

.ar-block.is-selected {
  border-color: var(--c-select);
}

.ar-block-head {
  margin-bottom: 0.25rem;
}

.ar-block-head .ar-num {
  font-size: 0.85em;
  vertical-align: baseline;
}

.ar-block-head .ar-pointer {
  font-size: 0.85em;
  vertical-align: baseline;
}

.rashi-comment + .rashi-comment {
  margin-top: 0.6em;
}

.font-rashi {
  font-family: 'Rashi', serif;
}

/* Onkelos standing in for Rashi / English */
.ar-note {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 0.75em;
  color: var(--c-muted);
}

.ar-note-all {
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  text-align: center;
}

.ar-end {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
  font-size: 1rem;
}

.ar-btn {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  background: var(--c-surface);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  font: inherit;
  cursor: pointer;
}

@media (hover: hover) {
  .ar-btn:hover {
    background: var(--c-surface-2);
    border-color: var(--c-faint);
  }
}

.ar-finish {
  color: var(--c-read-strong);
  border-color: var(--c-read-border);
  font-weight: 600;
}

.ar-done {
  font-weight: 600;
  color: var(--c-read-strong);
}

/* "Marked N pesukim · Undo", at the bottom for a few seconds */
.ar-undo-bar {
  position: fixed;
  left: 50%;
  bottom: 1.25rem;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-block: 0.35rem;
  padding-inline: 1.1rem 0.35rem;
  background: var(--c-text);
  color: var(--c-surface);
  border-radius: var(--radius-pill);
  box-shadow: 0 4px 12px rgba(var(--c-shadow-rgb), 0.2);
  font-size: 1rem;
  white-space: nowrap;
}

.ar-undo-btn {
  min-height: 40px;
  padding: 0.4rem 1rem;
  background: transparent;
  color: var(--c-read-soft);
  border: 1px solid var(--c-read-soft);
  border-radius: var(--radius-pill);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.ar-undo-btn:hover {
  background: var(--c-inverse-hover);
}

@media (prefers-reduced-motion: reduce) {
  .ar-pointer {
    animation: none;
  }
}

@media (max-width: 600px) {
  .ar-text {
    padding: 0.75rem 0.85rem;
  }

  /* Justified text on a phone stretches two or three large Hebrew words
     across a line with wide gaps; the chumash look is kept for wide screens. */
  .ar-flow {
    text-align: start;
  }
}
</style>
