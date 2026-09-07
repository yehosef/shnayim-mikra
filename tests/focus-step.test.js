/**
 * Focus-mode traversal rules (src/lib/focusStep.js).
 *
 * Two regressions are pinned here:
 *  1. 'aliyah' style must not follow the pointer backwards ACROSS aliyot — a
 *     reader who jumps ahead with the 🔍 button was teleported to verse 0.
 *  2. On the last verse, a pointer left behind must be gone to, not ignored —
 *     Space had become a dead key that neither advanced nor exited.
 */
import { describe, it, expect } from 'vitest'
import { followsPointer, nextFocusPosition } from '../src/lib/focusStep.js'

describe('followsPointer', () => {
  it('follows a pointer that is ahead of, or on, the current verse', () => {
    for (const readingStyle of ['verse', 'aliyah']) {
      expect(followsPointer({ readingStyle, pointerIndex: 9, currentIndex: 3, sameAliyah: false })).toBe(true)
      expect(followsPointer({ readingStyle, pointerIndex: 3, currentIndex: 3, sameAliyah: false })).toBe(true)
    }
  })

  it('refuses a backward pointer in verse style', () => {
    expect(followsPointer({ readingStyle: 'verse', pointerIndex: 5, currentIndex: 40, sameAliyah: false })).toBe(false)
    // sameAliyah is irrelevant in verse style
    expect(followsPointer({ readingStyle: 'verse', pointerIndex: 5, currentIndex: 40, sameAliyah: true })).toBe(false)
  })

  it('follows a backward pointer in aliyah style only inside the same aliyah', () => {
    // pass boundary: hebrew1 done for the block, pointer back to its top
    expect(followsPointer({ readingStyle: 'aliyah', pointerIndex: 12, currentIndex: 18, sameAliyah: true })).toBe(true)
    // the reader jumped ahead to a later aliyah: the whole-parsha pointer still
    // sits in aliyah 1 and must NOT drag them back
    expect(followsPointer({ readingStyle: 'aliyah', pointerIndex: 0, currentIndex: 40, sameAliyah: false })).toBe(false)
  })

  it('treats a missing/unknown pointer index as no pointer', () => {
    expect(followsPointer({ readingStyle: 'aliyah', pointerIndex: -1, currentIndex: 0, sameAliyah: true })).toBe(false)
    expect(followsPointer({ readingStyle: 'verse', pointerIndex: null, currentIndex: 0, sameAliyah: true })).toBe(false)
  })
})

describe('nextFocusPosition — stepping without a usable pointer', () => {
  const base = { currentIndex: 4, lastIndex: 20, pointer: null, readingStyle: 'verse', sameAliyah: false }

  it('walks the three phases of the same verse', () => {
    expect(nextFocusPosition({ ...base, step: 1 })).toEqual({ index: 4, step: 2 })
    expect(nextFocusPosition({ ...base, step: 2 })).toEqual({ index: 4, step: 3 })
  })

  it('moves to the next verse at step 3', () => {
    expect(nextFocusPosition({ ...base, step: 3 })).toEqual({ index: 5, step: 1 })
  })

  it('exits at the end of the list when nothing is left', () => {
    expect(nextFocusPosition({ ...base, step: 3, currentIndex: 20 })).toBeNull()
  })
})

describe('nextFocusPosition — jumping ahead in aliyah style', () => {
  // readingStyle 'aliyah', displayMode 'pasuk': the pointer handed down is the
  // whole-parsha pointer, sitting at the first unread step of aliyah 1, while
  // the reader entered focus mode on a verse in aliyah 4.
  const jumpedAhead = {
    currentIndex: 40,
    lastIndex: 60,
    pointer: { index: 0, step: 1 },
    readingStyle: 'aliyah',
    sameAliyah: false
  }

  it('does not teleport the reader to the start of the parsha', () => {
    expect(nextFocusPosition({ ...jumpedAhead, step: 1 })).toEqual({ index: 40, step: 2 })
    expect(nextFocusPosition({ ...jumpedAhead, step: 2 })).toEqual({ index: 40, step: 3 })
    expect(nextFocusPosition({ ...jumpedAhead, step: 3 })).toEqual({ index: 41, step: 1 })
  })

  it('still follows the pass boundary inside the aliyah the reader is in', () => {
    expect(
      nextFocusPosition({ ...jumpedAhead, step: 3, pointer: { index: 36, step: 2 }, sameAliyah: true })
    ).toEqual({ index: 36, step: 2 })
  })
})

describe('nextFocusPosition — last verse with the pointer behind', () => {
  // verse style, the reader skipped verse 5 with the arrows and read to the end
  const stranded = {
    step: 3,
    currentIndex: 20,
    lastIndex: 20,
    pointer: { index: 5, step: 1 },
    readingStyle: 'verse',
    sameAliyah: false
  }

  it('goes to the skipped verse instead of doing nothing', () => {
    expect(nextFocusPosition(stranded)).toEqual({ index: 5, step: 1 })
  })

  it('never returns the current position, so Space always does something', () => {
    for (const readingStyle of ['verse', 'aliyah']) {
      for (const step of [1, 2, 3]) {
        const next = nextFocusPosition({ ...stranded, step, readingStyle })
        expect(next === null || next.index !== 20 || next.step !== step).toBe(true)
      }
    }
  })
})

describe('a whole reading terminates', () => {
  // 6 verses, one aliyah block; the reader starts at verse 3 (jumped ahead).
  // Space repeatedly must eventually read all 18 phases and then exit.
  const PHASES = ['hebrew1', 'hebrew2', 'targum']
  const TOTAL = 6

  const run = (readingStyle) => {
    const progress = Array.from({ length: TOTAL }, () => ({ hebrew1: false, hebrew2: false, targum: false }))
    // pointer = next unread in the active style, over the whole block
    const pointer = () => {
      if (readingStyle === 'aliyah') {
        for (let p = 0; p < PHASES.length; p++) {
          for (let i = 0; i < TOTAL; i++) if (!progress[i][PHASES[p]]) return { index: i, step: p + 1 }
        }
      } else {
        for (let i = 0; i < TOTAL; i++) {
          for (let p = 0; p < PHASES.length; p++) if (!progress[i][PHASES[p]]) return { index: i, step: p + 1 }
        }
      }
      return null
    }

    let index = 3
    let step = 1
    let exited = false
    for (let guard = 0; guard < 200 && !exited; guard++) {
      progress[index][PHASES[step - 1]] = true
      const next = nextFocusPosition({
        step,
        currentIndex: index,
        lastIndex: TOTAL - 1,
        pointer: pointer(),
        readingStyle,
        sameAliyah: true // single aliyah block
      })
      if (!next) {
        exited = true
        break
      }
      index = next.index
      step = next.step
    }
    return { exited, progress }
  }

  it.each(['verse', 'aliyah'])('%s style: reads everything and then exits', (style) => {
    const { exited, progress } = run(style)
    expect(exited).toBe(true)
    expect(progress.every((r) => PHASES.every((p) => r[p]))).toBe(true)
  })
})
