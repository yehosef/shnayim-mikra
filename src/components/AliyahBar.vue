<template>
  <div class="aliyah-bar" dir="rtl" lang="he" role="list" :aria-label="isHebrew ? 'עליות' : 'Aliyot'">
    <button
      v-for="a in stats"
      :key="a.n"
      role="listitem"
      type="button"
      class="aliyah-chip"
      :class="{
        'is-current': a.n === currentN,
        'is-complete': a.total > 0 && a.complete === a.total,
        'is-selected': a.n === selectedN,
        'is-suggested': guideAliyot.includes(a.n)
      }"
      :title="chipTitle(a)"
      :aria-label="chipTitle(a)"
      @click="$emit('select', a.n)"
    >
      <span class="chip-name">{{ names[a.n - 1] }}</span>
      <span class="chip-count"><bdi dir="ltr">{{ a.complete }}/{{ a.total }}</bdi></span>
      <span v-if="a.n === currentN" class="chip-pointer" role="img" :aria-label="isHebrew ? 'כאן אתה נמצא' : 'You are here'">▶</span>
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  /** [{ n, hebrew1, hebrew2, targum, complete, total, percent }] */
  stats: { type: Array, required: true },
  /** aliyah number the reading pointer sits in */
  currentN: { type: Number, default: null },
  /** aliyah shown when displayMode === 'aliyah' */
  selectedN: { type: Number, default: null },
  /** today's advisory aliyot */
  guideAliyot: { type: Array, default: () => [] },
  isHebrew: { type: Boolean, default: false }
})

defineEmits(['select'])

const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי']

const chipTitle = (a) => {
  const parts = [`\u2068${names[a.n - 1]}\u2069: ${a.complete}/${a.total}`]
  if (props.guideAliyot.includes(a.n)) parts.push(props.isHebrew ? 'מומלץ להיום' : 'suggested for today')
  if (a.n === props.currentN) parts.push(props.isHebrew ? 'כאן אתה נמצא' : 'you are here')
  return parts.join(' · ')
}
</script>

<style scoped>
.aliyah-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.5rem 0;
}

.aliyah-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--c-border);
  background: var(--c-bg);
  color: var(--c-text-2);
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition:
    border-color var(--motion-base) var(--ease-out),
    background-color var(--motion-base) var(--ease-out);
}

.aliyah-chip:hover {
  border-color: var(--c-faint);
  background: var(--c-surface-2);
}

.aliyah-chip.is-complete {
  background: var(--c-read-bg);
  border-color: var(--c-read-border);
}

.aliyah-chip.is-suggested {
  border-style: dashed;
  border-color: var(--c-scope);
}

.aliyah-chip.is-current {
  border-color: var(--c-pointer);
  box-shadow: 0 0 0 2px rgba(var(--c-pointer-rgb), 0.35);
}

.aliyah-chip.is-selected {
  background: var(--c-scope-bg);
  border-color: var(--c-scope-strong);
  color: var(--c-scope-text);
}

.chip-name {
  font-weight: 600;
}

.chip-count {
  color: var(--c-muted);
  font-variant-numeric: tabular-nums;
}

.chip-pointer {
  color: var(--c-pointer);
  font-size: 0.8em;
}

/* Phone: one horizontally scrollable row instead of wrapping onto several
   lines. The padding keeps the pointer ring from being clipped by the scroll
   box. */
@media (max-width: 600px) {
  .aliyah-bar {
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 0.3rem;
    margin: 0.15rem 0;
    padding: 3px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .aliyah-bar::-webkit-scrollbar {
    display: none;
  }

  .aliyah-chip {
    flex-shrink: 0;
    padding: 0.2rem 0.5rem;
    font-size: 0.8rem;
  }
}
</style>
