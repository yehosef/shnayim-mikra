/**
 * tapGuard — tells a tap on a reading target from a drag or a text selection.
 *
 * Shared by VerseView (one box per reading) and AliyahReading (one span per
 * pasuk in flowing text): selecting text to copy or quote, or a drag that
 * scrolls, must never mark a reading.
 */

// A pointer that moved more than this between down and up is a drag
// (text selection / scroll), not a tap on a reading target.
export const DRAG_THRESHOLD_PX = 8

/** True when the pointer moved further than DRAG_THRESHOLD_PX between `start` and `end`. */
export function movedTooFar(start, end) {
  if (!start || !end || typeof end.clientX !== 'number') return false
  return Math.hypot(end.clientX - start.x, end.clientY - start.y) > DRAG_THRESHOLD_PX
}

/** True when a live (non-collapsed) selection is anchored inside `el`. */
export function hasSelectionInside(el) {
  if (!el || typeof window === 'undefined' || !window.getSelection) return false
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
  const anchor = sel.anchorNode
  if (!anchor) return false
  const node = anchor.nodeType === 1 ? anchor : anchor.parentNode
  return !!(node && el.contains(node))
}
