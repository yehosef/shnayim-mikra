/**
 * List-view traversal rules (src/lib/listStep.js).
 *
 * Pins the fix for a Space toggle loop: after Space marked the last phase of
 * the last verse in scope, advanceSelection() found nothing to move to and
 * sat still; the next Space then un-marked the reading just finished.
 */
import { describe, it, expect } from 'vitest'
import { nextListSelection, seedListSelection, keyboardMarkAction } from '../src/lib/listStep.js'

describe('keyboardMarkAction', () => {
  it('writes only when the phase is unread', () => {
    expect(keyboardMarkAction({ wasRead: false })).toBe(true)
    expect(keyboardMarkAction({ wasRead: true })).toBe(false)
  })
})

describe('nextListSelection — end of scope, scope complete', () => {
  it('parks at phase 0 on the last verse instead of sitting still', () => {
    const next = nextListSelection({
      selectedIndex: 5,
      selectedPhase: 3,
      pointerIndex: null,
      pointerPhase: null,
      sameAliyah: false,
      readingStyle: 'verse',
      maxIndex: 5,
      scopeComplete: true
    })
    expect(next).toEqual({ index: 5, phase: 0 })
  })

  it('stays parked at phase 0 on repeated advances', () => {
    const parked = { index: 5, phase: 0 }
    const next = nextListSelection({
      selectedIndex: 5, selectedPhase: 0,
      pointerIndex: null, pointerPhase: null,
      sameAliyah: false, readingStyle: 'verse',
      maxIndex: 5, scopeComplete: true
    })
    expect(next).toEqual(parked)
  })

  it('from parked, a pointer that appeared behind the cursor is reached', () => {
    // Another tab un-marked verse 2 while this one sat parked at the end.
    const next = nextListSelection({
      selectedIndex: 5, selectedPhase: 0,
      pointerIndex: 2, pointerPhase: 3,
      sameAliyah: false, readingStyle: 'verse',
      maxIndex: 5, scopeComplete: false
    })
    expect(next).toEqual({ index: 2, phase: 3 })
  })

  it('the keyboard action on a read phase never writes', () => {
    // The phase Space just parked on (or landed on via an arrow key) is read
    expect(keyboardMarkAction({ wasRead: true })).toBe(false)
  })
})

describe('nextListSelection — a skipped verse behind the cursor', () => {
  it('jumps to the pointer when the cursor is at the end (verse style)', () => {
    const next = nextListSelection({
      selectedIndex: 20,
      selectedPhase: 3,
      pointerIndex: 5,
      pointerPhase: 1,
      sameAliyah: false,
      readingStyle: 'verse',
      maxIndex: 20,
      scopeComplete: false
    })
    expect(next).toEqual({ index: 5, phase: 1 })
  })
})

describe('nextListSelection — aliyah style backward follow', () => {
  it('follows a backward pointer inside the same aliyah', () => {
    const next = nextListSelection({
      selectedIndex: 18,
      selectedPhase: 3,
      pointerIndex: 12,
      pointerPhase: 2,
      sameAliyah: true,
      readingStyle: 'aliyah',
      maxIndex: 20,
      scopeComplete: false
    })
    expect(next).toEqual({ index: 12, phase: 2 })
  })

  it('does NOT follow a backward pointer in verse style, even with sameAliyah', () => {
    const next = nextListSelection({
      selectedIndex: 18,
      selectedPhase: 2,
      pointerIndex: 12,
      pointerPhase: 2,
      sameAliyah: true,
      readingStyle: 'verse',
      maxIndex: 20,
      scopeComplete: false
    })
    // Falls through to the manual step instead
    expect(next).toEqual({ index: 18, phase: 3 })
  })
})

describe('nextListSelection — normal forward step, no pointer', () => {
  const base = { pointerIndex: null, pointerPhase: null, sameAliyah: false, readingStyle: 'verse', maxIndex: 10, scopeComplete: false }

  it('walks phase 1 -> 2 -> 3', () => {
    expect(nextListSelection({ ...base, selectedIndex: 3, selectedPhase: 1 })).toEqual({ index: 3, phase: 2 })
    expect(nextListSelection({ ...base, selectedIndex: 3, selectedPhase: 2 })).toEqual({ index: 3, phase: 3 })
  })

  it('moves to the next verse phase 1 at phase 3', () => {
    expect(nextListSelection({ ...base, selectedIndex: 3, selectedPhase: 3 })).toEqual({ index: 4, phase: 1 })
  })
})

describe('nextListSelection — arrow onto a read phase, then Space', () => {
  it('does not write, and the selection advances', () => {
    const wasRead = true
    expect(keyboardMarkAction({ wasRead })).toBe(false)

    // The reader arrowed up onto an already-read phase mid-list; Space must
    // still move on.
    const next = nextListSelection({
      selectedIndex: 7,
      selectedPhase: 2,
      pointerIndex: null,
      pointerPhase: null,
      sameAliyah: false,
      readingStyle: 'verse',
      maxIndex: 20,
      scopeComplete: false
    })
    expect(next).toEqual({ index: 7, phase: 3 })
  })
})

describe('seedListSelection', () => {
  it('lands on the pointer when there is one', () => {
    expect(seedListSelection({ pointerIndex: 4, pointerPhase: 2, scopeComplete: false, maxIndex: 10 }))
      .toEqual({ index: 4, phase: 2 })
  })

  it('parks at phase 0 on the last verse when the scope is complete and there is no pointer', () => {
    expect(seedListSelection({ pointerIndex: null, pointerPhase: null, scopeComplete: true, maxIndex: 10 }))
      .toEqual({ index: 10, phase: 0 })
  })

  it('falls back to the top of the list when nothing is derived yet', () => {
    expect(seedListSelection({ pointerIndex: null, pointerPhase: null, scopeComplete: false, maxIndex: -1 }))
      .toEqual({ index: 0, phase: 1 })
  })
})
