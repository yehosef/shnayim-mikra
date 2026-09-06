<template>
  <div dir="rtl" :style="{ fontSize: settings.fontSize + 'px' }">
    <ParshaDisplay v-if="currentParsha" :parasha="currentParsha" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useParsha } from './composables/useParsha'
import { useSettings } from './composables/useSettings'
import ParshaDisplay from './components/ParshaDisplay.vue'

const { getWeeklyParsha } = useParsha()
const { settings } = useSettings()

// Empty until the hash / weekly parsha is resolved, so we never fetch a
// chumash we are not about to show.
const currentParsha = ref('')

// Handle routing
const updateParsha = () => {
  const hash = window.location.hash.slice(1) // Remove #
  if (hash && hash.length > 0) {
    currentParsha.value = hash
  } else {
    const weekly = getWeeklyParsha(settings.value.location)
    currentParsha.value = weekly || 'bereshit'
    if (!window.location.hash) {
      window.location.hash = currentParsha.value
    }
  }
}

onMounted(() => {
  updateParsha()
  window.addEventListener('hashchange', updateParsha)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', updateParsha)
})
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}

@font-face {
  font-family: 'SBL Hebrew';
  src: url('/SBL_Hbrw.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Rashi';
  src: url('/Mekorot-Rashi.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

.font-sbl {
  font-family: 'SBL Hebrew', serif;
}
</style>
