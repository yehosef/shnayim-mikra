<template>
  <!-- A row of real radios (visually hidden, so arrow keys move the choice)
       drawn as joined buttons. A value matching no option selects nothing. -->
  <div class="segmented">
    <label v-for="o in options" :key="o.value" class="segment">
      <input
        type="radio"
        class="segment-input"
        :name="name"
        :value="o.value"
        :checked="modelValue === o.value"
        @change="$emit('update:modelValue', o.value)"
      />
      <span class="segment-face" :lang="o.lang || null">{{ o.label }}</span>
    </label>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: [String, Number, Boolean], default: null },
  /** [{ value, label, lang? }] */
  options: { type: Array, required: true },
  /** radio group name, unique within the page */
  name: { type: String, required: true }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.segmented {
  display: inline-flex;
  max-width: 100%;
}

.segment {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  cursor: pointer;
}

.segment + .segment {
  margin-inline-start: -1px;
}

/* Hidden from sight only: still focusable and still a radio to the keyboard. */
.segment-input {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  clip-path: inset(50%);
}

.segment-face {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  padding: 0.25rem 0.85rem;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 1rem;
  line-height: 1.25;
  text-align: center;
  transition:
    background-color var(--motion-colour) var(--ease-out),
    border-color var(--motion-colour) var(--ease-out),
    color var(--motion-colour) var(--ease-out);
}

.segment:first-child .segment-face {
  border-start-start-radius: var(--radius-md);
  border-end-start-radius: var(--radius-md);
}

.segment:last-child .segment-face {
  border-start-end-radius: var(--radius-md);
  border-end-end-radius: var(--radius-md);
}

.segment:hover .segment-face {
  background: var(--c-surface-2);
}

.segment-input:checked + .segment-face {
  position: relative;
  z-index: 1;
  background: var(--c-scope-bg);
  border-color: var(--c-scope-strong);
  color: var(--c-scope-text);
  font-weight: 600;
}

.segment-input:focus-visible + .segment-face {
  position: relative;
  z-index: 2;
  outline: 2px solid var(--c-scope-strong);
  outline-offset: 2px;
}
</style>
