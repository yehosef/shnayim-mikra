import { ref } from 'vue'
import { getItem, setItem } from '../lib/storage'
import { useProgress, flushProgress, setFirstMarkHandler } from './useProgress'
import { useSettings } from './useSettings'
import { jewishDayOfWeek } from './useDailyGuide'
import { cycleOf } from '../lib/cycle'
import {
  CYCLES_KEY,
  ARCHIVE_KEY,
  MIGRATIONS_KEY,
  parseObject,
  hasMarks,
  performMigrations,
  performRollover,
  performStartOver,
  performRestore,
  latestArchived
} from '../lib/cycleStore'

/**
 * Thin wiring of the yearly cycle bookkeeping (src/lib/cycleStore.js) onto
 * real storage and the progress singleton. See cycleStore.js for the keys and
 * the interruption-safety rules.
 */

const PROGRESS_KEY = 'shnayim-progress'

// Bumped whenever whole parshiyot change at once (new-cycle archive, start
// over, undo), so a view can move its selection back to the reading pointer.
const bulkRevision = ref(0)

const { progress, setVerseProgress, clearParshaProgress } = useProgress()
const { settings } = useSettings()

/**
 * The last automatic archive or start-over, for the Undo notice:
 * { kind: 'rollover' | 'startOver', entries: [{ route, year }] } or null.
 * In memory only; a reload drops the notice, never the archive.
 */
const cycleNotice = ref(null)

function currentYearOf(route, now = new Date()) {
  const location = settings.value.location
  return cycleOf(route, now, location === 'israel', jewishDayOfWeek(now, location))
}

const readKey = (key) => parseObject(getItem(key))
const writeKey = (key, value) => setItem(key, JSON.stringify(value))

const diskProgress = () => parseObject(getItem(PROGRESS_KEY))

const io = {
  readProgress() {
    // Flushing folds in other tabs' writes and stores this tab's pending ones.
    flushProgress()
    return progress.value
  },
  readCycles: () => readKey(CYCLES_KEY),
  writeCycles: (map) => writeKey(CYCLES_KEY, map),
  readArchive: () => readKey(ARCHIVE_KEY),
  writeArchive: (map) => writeKey(ARCHIVE_KEY, map),
  readMigrations: () => readKey(MIGRATIONS_KEY),
  writeMigrations: (map) => writeKey(MIGRATIONS_KEY, map),
  clearRoutes(routes) {
    for (const route of routes) clearParshaProgress(route)
    flushProgress()
    const disk = diskProgress()
    return routes.every(r => !hasMarks(disk[r]))
  },
  markFields(writes) {
    for (const [route, verseKey, field] of writes) setVerseProgress(route, verseKey, field, true)
    flushProgress()
    const disk = diskProgress()
    return writes.every(([route, verseKey, field]) => disk[route]?.[verseKey]?.[field] === true)
  }
}

/** Label routes that just got their first mark with the current cycle. */
function labelFirstMarks(routes) {
  const cycles = readKey(CYCLES_KEY)
  const now = new Date()
  for (const route of routes) cycles[route] = currentYearOf(route, now)
  writeKey(CYCLES_KEY, cycles)
}

/**
 * Run the one-time upgrade steps, then move every route whose marks belong
 * to an older cycle to the archive. Safe to call any number of times; App.vue
 * calls it at start and when the day changes.
 *
 * @param {Date} [now]
 */
function checkCycles(now = new Date()) {
  try {
    if (!performMigrations(io)) return
    setFirstMarkHandler(labelFirstMarks)
    const { archived } = performRollover(io, (route) => currentYearOf(route, now))
    if (archived.length) {
      cycleNotice.value = { kind: 'rollover', entries: archived }
      bulkRevision.value++
    }
  } catch (e) {
    console.error('Cycle check failed:', e)
  }
}

/** Does this route have anything to start over? */
function canStartOver(route) {
  return hasMarks(progress.value[route])
}

/** "Start this parsha over": archive, clear (overlap-aware), offer Undo. */
function startOver(route) {
  const entry = performStartOver(io, route, currentYearOf(route))
  if (entry) {
    cycleNotice.value = { kind: 'startOver', entries: [entry] }
    bulkRevision.value++
  }
  return entry !== null
}

/** Restore the marks the current notice refers to. */
function undoCycleNotice() {
  const notice = cycleNotice.value
  if (!notice) return false
  const ok = performRestore(io, notice.entries, (route) => currentYearOf(route))
  cycleNotice.value = null
  bulkRevision.value++
  return ok
}

function dismissCycleNotice() {
  cycleNotice.value = null
}

/** The most recent archived marks for a route ({ route, year }) or null. */
function archivedFor(route) {
  return latestArchived(readKey(ARCHIVE_KEY), route)
}

/**
 * Put a route's most recent archived marks back — the same restore as the
 * notice's Undo, reachable from Settings after the notice is gone.
 */
function restoreArchived(route) {
  const entry = archivedFor(route)
  if (!entry) return false
  const ok = performRestore(io, [entry], (r) => currentYearOf(r))
  if (ok) bulkRevision.value++
  return ok
}

export function useCycles() {
  return {
    cycleNotice,
    checkCycles,
    canStartOver,
    startOver,
    undoCycleNotice,
    bulkRevision,
    currentYearOf,
    archivedFor,
    restoreArchived,
    dismissCycleNotice
  }
}
