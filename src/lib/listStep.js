/**
 * listStep — pure decisions for list view's keyboard Space/Enter advance and
 * the pointer re-seed (src/components/ParshaDisplay.vue).
 *
 * No Vue, no storage: the current selection, the reading pointer and whether
 * it falls in the same aliyah are all passed in, so the traversal rules can
 * be tested in the node test env (tests/list-step.test.js).
 *
 * Reuses focusStep's `followsPointer` so the forward-gate / aliyah
 * backward-follow rule (see the comment there) is defined in exactly one
 * place and stays identical between focus mode and list view.
 */
import { followsPointer } from './focusStep.js'

/**
 * Whether the keyboard Space/Enter mark action should write progress.
 *
 * A phase that is already read must NEVER be written to `false` by the
 * keyboard path — only VerseView's text click (its own toggle, handled by
 * ParshaDisplay.handlePhaseClick) may un-mark. Space still always advances
 * the selection; the caller does that regardless of this result.
 */
export function keyboardMarkAction({ wasRead }) {
  return !wasRead
}

/**
 * Seed/park the selection with no directional gate — always land on the
 * pointer when there is one, regardless of where the current selection is.
 * Used both as the last-resort fallback of `nextListSelection` (below) and
 * directly by the component's own re-seed (mode switch, aliyah change, data
 * load, external progress write).
 *
 * With no pointer, parks at the end of what is on screen with no phase
 * selected (phase 0) when the scope is complete — there is nothing left to
 * mark, and seeding phase 1 there would let the next Space silently un-mark
 * the first reading of the first verse. Falls back to the top of the list
 * only when nothing is derived yet.
 */
export function seedListSelection({ pointerIndex, pointerPhase, scopeComplete, maxIndex }) {
  if (Number.isInteger(pointerIndex) && pointerIndex >= 0) {
    return { index: pointerIndex, phase: pointerPhase }
  }
  if (scopeComplete && maxIndex >= 0) {
    return { index: maxIndex, phase: 0 }
  }
  return { index: 0, phase: 1 }
}

/**
 * Where Space / a completed mark moves the list-view selection.
 *
 * Mirrors focusStep.nextFocusPosition but for the flat list:
 *  1. follow the pointer if it's ahead of the selection, or — in 'aliyah'
 *     style only — behind it but inside the same aliyah block (see
 *     followsPointer);
 *  2. otherwise step by hand: next phase, or next verse's phase 1;
 *  3. otherwise (nothing moved — the last phase of the last verse in scope)
 *     fall back to `seedListSelection`, exactly as re-seeding from scratch
 *     would: jump to a pointer left behind (a verse skipped earlier), or park
 *     at phase 0 on the last verse when the scope is complete. This is what
 *     turns "Space does nothing at the end of a scope" (and the toggle loop
 *     that followed) into "Space always either advances or parks".
 */
export function nextListSelection({
  selectedIndex,
  selectedPhase,
  pointerIndex,
  pointerPhase,
  sameAliyah,
  readingStyle,
  maxIndex,
  scopeComplete
}) {
  if (followsPointer({ readingStyle, pointerIndex, currentIndex: selectedIndex, sameAliyah })) {
    return { index: pointerIndex, phase: pointerPhase }
  }

  // Parked (phase 0, nothing left to mark): there is no "next phase" to step
  // to. Re-seed instead of treating 0 as a phase number, or the cursor would
  // walk 0 -> 1 -> 2 -> 3 across a verse that is already read.
  if (selectedPhase < 1) return seedListSelection({ pointerIndex, pointerPhase, scopeComplete, maxIndex })

  if (selectedPhase < 3) return { index: selectedIndex, phase: selectedPhase + 1 }
  if (selectedIndex < maxIndex) return { index: selectedIndex + 1, phase: 1 }

  return seedListSelection({ pointerIndex, pointerPhase, scopeComplete, maxIndex })
}
