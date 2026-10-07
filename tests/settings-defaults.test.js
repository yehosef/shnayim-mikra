/**
 * Defaults for localStorage['shnayim-settings']: the interface language follows
 * a Hebrew browser on first visit, and the one-time welcome card stays hidden
 * for readers whose settings predate it and who already answered the schedule
 * question.
 */
import { describe, it, expect } from 'vitest'
import { browserLanguage, makeDefaults, parseSettings } from '../src/lib/settingsDefaults.js'

describe('browserLanguage', () => {
  it('is Hebrew for he, he-IL and the legacy iw code', () => {
    expect(browserLanguage({ language: 'he-IL' })).toBe('he')
    expect(browserLanguage({ language: 'he' })).toBe('he')
    expect(browserLanguage({ language: 'iw' })).toBe('he')
  })

  it('is English for anything else, and with no navigator (node)', () => {
    expect(browserLanguage({ language: 'en-US' })).toBe('en')
    expect(browserLanguage({ language: 'fr' })).toBe('en')
    expect(browserLanguage({})).toBe('en')
    expect(browserLanguage(null)).toBe('en')
  })
})

describe('first-visit defaults', () => {
  it('uses Hebrew for the interface when the browser is he-IL', () => {
    expect(parseSettings(null, browserLanguage({ language: 'he-IL' })).interfaceLanguage).toBe('he')
  })

  it('uses English for an English browser', () => {
    expect(parseSettings(null, browserLanguage({ language: 'en-GB' })).interfaceLanguage).toBe('en')
  })

  it('shows the welcome card and asks the schedule question', () => {
    const s = makeDefaults('en')
    expect(s.welcomeDismissed).toBe(false)
    expect(s.locationChosen).toBe(false)
  })
})

describe('saved settings', () => {
  it('keep a saved interface language regardless of the browser', () => {
    expect(parseSettings(JSON.stringify({ interfaceLanguage: 'en' }), 'he').interfaceLanguage).toBe('en')
    expect(parseSettings(JSON.stringify({ interfaceLanguage: 'he' }), 'en').interfaceLanguage).toBe('he')
  })

  it('from before the welcome card: hidden when the schedule was already chosen', () => {
    const s = parseSettings(JSON.stringify({ interfaceLanguage: 'en', locationChosen: true }), 'en')
    expect(s.welcomeDismissed).toBe(true)
  })

  it('from before the welcome card: shown when the schedule was never chosen', () => {
    expect(parseSettings(JSON.stringify({ interfaceLanguage: 'en' }), 'en').welcomeDismissed).toBe(false)
    expect(parseSettings(JSON.stringify({ locationChosen: false }), 'en').welcomeDismissed).toBe(false)
  })

  it('keep an explicit welcomeDismissed value', () => {
    expect(parseSettings(JSON.stringify({ locationChosen: true, welcomeDismissed: false }), 'en').welcomeDismissed).toBe(false)
    expect(parseSettings(JSON.stringify({ locationChosen: false, welcomeDismissed: true }), 'en').welcomeDismissed).toBe(true)
  })

  it('fall back to defaults when unreadable', () => {
    expect(parseSettings('not json', 'he').interfaceLanguage).toBe('he')
    expect(parseSettings('[1]', 'en')).toEqual(makeDefaults('en'))
  })
})
