import { describe, it, expect } from 'vitest'
import { toHebrew } from '../src/utils/hebrewUtils'

describe('toHebrew', () => {
  it.each([
    [1, 'א'],
    [9, 'ט'],
    [10, 'י'],
    [11, 'יא'],
    [15, 'טו'],
    [16, 'טז'],
    [17, 'יז'],
    [20, 'כ'],
    [99, 'צט'],
    [100, 'ק'],
    [115, 'קטו'],
    [116, 'קטז'],
    [150, 'קנ'],
  ])('toHebrew(%i) === %s', (num, expected) => {
    expect(toHebrew(num)).toBe(expected)
  })
})
