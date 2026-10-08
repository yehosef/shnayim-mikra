/**
 * One sync round between this device's marks and the signed-in account's
 * cloud documents, and the account switch that comes before it.
 *
 * Stored next to the guarded `shnayim-progress` (whose shape never changes):
 *   shnayim-sync        { owner: uid | null, lastPull: { [year]: millis } }
 *                       whose marks the local store holds, and the server time
 *                       of the newest document seen per cycle year
 *                       (`switching: true` while an account switch is half done)
 *   shnayim-sync-base   { [route]: { year, verses, rev } }  single routes only;
 *                       what this device last agreed with the cloud (see
 *                       syncMerge.js for the compact `verses` shape and `rev`)
 *   shnayim-sync-aside  { [uid]: { progress, cycles, base, archive } }
 *                       another account's marks, set aside on this device,
 *                       with that account's archived marks
 *                       (shnayim-progress-archive), so "Restore archived
 *                       marks" can never bring one account's marks into
 *                       another's
 *
 * Cloud documents: (uid, hebrewYear, route) -> { verses, updatedAt }, single
 * routes only (syncMerge.isSingleRoute).
 *
 * The functions take an `io` object so they run the same against real storage
 * and a fake in tests:
 *
 *   readProgressRaw()   the stored shnayim-progress string (or null) as it was
 *                       before this tab wrote it: the persister rewrites a
 *                       missing value as "{}" on its next flush, which would
 *                       hide a lost store from the loss guard below
 *   readProgress()      current progress map, after flushing pending writes
 *                       (marks still inside the persister's debounce window
 *                       are stored by this call)
 *   applyFields(writes) writes: Array<[route, verseKey, field, boolean]>; each
 *                       written through to overlapping routes exactly like a
 *                       reader's mark or un-mark; true once on disk
 *   replaceProgress(map) replace the whole map (account switch); true once on disk
 *   readCycles()        / writeCycles(map) -> boolean (stored durably)
 *   readSync()          / writeSync(meta)  -> boolean
 *   readBase()          / writeBase(map)   -> boolean
 *   readAside()         / writeAside(map)  -> boolean
 *   readArchive()       / writeArchive(map) -> boolean  (shnayim-progress-archive)
 *
 * and a `cloud` object (the Firebase client implements it):
 *
 *   pull(uid, year, since) -> Promise<{ docs: { [route]: { verses, updatedAt } } }>
 *                       documents of that year changed at or after `since`
 *                       (server millis), or all of them when `since` is null;
 *                       `updatedAt` in server millis
 *   push(uid, year, route, patch) -> Promise  resolves once the server has
 *                       stored `patch` ({ [verseKey]: { [field]: boolean } })
 *                       as a field-level merge into the document (never a
 *                       whole-document overwrite) and set `updatedAt` to
 *                       server time; rejects on failure
 *
 * Safety rules (a tab can close between any two writes; two rounds may
 * interleave at every await):
 *  - Cloud-won values reach local storage BEFORE the base that records them.
 *    A stop in between leaves "local newer than base", which at worst
 *    re-uploads a value the cloud already holds; the reverse order would let
 *    a stale local value look like the reader's change and overwrite the cloud.
 *  - The base advances only by a patch the server acknowledged, re-read at
 *    that moment, so a change the reader makes while an upload is in flight
 *    stays pending, and a failed upload stays pending for the next round.
 *  - Downloads are merged in one synchronous block after every await, against
 *    a fresh read of progress and base. A route whose base entry changed while
 *    the download was in flight (another round advanced it) ignores that
 *    download, which may predate the upload that moved the base.
 *  - lastPull only ever comes from server times in pulled documents.
 *  - The account switch writes the aside copy and verifies it before local
 *    storage is replaced, and records `switching` so a re-run never sets
 *    half-loaded marks aside as the previous owner's.
 *
 * Pure apart from io / cloud: no Vue, no localStorage, no network.
 */
import { hasMarks } from './cycleStore.js'
import { routesForVerse } from './overlap.js'
import {
  isSingleRoute,
  singleRoutes,
  yearForRoute,
  baseVersesFor,
  mergeRoute,
  advanceBase,
  countFields,
  normalizeSync,
  planOwnership
} from './syncMerge.js'

export const SYNC_KEY = 'shnayim-sync'
export const BASE_KEY = 'shnayim-sync-base'
export const ASIDE_KEY = 'shnayim-sync-aside'

// Re-download documents changed up to this long before the newest one seen:
// server timestamps of concurrent writes can land slightly out of order, and
// re-applying a document is harmless.
export const PULL_OVERLAP_MS = 60 * 1000

const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x)
const obj = (x) => (isObject(x) ? x : {})
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Is `raw` a stored progress map? Missing, empty or unparseable is not. */
export function isProgressRaw(raw) {
  if (typeof raw !== 'string' || !raw) return false
  try {
    return isObject(JSON.parse(raw))
  } catch (e) {
    return false
  }
}

/**
 * `since` for pulling `year`: the newest server time seen minus the overlap,
 * or null (everything) when nothing was pulled for that year yet or no base
 * entry belongs to it. The base condition is what makes dropping the base
 * alone enough to force a full download after a crash.
 */
export function pullSince(meta, base, year) {
  const last = meta.lastPull[year]
  if (!Number.isFinite(last)) return null
  const hasBase = Object.values(obj(base)).some(e => isObject(e) && e.year === year)
  return hasBase ? last - PULL_OVERLAP_MS : null
}

/**
 * Set this device's marks aside under their owner and load `uid`'s set-aside
 * marks (or nothing). Order:
 *   0. progress flushed (readProgress), so marks made in the persister's
 *      debounce window are stored — and set aside — as the previous owner's;
 *      replaceProgress below drops anything still unflushed
 *   1. aside[owner] = { progress, cycles, base, archive }, read back and compared
 *   2. shnayim-sync.switching = true
 *   3. progress, 4. cycles, 5. archive, 6. base replaced by aside[uid] (or empty)
 *   7. shnayim-sync = { owner: uid, lastPull: {} }
 *   8. aside[uid] removed (it is the live copy now)
 * A re-run after a stop before 2 repeats an identical aside write; after 2 it
 * skips straight to loading, so the half-loaded marks are never set aside as
 * the previous owner's. Step 8 is repeated by every round of the same owner.
 *
 * @returns {boolean} true once `uid` owns the local store
 */
export function performOwnerSwitch(io, uid) {
  let meta = normalizeSync(io.readSync())
  const progress = io.readProgress()
  if (!meta.switching) {
    const from = meta.owner
    const entry = { progress, cycles: io.readCycles(), base: io.readBase(), archive: io.readArchive() }
    if (!io.writeAside({ ...obj(io.readAside()), [from]: entry })) return false
    if (!sameJson(obj(io.readAside())[from], entry)) return false
    meta = { ...meta, switching: true }
    if (!io.writeSync(meta)) return false
  }
  const incoming = obj(obj(io.readAside())[uid])
  if (!io.replaceProgress(obj(incoming.progress))) return false
  if (!io.writeCycles(obj(incoming.cycles))) return false
  if (!io.writeArchive(obj(incoming.archive))) return false
  if (!io.writeBase(obj(incoming.base))) return false
  if (!io.writeSync({ owner: uid, lastPull: {} })) return false
  return pruneAside(io, uid)
}

/** Drop aside[uid] once `uid` owns the local store. */
function pruneAside(io, uid) {
  const aside = obj(io.readAside())
  if (!(uid in aside)) return true
  const { [uid]: _live, ...rest } = aside
  return io.writeAside(rest)
}

/**
 * Loss guard, then ownership. Runs before any await.
 * @returns {boolean} false when a write failed and the round must stop
 */
function prepare(io, uid) {
  // Read before anything flushes progress (see readProgressRaw).
  const raw = io.readProgressRaw()
  if (!isProgressRaw(raw) && Object.keys(obj(io.readBase())).length) {
    // The local store is gone while the base still says what it held. Merging
    // would read that as "the reader un-marked everything" and upload it. Drop
    // the base (which alone forces a full download, see pullSince) so the
    // cloud restores the marks instead. A valid "{}" is a reader who started
    // every parsha over, and does upload its un-marks.
    if (!io.writeBase({})) return false
    if (!io.writeSync({ ...normalizeSync(io.readSync()), lastPull: {} })) return false
  }

  io.readProgress() // flush pending writes before ownership decides anything
  const meta = normalizeSync(io.readSync())
  const plan = planOwnership(meta, uid)
  if (plan === 'switch') return performOwnerSwitch(io, uid)
  if (plan === 'adopt') {
    // Marks made while never signed in: no base, so the merge ORs them with
    // the account's cloud marks. A leftover base without an owner agreed with
    // nobody known; dropping it can only turn an un-mark back into a mark.
    if (Object.keys(obj(io.readBase())).length && !io.writeBase({})) return false
    return io.writeSync({ owner: uid, lastPull: {} })
  }
  return pruneAside(io, uid)
}

/**
 * One sync round for the signed-in `uid`. Idempotent: running it again, or
 * after a stop at any write, or interleaved with another round, never loses a
 * mark and never uploads one account's marks for another.
 *
 * @param {Object} io
 * @param {Object} cloud
 * @param {{ uid: string, currentYearOf: (route: string) => number }} options
 * @returns {Promise<{ applied: number, pushed: number, pending: number, failed: number, skipped: number }>}
 *   applied: fields written locally from the cloud; pushed: fields the server
 *   acknowledged; pending: fields whose upload failed this round; failed:
 *   failed cloud calls or local writes; skipped: routes waiting for the
 *   yearly move on this device
 */
export async function syncOnce(io, cloud, { uid, currentYearOf }) {
  const summary = { applied: 0, pushed: 0, pending: 0, failed: 0, skipped: 0 }
  if (typeof uid !== 'string' || !uid) throw new Error('syncOnce needs a uid')

  // a + b: loss guard and ownership (synchronous).
  if (!prepare(io, uid)) {
    summary.failed++
    return summary
  }

  // c: the years in play. Every single route without marks syncs into its
  // current year; a route with marks into its label. At most two years
  // (Vezot Haberachah lags during its catch-up days).
  const progress0 = io.readProgress()
  const cycles0 = io.readCycles()
  const years = new Set()
  for (const route of singleRoutes()) {
    const year = yearForRoute(route, progress0, cycles0, currentYearOf)
    if (year !== null) years.add(year)
  }
  const baseSnapshot = obj(io.readBase())
  const meta0 = normalizeSync(io.readSync())
  const pulled = {} // year -> { [route]: { verses, updatedAt } }
  for (const year of [...years].sort()) {
    try {
      const result = await cloud.pull(uid, year, pullSince(meta0, baseSnapshot, year))
      pulled[year] = obj(result?.docs)
    } catch (e) {
      summary.failed++
    }
  }

  // d: merge, in one synchronous block against fresh reads.
  if (normalizeSync(io.readSync()).owner !== uid) {
    // Another round switched accounts while this one was downloading.
    summary.failed++
    return summary
  }
  const progress = io.readProgress()
  const cycles = io.readCycles()
  const base = obj(io.readBase())
  const staleYears = new Set()

  const routes = new Set()
  for (const route of Object.keys(progress)) routes.add(route)
  for (const route of Object.keys(base)) routes.add(route)
  for (const docs of Object.values(pulled)) for (const route of Object.keys(docs)) routes.add(route)

  const writes = []
  const labels = {}
  const baseUpdates = {}
  const uploads = [] // { route, year, patch }
  for (const route of [...routes].sort()) {
    if (!isSingleRoute(route)) continue
    const year = yearForRoute(route, progress, cycles, currentYearOf)
    if (year === null) {
      summary.skipped++
      continue
    }
    let doc = pulled[year]?.[route]
    if (doc && base[route]?.rev !== baseSnapshot[route]?.rev) {
      doc = undefined
      staleYears.add(year)
    }
    const baseVerses = baseVersesFor(base[route], year)
    const merged = mergeRoute(progress[route], baseVerses, isObject(doc) ? doc.verses : undefined)

    for (const [verseKey, field, value] of merged.apply) {
      writes.push([route, verseKey, field, value])
      if (value !== true) continue
      // A route that gets its first mark from the cloud is labelled with the
      // year it synced into (partners: their own current cycle), as a reader's
      // first mark would be; otherwise a stale label would make the next round
      // skip it and the yearly move archive it.
      for (const r of routesForVerse(route, verseKey)) {
        if (hasMarks(progress[r]) || r in labels) continue
        const want = r === route ? year : currentYearOf(r)
        if (cycles[r] !== want) labels[r] = want
      }
    }
    const entry = base[route]
    if (!isObject(entry) || entry.year !== year || !sameJson(entry.verses, merged.base)) {
      baseUpdates[route] = { year, verses: merged.base, rev: (entry?.rev || 0) + 1 }
    }
    if (Object.keys(merged.patch).length) uploads.push({ route, year, patch: merged.patch })
  }

  if (Object.keys(labels).length && !io.writeCycles({ ...io.readCycles(), ...labels })) {
    summary.failed++
    return summary
  }
  if (writes.length) {
    if (!io.applyFields(writes)) {
      summary.failed++
      return summary
    }
    summary.applied = writes.length
  }
  if (Object.keys(baseUpdates).length && !io.writeBase({ ...obj(io.readBase()), ...baseUpdates })) {
    summary.failed++
    return summary
  }

  // f: lastPull from server times only, never moving backwards. A year whose
  // download was partly ignored keeps its old value so it is fetched again.
  const meta = normalizeSync(io.readSync())
  const lastPull = { ...meta.lastPull }
  for (const [year, docs] of Object.entries(pulled)) {
    if (staleYears.has(Number(year))) continue
    for (const doc of Object.values(docs)) {
      const t = doc?.updatedAt
      if (Number.isFinite(t) && !(lastPull[year] >= t)) lastPull[year] = t
    }
  }
  if (!sameJson(lastPull, meta.lastPull) && !io.writeSync({ ...meta, lastPull })) summary.failed++

  // e: one field-level upload per route with pending fields.
  for (const { route, year, patch } of uploads) {
    const n = countFields(patch)
    try {
      await cloud.push(uid, year, route, patch)
    } catch (e) {
      summary.failed++
      summary.pending += n
      continue
    }
    summary.pushed += n
    // The marks were uploaded for `uid`; if another round switched accounts
    // meanwhile, this base is no longer theirs to advance (the fields simply
    // go up again, unchanged, on their next round).
    if (normalizeSync(io.readSync()).owner !== uid) continue
    const current = obj(io.readBase())
    const entry = current[route]
    const next = { year, verses: advanceBase(baseVersesFor(entry, year), patch), rev: (entry?.rev || 0) + 1 }
    if (!io.writeBase({ ...current, [route]: next })) summary.failed++
  }
  return summary
}

/**
 * How many pieces this device would upload now: fields of single routes whose
 * local value differs from the base (the same rule a round uses), skipping
 * routes that wait for the yearly move. For the "N changes waiting" status
 * and the sign-out warning; not used by the round itself.
 */
export function countPending(progress, base, cycles, currentYearOf) {
  const p = obj(progress)
  const b = obj(base)
  let n = 0
  for (const route of new Set([...Object.keys(p), ...Object.keys(b)])) {
    if (!isSingleRoute(route)) continue
    const year = yearForRoute(route, p, obj(cycles), currentYearOf)
    if (year === null) continue
    n += countFields(mergeRoute(p[route], baseVersesFor(b[route], year), undefined).patch)
  }
  return n
}
