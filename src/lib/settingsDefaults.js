/**
 * Defaults and parsing for localStorage['shnayim-settings']. Pure: no Vue, no
 * storage; the browser language is passed in (or read from navigator when
 * there is one) so tests can pin it.
 *
 * index.html repeats the interface-language rule in its pre-mount script so
 * the page direction does not flash; keep the two in step.
 */

/** 'he' when the browser language is Hebrew ("he", "he-IL", legacy "iw"), else 'en'. */
export function browserLanguage(nav = typeof navigator !== 'undefined' ? navigator : null) {
  const lang = nav && typeof nav.language === 'string' ? nav.language.toLowerCase() : ''
  return lang.startsWith('he') || lang.startsWith('iw') ? 'he' : 'en'
}

export function makeDefaults(lang = browserLanguage()) {
  return {
    // Interface settings
    interfaceLanguage: lang === 'he' ? 'he' : 'en', // 'en' | 'he'
    theme: 'auto', // 'light' | 'dark' | 'auto' (auto follows prefers-color-scheme)

    // Display settings
    displayMode: 'pasuk', // 'pasuk' (one pasuk) | 'aliyah' (one aliyah at a time) | 'parasha' (whole parsha)
    currentAliyah: 1, // Which aliyah to show when in aliyah mode (1-7)
    readingStyle: 'verse', // 'verse' (each pasuk twice + targum) | 'aliyah' (whole aliyah twice, then targum)
    showRashi: false,
    showTrop: false,
    location: 'israel',
    // Has the reader answered "Israel or Diaspora?" (or picked a location in
    // Settings)? Missing in settings saved before the question existed, so
    // existing readers are asked once too. The question never gates anything.
    locationChosen: false,
    // Has the reader closed the first-run welcome card ("Not now")? Settings
    // saved before this key existed take it from locationChosen (see
    // parseSettings), so readers who already answered the schedule question
    // never see the card.
    welcomeDismissed: false,
    fontSize: 20,
    fontRashi: true,
    targumType: 'onkelos', // onkelos | rashi | english
    showEnglish: false,
    // Show Onkelos as a reference layer when another translation is the counted one
    // (the counted layer is always shown). Off keeps earlier readers' view unchanged.
    showOnkelos: false,
  }
}

export function parseSettings(raw, lang = browserLanguage()) {
  const defaults = makeDefaults(lang)
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults
    const merged = { ...defaults, ...parsed }
    if (!Object.prototype.hasOwnProperty.call(parsed, 'welcomeDismissed')) {
      merged.welcomeDismissed = parsed.locationChosen === true
    }
    return merged
  } catch (e) {
    console.warn('Could not parse saved settings, using defaults:', e)
    return defaults
  }
}
