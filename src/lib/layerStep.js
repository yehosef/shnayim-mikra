/**
 * layerStep — pure decisions for the one-reading view
 * (src/components/AliyahReading.vue, driven by ParshaDisplay.vue): one aliyah
 * read one reading at a time — the whole aliyah in the first reading, then the
 * second, then the counted translation.
 *
 * No Vue, no storage, no DOM. The component passes, per reading, one boolean
 * per pasuk of the aliyah on screen (`read[i]` = that reading's field is true
 * for displayVerses[i]); readings are numbered as everywhere else in the list
 * view: 1 = hebrew1, 2 = hebrew2, 3 = targum, and 0 = parked (nothing selected
 * because everything in the aliyah is read). Tested in tests/layer-step.test.js.
 *
 * In this view the aliyah on screen is the whole scope, so "first unread of
 * reading 1, then of reading 2, then of reading 3" is exactly the 'aliyah'
 * style reading pointer (progressMath.nextUnread with `only`), computed here
 * from the same booleans.
 */

/** The three readings in order, and the progress field each one marks. */
export const READINGS = [1, 2, 3]
export const FIELD_OF = Object.freeze({ 1: 'hebrew1', 2: 'hebrew2', 3: 'targum' })

const isReading = (p) => p === 1 || p === 2 || p === 3

/** Index of the first unread pasuk in `read`, or -1 when all are read. */
export function firstUnread(read) {
  const list = read || []
  for (let i = 0; i < list.length; i++) if (!list[i]) return i
  return -1
}

/**
 * The reading on screen. The selected reading while there is one; when the
 * selection is parked (everything in the aliyah read), the reading the reader
 * was last on, and the translation when there is none yet.
 */
export function readingOnScreen({ selectedPhase, lastReading }) {
  if (isReading(selectedPhase)) return selectedPhase
  if (isReading(lastReading)) return lastReading
  return 3
}

/**
 * The first unread step of the whole aliyah: every pasuk of reading 1, then
 * reading 2, then reading 3 (the 'aliyah' style pointer). Parks on the last
 * pasuk with no reading selected when everything is read.
 */
export function firstUnreadStep(readsByPhase) {
  let length = 0
  for (const phase of READINGS) {
    const read = readsByPhase?.[phase] || []
    length = Math.max(length, read.length)
    const i = firstUnread(read)
    if (i >= 0) return { index: i, phase }
  }
  return { index: Math.max(length - 1, 0), phase: 0 }
}

/**
 * A reading tab, or the 1 / 2 / 3 key: show that reading with the selection on
 * its first unread pasuk, or on its first pasuk when it is all read.
 */
export function showReading({ phase, read }) {
  const i = firstUnread(read)
  return { index: i >= 0 ? i : 0, phase }
}

/**
 * Where Space or a tap that marked a pasuk moves the selection, in the reading
 * `phase` (the readings after the mark):
 *  1. the next unread pasuk of the same reading after `index`;
 *  2. otherwise an unread pasuk of the same reading before it (one skipped);
 *  3. otherwise the next step of the aliyah (firstUnreadStep): the next
 *     reading's first unread pasuk, or parked when the aliyah is all read.
 */
export function nextInReading({ index, phase, readsByPhase }) {
  const read = readsByPhase?.[phase] || []
  for (let i = index + 1; i < read.length; i++) if (!read[i]) return { index: i, phase }
  for (let i = 0; i < Math.min(index, read.length); i++) if (!read[i]) return { index: i, phase }
  return firstUnreadStep(readsByPhase)
}

/**
 * The arrow keys: the neighbouring pasuk in the same reading (delta +1 next,
 * -1 previous), stopping at the ends. A parked selection steps into the
 * reading on screen, which is passed as `phase`.
 */
export function stepInReading({ index, delta, phase, maxIndex }) {
  if (maxIndex < 0) return { index: 0, phase }
  const i = Math.min(Math.max(index + delta, 0), maxIndex)
  return { index: i, phase }
}

/**
 * "Finished this reading": the pesukim of the aliyah this press marks — the
 * ones whose reading is not read yet. These are also exactly the pesukim its
 * Undo un-marks, so a pasuk read before the press stays read after the Undo.
 */
export function finishReadingKeys({ keys, read }) {
  const list = keys || []
  return list.filter((_, i) => !(read && read[i]))
}

/** The writes an Undo of "Finished this reading" makes: each changed key back to unread. */
export function undoFinishWrites({ keys, field }) {
  return (keys || []).map((key) => ({ key, field, value: false }))
}

/**
 * What the end of the text offers for the reading on screen:
 *  - 'finish'     — this reading has unread pesukim: "Finished this reading";
 *  - 'read'       — this reading is all read, another is not: "✓ Read" and a
 *                   button to `nextPhase`, the first reading with unread pesukim;
 *  - 'aliyah-read' — the whole aliyah is read.
 */
export function readingEnd({ phase, readsByPhase }) {
  if (firstUnread(readsByPhase?.[phase]) >= 0) return { state: 'finish', nextPhase: phase }
  for (const p of READINGS) {
    if (firstUnread(readsByPhase?.[p]) >= 0) return { state: 'read', nextPhase: p }
  }
  return { state: 'aliyah-read', nextPhase: 0 }
}

/**
 * The layer shown for one pasuk when the translation is on screen. The counted
 * layer (settings.targumType) when this pasuk has it; Onkelos otherwise (no
 * Rashi on this pasuk, or English that failed to load). The same `targum`
 * field is marked either way — the rule VerseView and FocusMode follow.
 */
export function translationLayerFor({ type, hasRashi, hasEnglish }) {
  if (type === 'rashi' && hasRashi) return 'rashi'
  if (type === 'english' && hasEnglish) return 'english'
  return 'onkelos'
}

/**
 * How the translation is laid out. `layers` is translationLayerFor per pasuk.
 *  - 'onkelos' — one RTL paragraph (the counted layer is Onkelos, or Rashi /
 *    English is missing from every pasuk, e.g. it failed to load: one note
 *    then says so, `note: true`, instead of one per pasuk);
 *  - 'english' — one LTR paragraph, a pasuk without English shows Onkelos;
 *  - 'rashi'   — a block per pasuk, a pasuk without Rashi shows Onkelos.
 */
export function translationLayout({ type, layers }) {
  const list = layers || []
  if (type !== 'rashi' && type !== 'english') return { layout: 'onkelos', note: false }
  if (list.length > 0 && list.every((l) => l === 'onkelos')) return { layout: 'onkelos', note: true }
  return { layout: type, note: false }
}
