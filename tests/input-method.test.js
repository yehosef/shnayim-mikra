import { describe, it, expect } from 'vitest'
import { nextInputMethod } from '../src/composables/useInputMethod'

describe('nextInputMethod (purple selection only after a key press)', () => {
  it.each([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '1', '2', '3', 'm', 'M', 'u', 'U'])(
    'a %j keydown turns keyboard mode on', (key) => {
      expect(nextInputMethod(false, 'keydown', key)).toBe(true)
      expect(nextInputMethod(true, 'keydown', key)).toBe(true)
    })

  it.each(['a', 'Tab', 'Shift', 'Escape', '4', '?'])('a %j keydown leaves it as it was', (key) => {
    expect(nextInputMethod(false, 'keydown', key)).toBe(false)
    expect(nextInputMethod(true, 'keydown', key)).toBe(true)
  })

  it('a touch turns it off', () => {
    expect(nextInputMethod(true, 'touchstart')).toBe(false)
    expect(nextInputMethod(false, 'touchstart')).toBe(false)
  })

  it('other events change nothing', () => {
    expect(nextInputMethod(true, 'pointerdown')).toBe(true)
    expect(nextInputMethod(false, 'click')).toBe(false)
  })
})
