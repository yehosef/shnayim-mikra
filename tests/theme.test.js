import { describe, it, expect } from 'vitest'
import { resolveTheme } from '../src/composables/useTheme'
import { makeDefaults } from '../src/lib/settingsDefaults'

describe('theme setting', () => {
  it('defaults to auto', () => {
    expect(makeDefaults('en').theme).toBe('auto')
  })
  it('auto follows the system', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme(undefined, true)).toBe('dark')
  })
  it('an explicit choice wins over the system', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
