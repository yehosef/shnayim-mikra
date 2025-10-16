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
