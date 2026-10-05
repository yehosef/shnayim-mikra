/**
 * Key routing and the "may the reader mark now" guard (src/lib/inputGuard.js).
 *
 * Pins the focus-view and one-pasuk input bugs found on 2026-10-04:
 *  - a fast second press (or a held Space) marked a piece that was never shown;
 *  - ArrowLeft / ArrowRight must mean next / previous in both views;
 *  - Space / Enter on a focused button in the list view marked a reading
 *    instead of pressing the button.
 */
import { describe, it, expect } from 'vitest'
import { mayAdvance, focusKeyAction, listKeyAction } from '../src/lib/inputGuard.js'

const key = (k, extra = {}) => ({ key: k, targetTag: 'BODY', ...extra })

describe('mayAdvance', () => {
  it('allows a mark when nothing is pending', () => {
    expect(mayAdvance({})).toBe(true)
    expect(mayAdvance({ overlayOpen: false, hasVerse: true, holding: false, moving: false })).toBe(true)
  })

  it('refuses during the green hold (the move is still pending)', () => {
    expect(mayAdvance({ holding: true })).toBe(false)
  })

  it('refuses while a card is leaving or entering — the next piece is not shown yet', () => {
    expect(mayAdvance({ moving: true })).toBe(false)
  })

  it('refuses with an overlay open or no real pasuk', () => {
    expect(mayAdvance({ overlayOpen: true })).toBe(false)
    expect(mayAdvance({ hasVerse: false })).toBe(false)
  })

  it('a burst of presses marks exactly one piece', () => {
    // Simulates the old bug: press, hold, move, press during the move.
    let holding = false
    let moving = false
    let marks = 0
    const press = () => {
      if (!mayAdvance({ holding, moving })) return
      marks++
      holding = true
    }
    press()            // marks, starts the hold
    press()            // during the hold: ignored
    holding = false    // hold ends, the move begins
    moving = true
    press()            // during leave / enter: ignored
    moving = false     // new card has finished entering
    expect(marks).toBe(1)
    press()
    expect(marks).toBe(2)
  })
})

describe('focusKeyAction', () => {
  it('Space and Enter advance and stop the page scrolling', () => {
    expect(focusKeyAction(key(' '))).toEqual({ action: 'advance', preventDefault: true })
    expect(focusKeyAction(key('Enter'))).toEqual({ action: 'advance', preventDefault: true })
  })

  it('a held Space / Enter (key-repeat) never advances, but still blocks scrolling', () => {
    expect(focusKeyAction(key(' ', { repeat: true }))).toEqual({ action: null, preventDefault: true })
    expect(focusKeyAction(key('Enter', { repeat: true }))).toEqual({ action: null, preventDefault: true })
  })

  it('ArrowLeft is next, ArrowRight is previous (right-to-left)', () => {
    expect(focusKeyAction(key('ArrowLeft')).action).toBe('next-verse')
    expect(focusKeyAction(key('ArrowRight')).action).toBe('previous-verse')
  })

  it('ArrowDown / ArrowUp step through pieces; 1/2/3 jump', () => {
    expect(focusKeyAction(key('ArrowDown')).action).toBe('step-down')
    expect(focusKeyAction(key('ArrowUp')).action).toBe('step-up')
    expect(focusKeyAction(key('1'))).toMatchObject({ action: 'jump', step: 1 })
    expect(focusKeyAction(key('2'))).toMatchObject({ action: 'jump', step: 2 })
    expect(focusKeyAction(key('3'))).toMatchObject({ action: 'jump', step: 3 })
  })

  it('M marks, U undoes, ? toggles help, Escape exits — none of them on key-repeat', () => {
    expect(focusKeyAction(key('m')).action).toBe('mark')
    expect(focusKeyAction(key('U')).action).toBe('undo')
    expect(focusKeyAction(key('?')).action).toBe('help')
    expect(focusKeyAction(key('Escape')).action).toBe('exit')
    expect(focusKeyAction(key('m', { repeat: true })).action).toBeNull()
    expect(focusKeyAction(key('u', { repeat: true })).action).toBeNull()
  })

  it('with an overlay open only Escape is handled (to close it)', () => {
    expect(focusKeyAction(key('Escape', { overlayOpen: true })).action).toBe('close-overlays')
    expect(focusKeyAction(key(' ', { overlayOpen: true })).action).toBeNull()
    expect(focusKeyAction(key('ArrowLeft', { overlayOpen: true })).action).toBeNull()
  })

  it('never handles typing or browser shortcuts', () => {
    expect(focusKeyAction(key(' ', { targetTag: 'INPUT' })).action).toBeNull()
    expect(focusKeyAction(key('ArrowLeft', { altKey: true })).action).toBeNull()
    expect(focusKeyAction(key('ArrowLeft', { metaKey: true })).action).toBeNull()
    expect(focusKeyAction(key(' ', { ctrlKey: true })).action).toBeNull()
    expect(focusKeyAction(key(' ', { shiftKey: true })).action).toBeNull()
  })
})

describe('listKeyAction', () => {
  it('ArrowLeft is next, ArrowRight is previous — the same rule as the focus view', () => {
    expect(listKeyAction(key('ArrowLeft')).action).toBe('next-verse')
    expect(listKeyAction(key('ArrowRight')).action).toBe('previous-verse')
    expect(focusKeyAction(key('ArrowLeft')).action).toBe(listKeyAction(key('ArrowLeft')).action)
    expect(focusKeyAction(key('ArrowRight')).action).toBe(listKeyAction(key('ArrowRight')).action)
  })

  it('Space marks, Enter opens the focus view', () => {
    expect(listKeyAction(key(' '))).toEqual({ action: 'mark', preventDefault: true })
    expect(listKeyAction(key('Enter'))).toEqual({ action: 'focus', preventDefault: true })
  })

  it('Space / Enter on a focused button or link belong to that control', () => {
    expect(listKeyAction(key(' ', { targetIsControl: true }))).toEqual({ action: null, preventDefault: false })
    expect(listKeyAction(key('Enter', { targetIsControl: true }))).toEqual({ action: null, preventDefault: false })
  })

  it('arrows keep working after clicking an on-screen arrow (focus on a button)', () => {
    expect(listKeyAction(key('ArrowLeft', { targetIsControl: true })).action).toBe('next-verse')
    expect(listKeyAction(key('ArrowDown', { targetIsControl: true })).action).toBe('phase-down')
  })

  it('a held Space never marks', () => {
    expect(listKeyAction(key(' ', { repeat: true }))).toEqual({ action: null, preventDefault: true })
  })

  it('never handles typing or browser shortcuts', () => {
    expect(listKeyAction(key(' ', { targetTag: 'SELECT' })).action).toBeNull()
    expect(listKeyAction(key('ArrowLeft', { altKey: true })).action).toBeNull()
    expect(listKeyAction(key(' ', { shiftKey: true })).action).toBeNull()
  })
})
