/**
 * The drag guard shared by VerseView and the one-reading view
 * (src/utils/tapGuard.js): a drag or a scroll must not mark a reading.
 */
import { describe, it, expect } from 'vitest'
import { DRAG_THRESHOLD_PX, movedTooFar, hasSelectionInside } from '../src/utils/tapGuard.js'

describe('movedTooFar', () => {
  it('a tap that barely moved is a tap', () => {
    expect(movedTooFar({ x: 10, y: 10 }, { clientX: 13, clientY: 14 })).toBe(false)
    expect(movedTooFar({ x: 0, y: 0 }, { clientX: DRAG_THRESHOLD_PX, clientY: 0 })).toBe(false)
  })

  it('a move past the threshold is a drag', () => {
    expect(movedTooFar({ x: 0, y: 0 }, { clientX: DRAG_THRESHOLD_PX + 1, clientY: 0 })).toBe(true)
    expect(movedTooFar({ x: 0, y: 0 }, { clientX: 0, clientY: 30 })).toBe(true)
  })

  it('no pointerdown or no coordinates (a keyboard click) is a tap', () => {
    expect(movedTooFar(null, { clientX: 100, clientY: 100 })).toBe(false)
    expect(movedTooFar({ x: 0, y: 0 }, {})).toBe(false)
  })
})

describe('hasSelectionInside', () => {
  it('is false without a DOM or an element', () => {
    expect(hasSelectionInside(null)).toBe(false)
  })
})
