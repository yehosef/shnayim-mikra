/**
 * The pure half of sign-in sync: which routes have cloud documents, which
 * year a route syncs into, the three-way merge of one route, and whose marks
 * the local store holds.
 *
 * Cloud documents exist only for the single parshiyot (routes whose
 * `hebcalName` in parshiyot.js is a string). A combined route (Matot-Masei
 * and the like) is never uploaded or downloaded; on the device it follows its
 * singles through the write-through in useProgress.setVerseProgress, so the
 * two can never disagree about the same pasuk in the cloud.
 *
 * Base: a copy of what this device last agreed with the cloud, per single
 * route, stored compact — only `true` fields, so an absent field means false:
 *   { [route]: { year, verses: { "perek:pasuk": { [field]: true } }, rev } }
 * `rev` counts writes of that route's entry; syncStore.js uses it to notice a
 * download that went stale while another round advanced the base.
 *
 * Pure: no Vue, no localStorage, no network.
 */
import parshiyot from '../data/parshiyot.js'
import { hasMarks } from './cycleStore.js'

export const FIELDS = ['hebrew1', 'hebrew2', 'targum']

const isYear = (y) => Number.isInteger(y)
const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x)

/** Does `route` have a cloud document (a single parsha)? */
export function isSingleRoute(route) {
  const def = parshiyot[route]
  return !!def && typeof def.hebcalName === 'string'
}

/** Every single route, in parshiyot.js order. */
export function singleRoutes() {
  return Object.keys(parshiyot).filter(isSingleRoute)
}

/**
 * The cycle year whose cloud document `route` syncs with this round, or null
 * to skip the route. A route with marks uses its label in `shnayim-cycles`; a
 * route without marks (or without a label) uses its current cycle. A label
 * older than the current cycle means the yearly move has not run on this
 * device yet: syncing then would mix last year's marks into this year's
 * document, so the route waits.
 */
export function yearForRoute(route, progress, cycles, currentYearOf) {
  const current = currentYearOf(route)
  const label = cycles?.[route]
  if (hasMarks(progress?.[route]) && isYear(label)) return label < current ? null : label
  return current
}

/** The base verses of `entry` if it belongs to `year`, else empty. */
export function baseVersesFor(entry, year) {
  return isObject(entry) && entry.year === year && isObject(entry.verses) ? entry.verses : {}
}

/**
 * Three-way merge of one route, field by field, over the union of verse keys
 * in local, base and cloud. With l = local is true, b = base is true and c =
 * the cloud's boolean (undefined when the document lacks that field, or when
 * no document came down this round):
 *
 *   l !== b  the reader changed it here: keep l. Pending upload, unless the
 *            cloud already holds l — then nothing to send and the base is c.
 *   l === b  take c when it is defined and differs (applied to local); the
 *            base becomes c when defined, else stays b.
 *
 * An empty base therefore gives "local true OR cloud true" on a first sign-in.
 *
 * @param {Object|undefined} local  the route's verses in shnayim-progress
 * @param {Object|undefined} base   compact base verses for this route's year
 * @param {Object|undefined} cloud  the pulled document's verses, if any
 * @returns {{ apply: Array<[string, string, boolean]>, patch: Object, base: Object }}
 *   apply: [verseKey, field, value] to write locally; patch: { [verseKey]:
 *   { [field]: boolean } } to upload; base: the compact base once the applies
 *   are on disk and before any upload is acknowledged.
 */
export function mergeRoute(local, base, cloud) {
  const keys = new Set([
    ...Object.keys(isObject(local) ? local : {}),
    ...Object.keys(isObject(base) ? base : {}),
    ...Object.keys(isObject(cloud) ? cloud : {})
  ])
  const apply = []
  const patch = {}
  const nextBase = {}
  for (const verseKey of [...keys].sort()) {
    const cloudRecord = isObject(cloud) ? cloud[verseKey] : undefined
    for (const field of FIELDS) {
      const l = local?.[verseKey]?.[field] === true
      const b = base?.[verseKey]?.[field] === true
      const c = isObject(cloudRecord) && typeof cloudRecord[field] === 'boolean' ? cloudRecord[field] : undefined
      let nb
      if (l !== b) {
        if (c === l) {
          nb = c
        } else {
          (patch[verseKey] ||= {})[field] = l
          nb = b
        }
      } else {
        if (c !== undefined && c !== l) apply.push([verseKey, field, c])
        nb = c !== undefined ? c : b
      }
      if (nb) (nextBase[verseKey] ||= {})[field] = true
    }
  }
  return { apply, patch, base: nextBase }
}

/** Compact base verses with exactly `patch` laid on top (an acknowledged upload). */
export function advanceBase(base, patch) {
  const out = {}
  for (const [verseKey, record] of Object.entries(isObject(base) ? base : {})) {
    if (isObject(record)) out[verseKey] = { ...record }
  }
  for (const [verseKey, fields] of Object.entries(isObject(patch) ? patch : {})) {
    for (const [field, value] of Object.entries(fields || {})) {
      if (!FIELDS.includes(field)) continue
      if (value === true) (out[verseKey] ||= {})[field] = true
      else if (out[verseKey]) delete out[verseKey][field]
    }
    if (out[verseKey] && !Object.keys(out[verseKey]).length) delete out[verseKey]
  }
  return out
}

/** Number of field writes in a patch. */
export function countFields(patch) {
  let n = 0
  for (const fields of Object.values(patch || {})) n += Object.keys(fields || {}).length
  return n
}

/**
 * `shnayim-sync` in a known shape: { owner: uid | null, lastPull: { [year]:
 * millis } }, plus `switching: true` while an account switch is half done
 * (the previous owner's marks are already set aside).
 */
export function normalizeSync(meta) {
  const owner = isObject(meta) && typeof meta.owner === 'string' && meta.owner ? meta.owner : null
  const lastPull = {}
  if (isObject(meta) && isObject(meta.lastPull)) {
    for (const [year, millis] of Object.entries(meta.lastPull)) {
      if (Number.isFinite(millis)) lastPull[year] = millis
    }
  }
  const out = { owner, lastPull }
  if (owner && meta.switching === true) out.switching = true
  return out
}

/**
 * Whose marks are on this device, against the account signing in:
 *   'adopt'  never signed in here: the marks become `uid`'s (merged as an OR)
 *   'same'   `uid` owns them: normal merge, so un-marks made signed out travel
 *   'switch' another account owns them (or a switch is half done): set them
 *            aside and load `uid`'s
 */
export function planOwnership(meta, uid) {
  const m = normalizeSync(meta)
  if (m.switching) return 'switch'
  if (m.owner === null) return 'adopt'
  return m.owner === uid ? 'same' : 'switch'
}
