/**
 * The shared motion vocabulary (src/lib/motion.js).
 *
 * Pins: backward, same-pasuk and new-pasuk moves are different events (they
 * all used to play the same slide); the jump back to the top of the aliyah in
 * aliyah-by-aliyah order moves backward; forward means "enter from the left".
 */
import { describe, it, expect } from 'vitest'
import {
  MARK_HOLD_MS,
  MOTION_GUARD_MAX_MS,
  TRANSITION_FORWARD,
  TRANSITION_BACK,
  TRANSITION_FADE,
  classifyMove,
  transitionNameFor,
  isSettled,
  holdBeforeMove
} from '../src/lib/motion.js'

describe('timing budget', () => {
  it('holds the green briefly — about half a second per piece in total', () => {
    expect(MARK_HOLD_MS).toBe(180)
    // hold + leave (120 ms) + enter (200 ms) stays near half a second
    expect(MARK_HOLD_MS + 120 + 200).toBeLessThanOrEqual(550)
  })

  it('the guard safety net outlasts a full leave + enter', () => {
    expect(MOTION_GUARD_MAX_MS).toBeGreaterThan(120 + 200)
  })
})

describe('classifyMove', () => {
  it('same pasuk, same piece: nothing moves', () => {
    expect(classifyMove({ from: { index: 4, step: 2 }, to: { index: 4, step: 2 } }))
      .toEqual({ kind: 'none', direction: null, emphasizeAliyah: false })
  })

  it('same pasuk, another piece: a step (crossfade, no direction)', () => {
    for (const [a, b] of [[1, 2], [2, 3], [3, 1]]) {
      const move = classifyMove({ from: { index: 4, step: a }, to: { index: 4, step: b }, advance: true })
      expect(move.kind).toBe('step')
      expect(move.direction).toBeNull()
    }
  })

  it('a later pasuk is a forward "next"', () => {
    const move = classifyMove({
      from: { index: 4, step: 3 }, to: { index: 5, step: 1 },
      fromAliyah: 'שני', toAliyah: 'שני', advance: true
    })
    expect(move).toEqual({ kind: 'next', direction: 'forward', emphasizeAliyah: false })
  })

  it('an earlier pasuk by navigation is a backward "previous"', () => {
    const move = classifyMove({ from: { index: 5, step: 1 }, to: { index: 4, step: 1 }, advance: false })
    expect(move).toEqual({ kind: 'previous', direction: 'back', emphasizeAliyah: false })
  })

  it('an advance that lands earlier in the same aliyah is the pass restart, moving backward', () => {
    // aliyah reading style: hebrew1 done for the whole block, back to its top
    const move = classifyMove({
      from: { index: 18, step: 1 }, to: { index: 12, step: 2 },
      fromAliyah: 'שלישי', toAliyah: 'שלישי', advance: true
    })
    expect(move).toEqual({ kind: 'restart', direction: 'back', emphasizeAliyah: false })
  })

  it('crossing into another aliyah emphasises the label, in either direction', () => {
    expect(classifyMove({
      from: { index: 9, step: 3 }, to: { index: 10, step: 1 },
      fromAliyah: 'ראשון', toAliyah: 'שני', advance: true
    })).toEqual({ kind: 'aliyah', direction: 'forward', emphasizeAliyah: true })
    expect(classifyMove({
      from: { index: 10, step: 1 }, to: { index: 9, step: 1 },
      fromAliyah: 'שני', toAliyah: 'ראשון'
    })).toEqual({ kind: 'aliyah', direction: 'back', emphasizeAliyah: true })
  })

  it('unknown aliyah labels never count as an aliyah change', () => {
    expect(classifyMove({ from: { index: 1 }, to: { index: 2 }, fromAliyah: null, toAliyah: 'שני' }).kind).toBe('next')
    expect(classifyMove({ from: { index: 1 }, to: { index: 2 } }).kind).toBe('next')
  })

  it('works on pesukim without a piece (list view uses an ordinal as index)', () => {
    expect(classifyMove({ from: { index: 3005 }, to: { index: 3006 } }).direction).toBe('forward')
    expect(classifyMove({ from: { index: 3006 }, to: { index: 2031 } }).direction).toBe('back')
  })

  it('missing positions mean no move', () => {
    expect(classifyMove({ from: null, to: { index: 1, step: 1 } }).kind).toBe('none')
  })
})

describe('transitionNameFor', () => {
  it('forward and back are mirror transitions; same-pasuk steps crossfade', () => {
    expect(transitionNameFor({ direction: 'forward' })).toBe(TRANSITION_FORWARD)
    expect(transitionNameFor({ direction: 'back' })).toBe(TRANSITION_BACK)
    expect(transitionNameFor({ direction: null })).toBe(TRANSITION_FADE)
    expect(transitionNameFor(null)).toBe(TRANSITION_FADE)
  })

  it('the restart jump uses the backward transition', () => {
    const move = classifyMove({
      from: { index: 18, step: 1 }, to: { index: 12, step: 2 },
      fromAliyah: 'שלישי', toAliyah: 'שלישי', advance: true
    })
    expect(transitionNameFor(move)).toBe(TRANSITION_BACK)
  })
})

describe('isSettled', () => {
  it('is settled only when the card on screen is the current position', () => {
    expect(isSettled({ index: 3, step: 2 }, { index: 3, step: 2 })).toBe(true)
    expect(isSettled({ index: 3, step: 2 }, { index: 3, step: 3 })).toBe(false)
    expect(isSettled({ index: 3, step: 3 }, { index: 4, step: 1 })).toBe(false)
    expect(isSettled(null, { index: 0, step: 1 })).toBe(false)
  })
})

describe('holdBeforeMove', () => {
  it('the focus view always holds the green before moving', () => {
    expect(holdBeforeMove({ view: 'focus', fromIndex: 2, toIndex: 2 })).toBe(true)
    expect(holdBeforeMove({ view: 'focus', fromIndex: 2, toIndex: 3 })).toBe(true)
  })

  it('the list view holds only in one-pasuk mode when the pasuk changes', () => {
    expect(holdBeforeMove({ view: 'list', pasukMode: true, fromIndex: 2, toIndex: 3 })).toBe(true)
    expect(holdBeforeMove({ view: 'list', pasukMode: true, fromIndex: 2, toIndex: 2 })).toBe(false)
    expect(holdBeforeMove({ view: 'list', pasukMode: false, fromIndex: 2, toIndex: 3 })).toBe(false)
  })
})
