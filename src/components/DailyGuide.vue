<template>
  <!-- Advisory status pill, shown only for the two states that tell the reader
       something new: Shabbat itself, and the catch-up days after it. The
       per-day suggestion lives on the aliyah chips (AliyahBar's "today" tag). -->
  <span v-if="statusText" class="guide-status" :class="'status-' + status">{{ statusText }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** 'upcoming' | 'open' | 'due' | 'late' | 'past' | null */
  status: { type: String, default: null },
  /** the parsha on screen is fully read: nothing left to urge */
  complete: { type: Boolean, default: false },
  isHebrew: { type: Boolean, default: false }
})

const statusText = computed(() => {
  const he = {
    due: 'שבת — עד סוף השבת',
    late: 'אחרי שבת — עדיין אפשר להשלים'
  }
  const en = {
    due: 'Shabbat — ideally done by nightfall',
    late: 'after Shabbat — still worth completing'
  }
  if (!props.status || props.complete) return ''
  return (props.isHebrew ? he : en)[props.status] || ''
})
</script>

<style scoped>
.guide-status {
  font-size: 0.85rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border-soft);
  color: var(--c-text-2);
}

.status-due {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.status-late {
  background: #fee2e2;
  border-color: #ef4444;
  color: #991b1b;
}
</style>
