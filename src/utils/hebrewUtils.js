/**
 * Hebrew text utilities
 */

/**
 * Remove trop (cantillation marks) from Hebrew text
 * Trop marks are Unicode characters in ranges:
 * - U+0591 to U+05AF (Hebrew accents)
 * - U+05BD (meteg)
 * - U+05BF (rafe)
 * - U+05C0 (paseq)
 * - U+05C3 (sof pasuq)
 */
export function removeTrop(text) {
  if (!text) return text

  // Remove all Hebrew cantillation marks
  return text.replace(/[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C3]/g, '')
}

/**
 * Conditionally remove trop based on setting
 */
export function formatHebrewText(text, showTrop = false) {
  if (showTrop) {
    return text
  }
  return removeTrop(text)
}

const hebrewNumerals = {
  1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
  10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ',
  100: 'ק', 200: 'ר', 300: 'ש', 400: 'ת'
}

/**
 * Hebrew numeral for a 1-based chapter/verse number (no gershayim).
 * Keeps the historical output of this app (15 -> יה, 16 -> יו) unchanged.
 */
export function toHebrew(num) {
  if (num === 0) return ''

  const hundreds = Math.floor(num / 100) * 100
  const tens = Math.floor((num % 100) / 10) * 10
  const ones = num % 10

  let result = ''
  if (hundreds > 0) result += hebrewNumerals[hundreds]
  if (tens > 0) result += hebrewNumerals[tens]
  if (ones > 0) result += hebrewNumerals[ones]

  return result
}
