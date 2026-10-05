/**
 * Moving a finished cycle's marks aside, and putting them back.
 *
 * Stored next to the guarded `shnayim-progress` (whose shape never changes):
 *   shnayim-cycles           { [route]: hebrewYear }   the cycle a route's marks belong to
 *   shnayim-progress-archive { [route]: { [hebrewYear]: verses } }
 *                            the last archived marks per route (one year kept,
 *                            so storage stays bounded); `verses` has the
 *                            shnayim-progress per-route shape
 *   shnayim-migrations       { overlapFill?: true, cycleLabels?: true }
 *                            one-time upgrade steps already done
 *
 * The orchestration functions take an `io` object so they run the same
 * against real storage (src/composables/useCycles.js) and a fake in tests:
 *
 *   readProgress()      current progress map (fresh, including other tabs)
 *   readCycles()        / writeCycles(map)     -> boolean (stored durably)
 *   readArchive()       / writeArchive(map)    -> boolean
 *   readMigrations()    / writeMigrations(map) -> boolean
 *   clearRoutes(routes) clear each route the way "start this parsha over"
 *                       does (overlap-aware); true once that is on disk
 *   markFields(writes)  set each [route, verseKey, field] to true, written
 *                       through to overlapping routes; true once on disk
 *
 * Interruption safety of the yearly move (a tab can close between any two
 * writes): archive first, then clear, then update the label; an empty route
 * is never archived. Re-running after a stop at any point either repeats an
 * identical archive write or finds the route already empty and only fixes the
 * label, so a real archive entry is never overwritten with nothing.
 *
 * Pure: no Vue, no localStorage.
 */
import { overlapGroup, fillInWrites } from './overlap.js'
import { upgradeYearOf } from './cycle.js'

export const CYCLES_KEY = 'shnayim-cycles'
export const ARCHIVE_KEY = 'shnayim-progress-archive'
export const MIGRATIONS_KEY = 'shnayim-migrations'

const FIELDS = ['hebrew1', 'hebrew2', 'targum']

/** JSON object or {} for anything missing / corrupt / not a plain object. */
export function parseObject(raw) {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch (e) {
    return {}
  }
}

/** Does a route's verse map hold at least one `true` field? */
export function hasMarks(verses) {
  if (!verses || typeof verses !== 'object') return false
  for (const record of Object.values(verses)) {
    if (!record) continue
    for (const field of FIELDS) if (record[field] === true) return true
  }
  return false
}

const isYear = (y) => Number.isInteger(y)

const cloneVerses = (verses) => {
  const out = {}
  for (const [k, rec] of Object.entries(verses || {})) {
    out[k] = { hebrew1: rec?.hebrew1 === true, hebrew2: rec?.hebrew2 === true, targum: rec?.targum === true }
  }
  return out
}

// Archived years kept per route. Two, so starting a parsha over this year
// does not push out the copy of last year's marks.
const ARCHIVED_YEARS_KEPT = 2

/**
 * The archive with `entries` ({ route, year, verses }) written in. Each route
 * keeps its most recent archived years (ARCHIVED_YEARS_KEPT); an entry for a
 * year already archived replaces that year's copy.
 */
export function addToArchive(archive, entries) {
  const out = { ...archive }
  for (const { route, year, verses } of entries) {
    const years = { ...(out[route] || {}), [year]: cloneVerses(verses) }
    const keep = Object.keys(years).map(Number).filter(isYear).sort((a, b) => b - a).slice(0, ARCHIVED_YEARS_KEPT)
    out[route] = Object.fromEntries(keep.map(y => [y, years[y]]))
  }
  return out
}

/** The most recent archived entry for a route that still holds marks, or null. */
export function latestArchived(archive, route) {
  const years = Object.keys(archive?.[route] || {}).map(Number).filter(isYear).sort((a, b) => b - a)
  for (const year of years) if (hasMarks(archive[route][year])) return { route, year }
  return null
}

/**
 * Upgrade rule: every route that has marks but no label gets the fixed label
 * from cycle.js (UPGRADE_* constants), never one computed from the clock.
 */
export function upgradeLabels(progress, cycles) {
  const out = { ...cycles }
  for (const [route, verses] of Object.entries(progress || {})) {
    if (!isYear(out[route]) && hasMarks(verses)) out[route] = upgradeYearOf(route)
  }
  return out
}

/**
 * What the yearly move should do now. Works on overlap groups (a combined
 * route and its singles), which are archived and labelled together.
 *
 * A group is stale when any member with marks carries a label older than its
 * current cycle. Then every member with marks is archived under its own label
 * and cleared, and every member is labelled with the current cycle. Outside a
 * stale group only labels move: an empty route with an old label, or marks
 * with no label (made after the upgrade ran — treated as this cycle's).
 *
 * @param {(route: string) => number} currentYearOf
 * @returns {{ archive: Array<{route, year, verses}>, clear: string[], labels: Object }}
 */
export function planRollover(progress, cycles, currentYearOf) {
  const archive = []
  const clear = []
  const labels = {}
  const seen = new Set()
  const routes = new Set([...Object.keys(progress || {}), ...Object.keys(cycles || {})])

  for (const route of routes) {
    if (seen.has(route)) continue
    const group = overlapGroup(route)
    for (const r of group) seen.add(r)

    const members = group.map(r => ({
      route: r,
      marked: hasMarks(progress?.[r]),
      label: cycles?.[r],
      current: currentYearOf(r)
    }))
    const staleLabels = members
      .filter(m => m.marked && isYear(m.label) && m.label < m.current)
      .map(m => m.label)

    if (staleLabels.length) {
      const groupYear = Math.min(...staleLabels)
      for (const m of members) {
        if (m.marked) {
          archive.push({ route: m.route, year: isYear(m.label) ? m.label : groupYear, verses: progress[m.route] })
          clear.push(m.route)
        }
        if (m.marked || isYear(m.label)) labels[m.route] = m.current
      }
      continue
    }

    for (const m of members) {
      if (m.marked && !isYear(m.label)) labels[m.route] = m.current
      else if (!m.marked && isYear(m.label) && m.label < m.current) labels[m.route] = m.current
    }
  }
  return { archive, clear, labels }
}

/**
 * The yearly move. Order: archive -> clear -> labels. Stops before clearing if
 * the archive could not be stored, and before relabelling if the clear did not
 * reach disk, so a retry on the next start finds the marks still there.
 *
 * @returns {{ archived: Array<{route, year}>, ok: boolean }}
 */
export function performRollover(io, currentYearOf) {
  const plan = planRollover(io.readProgress(), io.readCycles(), currentYearOf)
  const archived = plan.archive.map(({ route, year }) => ({ route, year }))

  if (plan.archive.length) {
    if (!io.writeArchive(addToArchive(io.readArchive(), plan.archive))) return { archived: [], ok: false }
  }
  if (plan.clear.length) {
    if (!io.clearRoutes(plan.clear)) return { archived, ok: false }
  }
  if (Object.keys(plan.labels).length) {
    if (!io.writeCycles({ ...io.readCycles(), ...plan.labels })) return { archived, ok: false }
  }
  return { archived, ok: true }
}

/**
 * One-time upgrade steps, each recorded once done:
 *  1. overlapFill — copy existing marks across overlapping routes (union).
 *  2. cycleLabels — label pre-existing marks by the upgrade rule.
 * The fill-in runs first so the routes it fills are labelled by the upgrade
 * rule too, the same as their partners. Both steps are idempotent, so a stop
 * between a step and its flag only repeats the step.
 *
 * @returns {boolean} true when both steps are recorded as done
 */
export function performMigrations(io) {
  let done = io.readMigrations()
  if (done.overlapFill !== true) {
    const writes = fillInWrites(io.readProgress())
    if (writes.length && !io.markFields(writes)) return false
    if (!io.writeMigrations({ ...done, overlapFill: true })) return false
    done = io.readMigrations()
  }
  if (done.cycleLabels !== true) {
    if (!io.writeCycles(upgradeLabels(io.readProgress(), io.readCycles()))) return false
    if (!io.writeMigrations({ ...done, cycleLabels: true })) return false
  }
  return true
}

/**
 * "Start this parsha over": archive the route's marks under its label (or the
 * current cycle), then clear it and the same verses in overlapping routes.
 * Nothing happens for a route without marks.
 *
 * @returns {{ route, year } | null} the archive entry, or null when nothing was cleared
 */
export function performStartOver(io, route, currentYear) {
  const verses = io.readProgress()?.[route]
  if (!hasMarks(verses)) return null
  const label = io.readCycles()[route]
  const year = isYear(label) ? label : currentYear
  if (!io.writeArchive(addToArchive(io.readArchive(), [{ route, year, verses }]))) return null
  if (!io.clearRoutes([route])) return null
  return { route, year }
}

/**
 * Undo: put archived marks back (as `true` field writes, so marks made since
 * survive and overlapping routes get them too), then label every route of the
 * affected groups that now has marks with the current cycle, so the restored
 * marks are not moved straight back out by the next yearly check.
 *
 * @param {Array<{route, year}>} entries
 * @returns {boolean}
 */
export function performRestore(io, entries, currentYearOf) {
  const archive = io.readArchive()
  const writes = []
  for (const { route, year } of entries) {
    const verses = archive?.[route]?.[year]
    for (const [verseKey, record] of Object.entries(verses || {})) {
      for (const field of FIELDS) if (record?.[field] === true) writes.push([route, verseKey, field])
    }
  }
  if (!writes.length) return false
  if (!io.markFields(writes)) return false

  const progress = io.readProgress()
  const labels = {}
  for (const { route } of entries) {
    for (const r of overlapGroup(route)) {
      if (hasMarks(progress?.[r])) labels[r] = currentYearOf(r)
    }
  }
  return io.writeCycles({ ...io.readCycles(), ...labels })
}
