<template>
  <div class="settings-overlay" @click.self="$emit('close')">
    <div class="settings-modal">
      <div class="settings-header">
        <h3>{{ isHebrew ? 'הגדרות' : 'Settings' }}</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="settings-content">
        <!-- Interface Language -->
        <label>
          {{ isHebrew ? 'שפת ממשק:' : 'Interface Language:' }}
          <select v-model="settings.interfaceLanguage">
            <option value="en">English</option>
            <option value="he">עברית</option>
          </select>
        </label>

        <!-- Display Mode (only show if not in focus mode) -->
        <label v-if="!focusMode">
          {{ isHebrew ? 'תצוגה:' : 'Display Mode:' }}
          <select v-model="settings.displayMode">
            <option value="pasuk">{{ isHebrew ? 'פסוק פסוק' : 'Verse by Verse' }}</option>
            <option value="parasha">{{ isHebrew ? 'לפי פרשה' : 'By Parsha' }}</option>
            <option value="aliyah">{{ isHebrew ? 'לפי עליה' : 'By Aliyah' }}</option>
          </select>
        </label>

        <!-- Targum Type -->
        <label>
          {{ isHebrew ? 'סוג תרגום למעקב:' : 'Targum Type for Tracking:' }}
          <select v-model="settings.targumType">
            <option value="onkelos">{{ isHebrew ? 'תרגום אונקלוס' : 'Targum Onkelos' }}</option>
            <option value="rashi">{{ isHebrew ? 'רש"י' : 'Rashi' }}</option>
            <option value="english">English</option>
          </select>
        </label>

        <!-- Show Cantillation Marks -->
        <label>
          <input type="checkbox" v-model="settings.showTrop" />
          {{ isHebrew ? 'הצג טעמים' : 'Show Cantillation Marks' }}
        </label>

        <!-- Show Rashi Commentary -->
        <label>
          <input type="checkbox" v-model="settings.showRashi" />
          {{ isHebrew ? 'הצג רש"י' : 'Show Rashi Commentary' }}
        </label>

        <!-- Show English Translation -->
        <label>
          <input type="checkbox" v-model="settings.showEnglish" />
          {{ isHebrew ? 'הצג תרגום אנגלי' : 'Show English Translation' }}
        </label>

        <!-- Font Size -->
        <label>
          {{ isHebrew ? 'גודל גופן:' : 'Font Size:' }} {{ settings.fontSize }}
          <input type="range" v-model.number="settings.fontSize" min="14" max="32" />
        </label>

        <!-- Rashi Script -->
        <label>
          <input type="checkbox" v-model="settings.fontRashi" />
          {{ isHebrew ? 'כתב רש"י' : 'Rashi Script' }}
        </label>

        <!-- Location (only show if not in focus mode) -->
        <label v-if="!focusMode">
          {{ isHebrew ? 'מיקום:' : 'Location:' }}
          <select v-model="settings.location">
            <option value="israel">{{ isHebrew ? 'ישראל' : 'Israel' }}</option>
            <option value="chul">{{ isHebrew ? 'חו"ל' : 'Diaspora' }}</option>
          </select>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSettings } from '../composables/useSettings'

const props = defineProps({
  focusMode: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const { settings } = useSettings()

const isHebrew = computed(() => settings.value.interfaceLanguage === 'he')
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.settings-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background: white;
  border-radius: 12px 12px 0 0;
}

.settings-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.75rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #1f2937;
}

.settings-content {
  padding: 1.5rem;
}

.settings-content label {
  display: block;
  margin-bottom: 1rem;
  color: #374151;
  font-size: 1rem;
}

.settings-content input[type="checkbox"] {
  margin-left: 0.5rem;
}

.settings-content select,
.settings-content input[type="range"] {
  margin-right: 0.5rem;
}

.settings-content select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.95rem;
  min-width: 150px;
}

.settings-content input[type="range"] {
  width: 100%;
  margin-top: 0.5rem;
}
</style>
