/**
 * motion — the one motion vocabulary shared by the focus view (FocusMode.vue)
 * and the list view's one-pasuk mode (ParshaDisplay.vue).
 *
 * Pure: no Vue, no DOM. The CSS half of the vocabulary (durations, easings,
 * distance, the `motion-*` transition classes and the reduced-motion override)
 * lives in src/style.css; the only duration JavaScript needs is the hold below.
 *
 * Tested in tests/motion.test.js.
 */

/**
 * How long a just-marked piece stays on screen, green, before the view moves
 * on. The green itself appears within --motion-colour (100 ms); this is the
 * hold after that. Kept under prefers-reduced-motion: it is a colour cue, not
 * movement.
 */
export const MARK_HOLD_MS = 180

/**
 * Safety net for the "a move is still on screen" guard. The guard is normally
 * released by the Transition's after-enter hook; if that never fires (a tab
 * hidden mid-animation, an element removed early) input must not stay blocked.
 * Comfortably longer than leave + enter (120 + 200 ms).
 */
export const MOTION_GUARD_MAX_MS = 700

/** Transition names, defined once in src/style.css. */
export const TRANSITION_FORWARD = 'motion-forward'
export const TRANSITION_BACK = 'motion-back'
export const TRANSITION_FADE = 'motion-fade'

/**
 * What kind of move takes the reader from `from` to `to`.
 *
 * `from` / `to` are `{ index, step }`. `index` is anything that orders pesukim
 * (an index into the displayed list, or an absolute ordinal); `step` is the
 * piece (1, 2, 3) and may be omitted when only the pasuk matters.
 * `fromAliyah` / `toAliyah` are the aliyah labels of the two pesukim (null when
 * unknown — two unknown labels never count as an aliyah change).
 * `advance` is true when the move comes from marking (Space / tap), false for
 * arrows, 1/2/3 and the other navigation.
 *
 * Returns `{ kind, direction, emphasizeAliyah }`:
 *  - kind 'none'      — same pasuk, same piece; nothing moves.
 *  - kind 'step'      — same pasuk, another piece: the card stays, its label and
 *                       text crossfade (direction null).
 *  - kind 'next'      — a later pasuk in the same aliyah (direction 'forward').
 *  - kind 'previous'  — an earlier pasuk by navigation (direction 'back').
 *  - kind 'restart'   — an advance that lands on an EARLIER pasuk of the same
 *                       aliyah: in aliyah-by-aliyah reading order the jump back
 *                       to the top of the aliyah for the next pass. Backward
 *                       motion, so it does not look like a step forward.
 *  - kind 'aliyah'    — a different aliyah; direction by order, plus a brief
 *                       colour emphasis on the aliyah label.
 */
export function classifyMove({ from, to, fromAliyah = null, toAliyah = null, advance = false }) {
  if (!from || !to) return { kind: 'none', direction: null, emphasizeAliyah: false }

  if (from.index === to.index) {
    const kind = from.step === to.step ? 'none' : 'step'
    return { kind, direction: null, emphasizeAliyah: false }
  }

  const direction = to.index > from.index ? 'forward' : 'back'
  const aliyahChanged = !!fromAliyah && !!toAliyah && fromAliyah !== toAliyah
  if (aliyahChanged) return { kind: 'aliyah', direction, emphasizeAliyah: true }
  if (direction === 'forward') return { kind: 'next', direction, emphasizeAliyah: false }
  return { kind: advance ? 'restart' : 'previous', direction, emphasizeAliyah: false }
}

/**
 * The Transition name for a move between pesukim. Same-pasuk moves crossfade.
 * New pasuk forward: the old card leaves toward the right and the new one
 * enters from the left (Hebrew reading order: what comes next is on the left).
 * Backward is the mirror image.
 */
export function transitionNameFor(move) {
  if (move?.direction === 'forward') return TRANSITION_FORWARD
  if (move?.direction === 'back') return TRANSITION_BACK
  return TRANSITION_FADE
}

/**
 * True once what is on screen is the position the reader is at. `shown` is
 * updated when a card starts entering; `target` is the logical position. While
 * they differ, a card is still leaving or entering and a press must not mark
 * anything (it would mark a piece the reader has not seen).
 */
export function isSettled(shown, target) {
  if (!shown || !target) return false
  return shown.index === target.index && shown.step === target.step
}

/**
 * Whether a mark that moves the view from `fromIndex` to `toIndex` waits for
 * the hold first. The focus view always holds (its card is replaced). The list
 * view holds only in one-pasuk mode and only when the pasuk changes: there all
 * three pieces are visible, so a same-pasuk step just moves the selection, and
 * in the full list nothing is replaced.
 */
export function holdBeforeMove({ view, pasukMode = false, fromIndex, toIndex }) {
  if (view === 'focus') return true
  return !!pasukMode && fromIndex !== toIndex
}
