import { describe, it, expect } from 'vitest'
import { toHebrew, removeTrop, formatHebrewText } from '../src/utils/hebrewUtils'

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

describe('removeTrop', () => {
  // Bereshit 1:1 with trop, meteg and the sof pasuk.
  const withTrop = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃'

  it('removes the accents (U+0591-05AF), meteg (U+05BD) and rafe (U+05BF)', () => {
    const out = removeTrop('א֑ב֯גֽדֿה')
    expect(out).toBe('אבגדה')
    expect(removeTrop(withTrop)).not.toMatch(/[֑-ֽֿ֯]/)
  })

  it('keeps the sof pasuk (׃, U+05C3) and the paseq (׀, U+05C0)', () => {
    expect(removeTrop(withTrop).endsWith('׃')).toBe(true)
    expect(removeTrop('א֑ ׀ ב׃')).toBe('א ׀ ב׃')
  })

  it('keeps the vowels and the maqaf', () => {
    expect(removeTrop('וַיְהִי־עֶ֖רֶב')).toBe('וַיְהִי־עֶרֶב')
  })

  it('formatHebrewText leaves the text untouched when trop is on', () => {
    expect(formatHebrewText(withTrop, true)).toBe(withTrop)
    expect(formatHebrewText(withTrop, false)).toBe(removeTrop(withTrop))
  })
})
