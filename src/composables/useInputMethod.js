import { ref } from 'vue'

/**
 * Whether the reader is driving the list with the keyboard.
 *
 * The purple keyboard selection means "the piece the next Space press marks".
 * On a touch screen there is no Space key, so the purple styles are shown only
 * after a navigation or marking key has been pressed, and hidden again on the
 * next touch. The gold reading pointer is shown either way.
 *
 * One shared flag for the whole app; the document listeners are attached on
 * the first useInputMethod() call (never in a non-DOM environment, e.g. tests).
 */

// Keys the list and focus views act on (src/lib/inputGuard.js).
const NAV_KEYS = new Set([
  ' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  '1', '2', '3', 'm', 'M', 'u', 'U'
])

/**
 * Pure decision: the next value of `keyboardUsed`.
 * - `eventKind` 'keydown' with a navigation/marking `key` -> true
 * - `eventKind` 'touchstart' -> false
 * - anything else leaves `current` unchanged.
 */
export function nextInputMethod(current, eventKind, key) {
  if (eventKind === 'keydown') return NAV_KEYS.has(key) ? true : !!current
  if (eventKind === 'touchstart') return false
  return !!current
}

const TYPING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

const keyboardUsed = ref(false)
let listening = false

function listen() {
  if (listening || typeof document === 'undefined') return
  listening = true
  // Capture phase, so a handler that stops propagation cannot hide the press.
  document.addEventListener('keydown', (e) => {
    // Typing a digit into a settings field, or a browser shortcut, is not
    // keyboard navigation.
    if (TYPING_TAGS.has(e.target?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return
    keyboardUsed.value = nextInputMethod(keyboardUsed.value, 'keydown', e.key)
  }, true)
  document.addEventListener('touchstart', () => {
    keyboardUsed.value = nextInputMethod(keyboardUsed.value, 'touchstart')
  }, { capture: true, passive: true })
}

/** `{ keyboardUsed }`: a shared read-only-by-convention ref<boolean>. */
export function useInputMethod() {
  listen()
  return { keyboardUsed }
}
