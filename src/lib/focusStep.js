/**
 * focusStep — pure decisions for focus mode's Space/tap advance.
 *
 * No Vue, no storage: the current position, the reading pointer and the aliyah
 * block the pointer falls in are all passed in, so the traversal rules can be
 * tested in the node test env (tests/focus-step.test.js).
 *
 * The pointer is the next unread step in the active reading style
 * (progressMath.nextUnread, narrowed by the parent). It is NOT monotonic:
 *
 * - in 'aliyah' style it walks the whole block for hebrew1, then again for
 *   hebrew2, then again for targum, so it legitimately jumps BACK to the top of
 *   the block at every pass boundary;
 * - it can also sit behind the reader because the reader jumped ahead (the 🔍
 *   button on a later verse) or skipped a verse with the arrows. Following it
 *   there would teleport them away from the verse they chose — in 'aliyah'
 *   style, possibly to the start of a much earlier aliyah.
 *
 * Hence: a backward pointer is followed only inside the SAME aliyah block, and
 * only in 'aliyah' style (this mirrors ParshaDisplay.advanceSelection).
 */

/** True when Space should jump to the pointer instead of stepping by hand. */
export function followsPointer({ readingStyle, pointerIndex, currentIndex, sameAliyah }) {
  if (!Number.isInteger(pointerIndex) || pointerIndex < 0) return false
  if (pointerIndex >= currentIndex) return true
  return readingStyle === 'aliyah' && sameAliyah === true
}

/**
 * Where Space / a tap lands once the current phase has been marked read.
 *
 * `pointer` is `{ index, step }` inside the displayed verses, or null.
 * Returns `{ index, step }`, or null when there is nothing left to read and
 * focus mode should be left.
 */
export function nextFocusPosition({
  step,
  currentIndex,
  lastIndex,
  pointer,
  readingStyle,
  sameAliyah
}) {
  if (
    pointer &&
    followsPointer({ readingStyle, pointerIndex: pointer.index, currentIndex, sameAliyah })
  ) {
    return { index: pointer.index, step: pointer.step }
  }

  if (step < 3) return { index: currentIndex, step: step + 1 }
  if (currentIndex < lastIndex) return { index: currentIndex + 1, step: 1 }

  // Last verse, and the pointer is behind us (a skipped verse, or a verse we
  // jumped past). It is still the next thing to read, so go there: Space must
  // always either advance or leave — never sit and do nothing.
  if (pointer) return { index: pointer.index, step: pointer.step }
  return null
}
