<template>
  <div class="daily-guide">
    <span class="guide-text">{{ guideText }}</span>
    <span v-if="statusText" class="guide-status" :class="'status-' + status">{{ statusText }}</span>
    <span v-if="showNotice" class="guide-notice">
      {{ noticeText }}
      <button type="button" class="notice-dismiss" @click="dismissNotice" :title="isHebrew ? 'סגור' : 'Dismiss'">✕</button>
    </span>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  /** { aliyot: number[], review: boolean } */
  guide: { type: Object, required: true },
  /** 'upcoming' | 'open' | 'due' | 'late' | 'past' | null */
  status: { type: String, default: null },
  isHebrew: { type: Boolean, default: false }
})

const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי']

const guideText = computed(() => {
  const { aliyot, review } = props.guide
  if (aliyot.length === 0) {
    if (review) return props.isHebrew ? 'היום: חזרה / השלמה' : 'Today: review / catch up'
    return props.isHebrew ? 'היום: אין המלצה' : 'Today: no suggestion'
  }
  const list = aliyot.map(n => names[n - 1]).join(props.isHebrew ? ' ו' : ', ')
  return props.isHebrew ? `מומלץ להיום: ${list}` : `Suggested today: ${list}`
})

const statusText = computed(() => {
  const he = {
    upcoming: 'השבוע הבא',
    open: 'השבוע',
    due: 'שבת — עד סוף השבת',
    late: 'אחרי שבת — עדיין אפשר להשלים',
    past: 'שבוע שעבר'
  }
  const en = {
    upcoming: 'next week',
    open: 'this week',
    due: 'Shabbat — ideally done by nightfall',
    late: 'after Shabbat — still worth completing',
    past: 'last week'
  }
  if (!props.status) return ''
  return (props.isHebrew ? he : en)[props.status] || ''
})

// One-time notice: aliyah boundaries were corrected in this version, so
// groupings shift by one aliyah compared with the previous release.
const NOTICE_KEY = 'shnayim-notice-aliyot-v1'
const PROGRESS_KEY = 'shnayim-progress'
const showNotice = ref(readNotice())
function hasExistingProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && Object.keys(parsed).length > 0
  } catch (e) {
    return false
  }
}
function readNotice() {
  try {
    if (!hasExistingProgress()) {
      // Brand-new install: nothing to correct, so seed dismissal and never show it.
      localStorage.setItem(NOTICE_KEY, 'dismissed')
      return false
    }
    return localStorage.getItem(NOTICE_KEY) !== 'dismissed'
  } catch (e) {
    return false
  }
}
const dismissNotice = () => {
  showNotice.value = false
  try { localStorage.setItem(NOTICE_KEY, 'dismissed') } catch (e) { /* ignore */ }
}
const noticeText = computed(() => props.isHebrew
  ? 'גבולות העליות תוקנו בגרסה זו (ראשון מתחיל בתחילת הפרשה).'
  : 'Aliyah boundaries were corrected in this version (Rishon now starts at the beginning of the parsha).')
</script>

<style scoped>
.daily-guide {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: #4b5563;
  margin: 0.25rem 0 0.5rem;
}

.guide-text {
  font-weight: 500;
}

.guide-status {
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
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

.guide-notice {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
}

.notice-dismiss {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.9em;
  padding: 0 0.2rem;
}
</style>
