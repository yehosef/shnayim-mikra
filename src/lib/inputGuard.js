/**
 * inputGuard — pure decisions for "where does this press go" and "may the
 * reader advance now", for both the focus view (FocusMode.vue) and the list
 * view (ParshaDisplay.vue).
 *
 * No Vue, no DOM: the components pass plain fields from the KeyboardEvent and
 * their own state, and act on the returned action. Tested in
 * tests/input-guard.test.js.
 *
 * Arrow rule, the same in both views and on the on-screen buttons: the next
 * pasuk is on the LEFT (ArrowLeft), the previous one on the RIGHT (ArrowRight),
 * following the Hebrew reading direction.
 */

const TYPING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

/**
 * Whether a Space / tap / M may mark the piece on screen now.
 *
 * - `overlayOpen`: help or settings is open over the card.
 * - `hasVerse`: the current position points at a real pasuk.
 * - `holding`: the just-marked piece is in its green hold; the move is pending.
 * - `moving`: a card is still leaving or entering. Marking now would mark the
 *   piece that has not been shown yet.
 */
export function mayAdvance({ overlayOpen = false, hasVerse = true, holding = false, moving = false } = {}) {
  return !overlayOpen && !!hasVerse && !holding && !moving
}

/** Fields both handlers need from a KeyboardEvent. */
function commonSkip({ targetTag, ctrlKey, metaKey, altKey, shiftKey, key }) {
  if (TYPING_TAGS.has(targetTag)) return true
  // Never swallow browser/OS shortcuts (Alt/Cmd+Arrow = Back, Ctrl+Space, ...)
  if (ctrlKey || metaKey || altKey) return true
  if (shiftKey && key === ' ') return true
  return false
}

const NONE = Object.freeze({ action: null, preventDefault: false })
// A held key: keep the page from scrolling, but do nothing.
const SWALLOW = Object.freeze({ action: null, preventDefault: true })

/**
 * Focus view key handling. Returns `{ action, preventDefault, step? }`, where
 * action is one of: 'close-overlays', 'exit', 'advance', 'next-verse',
 * 'previous-verse', 'step-down', 'step-up', 'jump' (with step 1/2/3), 'mark',
 * 'undo', 'help', or null.
 *
 * Key-repeat (a held key) never marks or undoes: holding Space used to mark one
 * unseen piece after another.
 */
export function focusKeyAction(e) {
  if (commonSkip(e)) return NONE
  const { key, repeat = false, overlayOpen = false } = e

  // With help or settings open, only Escape (to close them) is handled.
  if (overlayOpen) return key === 'Escape' ? { action: 'close-overlays', preventDefault: false } : NONE

  switch (key) {
    case 'Escape':
      return { action: 'exit', preventDefault: false }
    case ' ':
    case 'Enter':
      return repeat ? SWALLOW : { action: 'advance', preventDefault: true }
    case 'ArrowLeft':
      return { action: 'next-verse', preventDefault: true }
    case 'ArrowRight':
      return { action: 'previous-verse', preventDefault: true }
    case 'ArrowDown':
      return { action: 'step-down', preventDefault: true }
    case 'ArrowUp':
      return { action: 'step-up', preventDefault: true }
    case '1':
    case '2':
    case '3':
      return { action: 'jump', step: Number(key), preventDefault: false }
    case 'm':
    case 'M':
      return repeat ? NONE : { action: 'mark', preventDefault: false }
    case 'u':
    case 'U':
      return repeat ? NONE : { action: 'undo', preventDefault: false }
    case '?':
      return repeat ? NONE : { action: 'help', preventDefault: false }
    default:
      return NONE
  }
}

/**
 * List view key handling. Returns `{ action, preventDefault }`, where action is
 * one of: 'phase-down', 'phase-up', 'next-verse', 'previous-verse', 'mark',
 * 'focus', or null.
 *
 * `targetIsControl` is true when the key went to a button or link (the reader
 * just clicked an arrow, the mode toggle, the other-week link...). Space and
 * Enter then belong to that control, not to the reading: the browser presses
 * the button / follows the link. Arrows keep navigating, so the keyboard does
 * not go dead after clicking an on-screen arrow.
 */
export function listKeyAction(e) {
  if (commonSkip(e)) return NONE
  const { key, repeat = false, targetIsControl = false } = e

  switch (key) {
    case 'ArrowDown':
      return { action: 'phase-down', preventDefault: true }
    case 'ArrowUp':
      return { action: 'phase-up', preventDefault: true }
    case 'ArrowLeft':
      return { action: 'next-verse', preventDefault: true }
    case 'ArrowRight':
      return { action: 'previous-verse', preventDefault: true }
    case ' ':
      if (targetIsControl) return NONE
      return repeat ? SWALLOW : { action: 'mark', preventDefault: true }
    case 'Enter':
      if (targetIsControl) return NONE
      return repeat ? SWALLOW : { action: 'focus', preventDefault: true }
    default:
      return NONE
  }
}
