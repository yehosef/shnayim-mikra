<template>
  <div class="aliyah-bar" role="list">
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
      @click="$emit('select', a.n)"
    >
      <span class="chip-name">{{ names[a.n - 1] }}</span>
      <span class="chip-count">{{ a.complete }}/{{ a.total }}</span>
      <span v-if="a.n === currentN" class="chip-pointer" aria-label="current">▶</span>
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
  const parts = [`${names[a.n - 1]}: ${a.complete}/${a.total}`]
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
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  color: #374151;
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.aliyah-chip:hover {
  border-color: #9ca3af;
  background: #f3f4f6;
}

.aliyah-chip.is-complete {
  background: #dcfce7;
  border-color: #10b981;
}

.aliyah-chip.is-suggested {
  border-style: dashed;
  border-color: #3b82f6;
}

.aliyah-chip.is-current {
  border-color: #d4a574;
  box-shadow: 0 0 0 2px rgba(212, 165, 116, 0.35);
}

.aliyah-chip.is-selected {
  background: #dbeafe;
  border-color: #2563eb;
  color: #1e40af;
}

.chip-name {
  font-weight: 600;
}

.chip-count {
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}

.chip-pointer {
  color: #d4a574;
  font-size: 0.8em;
}
</style>
