<template>
  <div
    ref="barEl"
    class="aliyah-bar"
    :class="{ 'fade-start': hiddenStart, 'fade-end': hiddenEnd }"
    dir="rtl"
    lang="he"
    role="list"
    :aria-label="isHebrew ? 'עליות' : 'Aliyot'"
    @scroll.passive="updateFades"
  >
    <!-- The button is the hit area (40px tall); the visible chip is the inner
         .chip-face, so the chips keep their look. -->
    <button
      v-for="a in stats"
      :key="a.n"
      :ref="(el) => setChipEl(a.n, el)"
      role="listitem"
      type="button"
      class="aliyah-chip"
      :class="{
        'is-current': a.n === currentN,
        'is-complete': isComplete(a),
        'is-selected': a.n === selectedN,
        'is-suggested': isToday(a)
      }"
      :title="chipTitle(a)"
      :aria-label="chipTitle(a)"
      @click="$emit('select', a.n)"
    >
      <span class="chip-face">
        <span class="chip-name">{{ names[a.n - 1] }}</span>
        <span class="chip-count"><bdi dir="ltr">{{ a.complete }}/{{ a.total }}</bdi></span>
        <span v-if="isToday(a)" class="chip-today" :lang="isHebrew ? 'he' : 'en'">{{ isHebrew ? 'היום' : 'today' }}</span>
        <span v-if="a.n === currentN" class="chip-pointer" role="img" :aria-label="isHebrew ? 'כאן אתה נמצא' : 'You are here'">▶</span>
      </span>
    </button>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  /** [{ n, hebrew1, hebrew2, targum, complete, total, percent }] */
  stats: { type: Array, required: true },
  /** aliyah number the reading pointer sits in */
  currentN: { type: Number, default: null },
  /** aliyah shown when displayMode === 'aliyah' */
  selectedN: { type: Number, default: null },
  /** today's advisory aliyot (empty unless this is the coming week's parsha) */
  guideAliyot: { type: Array, default: () => [] },
  isHebrew: { type: Boolean, default: false }
})

defineEmits(['select'])

const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי']

const isComplete = (a) => a.total > 0 && a.complete === a.total
// The "today" tag: advisory, and only while that aliyah still has something unread.
const isToday = (a) => props.guideAliyot.includes(a.n) && !isComplete(a)

const chipTitle = (a) => {
  const parts = [`⁨${names[a.n - 1]}⁩: ${a.complete}/${a.total}`]
  if (isToday(a)) parts.push(props.isHebrew ? 'מומלץ להיום' : 'suggested for today')
  if (a.n === props.currentN) parts.push(props.isHebrew ? 'כאן אתה נמצא' : 'you are here')
  return parts.join(' · ')
}

// Phones show the chips in one sideways-scrolling row. Keep the selected (or
// the current) chip in view, and fade the edge that has more chips beyond it.
const barEl = ref(null)
const chipEls = new Map()
const setChipEl = (n, el) => {
  if (el) chipEls.set(n, el)
  else chipEls.delete(n)
}

const hiddenStart = ref(false)
const hiddenEnd = ref(false)

function updateFades() {
  const el = barEl.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 1) {
    hiddenStart.value = false
    hiddenEnd.value = false
    return
  }
  // scrollLeft is 0 at the inline start and grows in magnitude towards the
  // end in both directions (negative under rtl), so its absolute value is
  // the distance scrolled from the start.
  const fromStart = Math.abs(el.scrollLeft)
  hiddenStart.value = fromStart > 1
  hiddenEnd.value = fromStart < max - 1
}

function revealActiveChip() {
  const n = props.selectedN ?? props.currentN
  const chip = n != null ? chipEls.get(n) : null
  if (chip && typeof chip.scrollIntoView === 'function') {
    chip.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }
  updateFades()
}

let resizeObserver = null
onMounted(() => {
  nextTick(revealActiveChip)
  if (typeof ResizeObserver === 'function' && barEl.value) {
    resizeObserver = new ResizeObserver(() => updateFades())
    resizeObserver.observe(barEl.value)
  }
})
onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

watch(
  () => [props.selectedN, props.currentN, props.stats.length],
  () => nextTick(revealActiveChip)
)
</script>

<style scoped>
.aliyah-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.5rem 0;
}

/* Hit area: transparent, at least 40px tall. The look is on .chip-face. */
.aliyah-chip {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--c-text-2);
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.chip-face {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--c-border);
  background: var(--c-bg);
  transition:
    border-color var(--motion-base) var(--ease-out),
    background-color var(--motion-base) var(--ease-out);
}

.aliyah-chip:hover .chip-face {
  border-color: var(--c-faint);
  background: var(--c-surface-2);
}

.aliyah-chip.is-complete .chip-face {
  background: var(--c-read-bg);
  border-color: var(--c-read-border);
}

.aliyah-chip.is-current .chip-face {
  border-color: var(--c-pointer);
  box-shadow: 0 0 0 2px rgba(var(--c-pointer-rgb), 0.35);
}

.aliyah-chip.is-selected {
  color: var(--c-scope-text);
}

.aliyah-chip.is-selected .chip-face {
  background: var(--c-scope-bg);
  border-color: var(--c-scope-strong);
}

.aliyah-chip:focus-visible {
  outline: none;
}

.aliyah-chip:focus-visible .chip-face {
  outline: 2px solid var(--c-scope);
  outline-offset: 2px;
}

.chip-name {
  font-weight: 600;
}

.chip-count {
  color: var(--c-text-2);
  font-variant-numeric: tabular-nums;
}

/* Today's suggested aliyah: a small neutral tag, not a colour channel of its
   own (read / pointer / scope keep theirs). */
.chip-today {
  font-size: 0.75rem;
  line-height: 1.2;
  padding: 0 0.35rem;
  border-radius: var(--radius-pill);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-text-2);
}

.chip-pointer {
  color: var(--c-pointer);
  font-size: 0.8em;
}

/* Phone: one horizontally scrollable row instead of wrapping onto several
   lines. The padding keeps the pointer ring from being clipped by the scroll
   box. The edge with more chips beyond it fades out. The bar is pinned
   dir="rtl" (chips in Hebrew order), but both directions are handled. */
@media (max-width: 600px) {
  .aliyah-bar {
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 0.3rem;
    margin: 0.15rem 0;
    padding: 0 3px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .aliyah-bar::-webkit-scrollbar {
    display: none;
  }

  .aliyah-bar[dir='rtl'].fade-end,
  .aliyah-bar[dir='ltr'].fade-start {
    -webkit-mask-image: linear-gradient(to right, transparent, #000 2.5rem);
    mask-image: linear-gradient(to right, transparent, #000 2.5rem);
  }

  .aliyah-bar[dir='rtl'].fade-start,
  .aliyah-bar[dir='ltr'].fade-end {
    -webkit-mask-image: linear-gradient(to left, transparent, #000 2.5rem);
    mask-image: linear-gradient(to left, transparent, #000 2.5rem);
  }

  .aliyah-bar[dir='rtl'].fade-start.fade-end,
  .aliyah-bar[dir='ltr'].fade-start.fade-end {
    -webkit-mask-image: linear-gradient(to right, transparent, #000 2.5rem, #000 calc(100% - 2.5rem), transparent);
    mask-image: linear-gradient(to right, transparent, #000 2.5rem, #000 calc(100% - 2.5rem), transparent);
  }

  .aliyah-chip {
    flex-shrink: 0;
    font-size: 0.95rem;
  }

  .chip-face {
    padding: 0.2rem 0.5rem;
  }
}
</style>
