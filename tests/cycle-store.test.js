/**
 * The yearly archive move, the upgrade rule, "start this parsha over" and
 * Undo, run against a fake store through the same `io` interface the app
 * uses (src/composables/useCycles.js wires it to localStorage).
 *
 * "Interrupted" means the tab closed before the Nth durable write: every write
 * before it happened, that one and the rest did not. A re-run must then reach
 * exactly the state an uninterrupted run reaches, and never replace a real
 * archive entry with an empty one.
 */
import { describe, it, expect } from 'vitest'
import { routesForVerse, clearTargets, partialClearWrites } from '../src/lib/overlap.js'
import { cycleOf } from '../src/lib/cycle.js'
import {
  hasMarks,
  addToArchive,
  latestArchived,
  upgradeLabels,
  planRollover,
  performRollover,
  performMigrations,
  performStartOver,
  performRestore
} from '../src/lib/cycleStore.js'

const T = () => ({ hebrew1: true, hebrew2: true, targum: true })
const clone = (x) => JSON.parse(JSON.stringify(x))

class Crash extends Error {}

/** A device's storage: four keys, each a JSON-able value. */
function makeDisk({ progress = {}, cycles = {}, archive = {}, migrations = {} } = {}) {
  return clone({ progress, cycles, archive, migrations })
}

/**
 * io over `disk`. Every method that stores something counts as one durable
 * write; with `crashAt: n` the n-th one throws before touching the disk.
 * `failArchive` makes the archive write report failure (quota) instead.
 */
function makeIo(disk, { crashAt = Infinity, failArchive = false } = {}) {
  let writes = 0
  const durable = (apply) => {
    writes++
    if (writes === crashAt) throw new Crash(`crash before write ${writes}`)
    apply()
    return true
  }
  const io = {
    get writes() { return writes },
    readProgress: () => clone(disk.progress),
    readCycles: () => clone(disk.cycles),
    readArchive: () => clone(disk.archive),
    readMigrations: () => clone(disk.migrations),
    writeCycles: (m) => durable(() => { disk.cycles = clone(m) }),
    writeArchive: (m) => failArchive ? false : durable(() => { disk.archive = clone(m) }),
    writeMigrations: (m) => durable(() => { disk.migrations = clone(m) }),
    // Same semantics as useProgress.clearParshaProgress.
    clearRoutes: (routes) => durable(() => {
      const p = clone(disk.progress)
      for (const route of routes) {
        for (const [r, k, f] of partialClearWrites(p, route)) p[r][k][f] = false
        for (const r of clearTargets(route).whole) delete p[r]
      }
      disk.progress = p
    }),
    // Same semantics as useProgress.setVerseProgress (write-through).
    markFields: (writes) => durable(() => {
      const p = clone(disk.progress)
      for (const [route, k, f] of writes) {
        for (const r of routesForVerse(route, k)) {
          p[r] ||= {}
          p[r][k] ||= { hebrew1: false, hebrew2: false, targum: false }
          p[r][k][f] = true
        }
      }
      disk.progress = p
    })
  }
  return io
}

// Monday 2026-10-05, the release week: Simchat Torah 5787 was Shabbat 10-03
// (Israel), so Vezot Haberachah is still in its catch-up days.
const RELEASE = new Date(2026, 9, 5, 12)
const WEDNESDAY = new Date(2026, 9, 7, 12)
const yearAt = (date, il = true) => (route) => cycleOf(route, date, il)

/** What App.vue does at start: one-time steps, then the yearly move. */
function startApp(io, date) {
  if (!performMigrations(io)) return null
  return performRollover(io, yearAt(date))
}

/** Marks left by the previous release: no labels, no fill-in. */
const preRelease = () => makeDisk({
  progress: {
    bereshit: { '0:0': T() },
    noach: { '5:8': T() },
    matot: { '29:1': T(), '29:2': { hebrew1: true, hebrew2: false, targum: false } },
    'vzot-haberachah': { '32:0': T() }
  }
})

describe('upgrade rule (marks from before this release)', () => {
  it('labels Bereshit 5787 and everything else 5786, from constants not the clock', () => {
    const cycles = upgradeLabels(preRelease().progress, {})
    expect(cycles).toEqual({ bereshit: 5787, noach: 5786, matot: 5786, 'vzot-haberachah': 5786 })
    // An existing label is never replaced; an empty route is never labelled.
    expect(upgradeLabels({ noach: { '5:8': T() }, lech: {} }, { noach: 5787 })).toEqual({ noach: 5787 })
  })

  it('first start in the release week: fill-in, label, archive all but Bereshit and Vezot Haberachah', () => {
    const disk = preRelease()
    const result = startApp(makeIo(disk), RELEASE)

    expect(result.ok).toBe(true)
    expect(result.archived.sort((a, b) => a.route.localeCompare(b.route))).toEqual([
      { route: 'matot', year: 5786 },
      { route: 'matot-masei', year: 5786 },
      { route: 'noach', year: 5786 }
    ])
    expect(disk.migrations).toEqual({ overlapFill: true, cycleLabels: true })
    // The fill-in copied matot's marks into matot-masei before both were archived together.
    expect(disk.archive['matot-masei'][5786]).toEqual(preRelease().progress.matot)
    expect(disk.archive.matot[5786]).toEqual(preRelease().progress.matot)
    expect(disk.archive.noach[5786]).toEqual(preRelease().progress.noach)
    expect(Object.keys(disk.progress).sort()).toEqual(['bereshit', 'vzot-haberachah'])
    expect(disk.cycles).toEqual({
      bereshit: 5787, noach: 5787, matot: 5787, 'matot-masei': 5787, 'vzot-haberachah': 5786
    })
  })

  it('Vezot Haberachah moves once its catch-up days end', () => {
    const disk = preRelease()
    startApp(makeIo(disk), RELEASE)
    const later = startApp(makeIo(disk), WEDNESDAY)
    expect(later.archived).toEqual([{ route: 'vzot-haberachah', year: 5786 }])
    expect(disk.progress['vzot-haberachah']).toBeUndefined()
    expect(disk.cycles['vzot-haberachah']).toBe(5787)
    expect(disk.archive['vzot-haberachah'][5786]).toEqual(preRelease().progress['vzot-haberachah'])
  })

  it('a fresh install has nothing to label or archive', () => {
    const disk = makeDisk()
    expect(startApp(makeIo(disk), RELEASE)).toEqual({ archived: [], ok: true })
    expect(disk.cycles).toEqual({})
    expect(disk.archive).toEqual({})
  })

  it('marks without a label after the upgrade ran count as this cycle\'s', () => {
    const disk = makeDisk({
      progress: { noach: { '5:8': T() } },
      migrations: { overlapFill: true, cycleLabels: true }
    })
    expect(startApp(makeIo(disk), RELEASE).archived).toEqual([])
    expect(disk.cycles).toEqual({ noach: 5787 })
    expect(disk.progress.noach['5:8'].hebrew1).toBe(true)
  })
})

describe('yearly move', () => {
  // A year on: Simchat Torah 5788 in Israel is 22 Tishrei = 2027-10-23.
  const ST_5788 = new Date(2027, 9, 23, 12)
  const AFTER_5788 = new Date(2027, 9, 24, 12)
  const labelled = () => makeDisk({
    progress: {
      bereshit: { '0:0': T() },
      matot: { '29:1': T() },
      'matot-masei': { '29:1': T() },
      shemot: { '0:0': { hebrew1: false, hebrew2: false, targum: false } }
    },
    cycles: { bereshit: 5787, matot: 5787, 'matot-masei': 5787, shemot: 5786, pinchas: 5787 },
    migrations: { overlapFill: true, cycleLabels: true }
  })

  it('nothing moves on Simchat Torah itself', () => {
    const disk = labelled()
    const before = clone(disk)
    expect(startApp(makeIo(disk), ST_5788).archived).toEqual([])
    // Only the empty route with an old label is relabelled.
    expect(disk.progress).toEqual(before.progress)
    expect(disk.archive).toEqual({})
    expect(disk.cycles.shemot).toBe(5787)
  })

  it('the day after, every route with marks is archived under its label and cleared', () => {
    const disk = labelled()
    const result = startApp(makeIo(disk), AFTER_5788)
    expect(result.archived.map(e => e.route).sort()).toEqual(['bereshit', 'matot', 'matot-masei'])
    expect(result.archived.every(e => e.year === 5787)).toBe(true)
    // shemot holds only false fields: no marks, so nothing to archive.
    expect(disk.archive.shemot).toBeUndefined()
    expect(disk.progress.bereshit).toBeUndefined()
    expect(disk.progress.matot).toBeUndefined()
    expect(disk.progress['matot-masei']).toBeUndefined()
    expect(disk.cycles).toEqual({ bereshit: 5788, matot: 5788, 'matot-masei': 5788, shemot: 5788, pinchas: 5788 })
  })

  it('is idempotent', () => {
    const disk = labelled()
    startApp(makeIo(disk), AFTER_5788)
    const after = clone(disk)
    const io = makeIo(disk)
    expect(startApp(io, AFTER_5788)).toEqual({ archived: [], ok: true })
    expect(io.writes).toBe(0)
    expect(disk).toEqual(after)
  })

  it('archives a whole overlap group when one member is stale', () => {
    const plan = planRollover(
      { matot: { '29:1': T() }, 'matot-masei': { '29:1': T() } },
      { matot: 5786, 'matot-masei': 5787 },
      () => 5787
    )
    expect(plan.clear.sort()).toEqual(['matot', 'matot-masei'])
    expect(plan.archive.map(a => [a.route, a.year]).sort()).toEqual([['matot', 5786], ['matot-masei', 5787]])
    expect(plan.labels).toEqual({ matot: 5787, 'matot-masei': 5787 })
  })

  it('keeps the two most recent archived years per route', () => {
    const archive = addToArchive({ noach: { 5784: { '5:8': T() }, 5785: { '5:9': T() } }, bo: { 5786: { '9:0': T() } } }, [
      { route: 'noach', year: 5786, verses: { '5:8': T() } }
    ])
    expect(archive).toEqual({
      noach: { 5785: { '5:9': T() }, 5786: { '5:8': T() } },
      bo: { 5786: { '9:0': T() } }
    })
  })

  it('starting over this year keeps the copy of last year', () => {
    const archive = addToArchive({ noach: { 5786: { '5:8': T() } } }, [
      { route: 'noach', year: 5787, verses: { '5:9': T() } }
    ])
    expect(Object.keys(archive.noach)).toEqual(['5786', '5787'])
    expect(latestArchived(archive, 'noach')).toEqual({ route: 'noach', year: 5787 })
    expect(latestArchived(archive, 'bo')).toBe(null)
    expect(latestArchived({ noach: { 5787: {} , 5786: { '5:8': T() } } }, 'noach')).toEqual({ route: 'noach', year: 5786 })
  })

  it('stops before clearing when the archive cannot be stored', () => {
    const disk = labelled()
    const result = startApp(makeIo(disk, { failArchive: true }), AFTER_5788)
    expect(result).toEqual({ archived: [], ok: false })
    expect(disk.progress).toEqual(labelled().progress)
    expect(disk.cycles).toEqual(labelled().cycles)
  })
})

describe('interrupted at every point, then re-run', () => {
  const scenarios = [
    ['first start after the upgrade', preRelease, RELEASE],
    ['the next yearly move', () => makeDisk({
      progress: { noach: { '5:8': T() }, matot: { '29:1': T() }, 'matot-masei': { '29:1': T() } },
      cycles: { noach: 5787, matot: 5787, 'matot-masei': 5787 },
      migrations: { overlapFill: true, cycleLabels: true }
    }), new Date(2027, 9, 24, 12)]
  ]

  for (const [name, initial, date] of scenarios) {
    it(name, () => {
      const reference = initial()
      const counter = makeIo(reference)
      startApp(counter, date)
      const totalWrites = counter.writes
      expect(totalWrites).toBeGreaterThan(2)

      for (let crashAt = 1; crashAt <= totalWrites; crashAt++) {
        const disk = initial()
        expect(() => startApp(makeIo(disk, { crashAt }), date), `crash ${crashAt}`).toThrow(Crash)
        // Archive entries present after the crash hold the real marks, never an empty map.
        for (const years of Object.values(disk.archive)) {
          for (const verses of Object.values(years)) expect(hasMarks(verses), `crash ${crashAt}`).toBe(true)
        }
        startApp(makeIo(disk), date)
        expect(disk, `crash before write ${crashAt}`).toEqual(reference)
      }
    })
  }
})

describe('start this parsha over', () => {
  const reading = () => makeDisk({
    progress: {
      matot: { '29:1': T() },
      masei: { '32:0': T() },
      'matot-masei': { '29:1': T(), '32:0': T() }
    },
    cycles: { matot: 5787, masei: 5787, 'matot-masei': 5787 },
    archive: { matot: { 5786: { '29:5': T() } } },
    migrations: { overlapFill: true, cycleLabels: true }
  })

  it('archives the single and clears its verses in the combined route, keeping the other single\'s', () => {
    const disk = reading()
    const entry = performStartOver(makeIo(disk), 'matot', 5787)
    expect(entry).toEqual({ route: 'matot', year: 5787 })
    // Two years kept per route: last year's matot entry stays next to this one.
    expect(disk.archive.matot).toEqual({ 5786: { '29:5': T() }, 5787: { '29:1': T() } })
    expect(disk.progress.matot).toBeUndefined()
    expect(disk.progress['matot-masei']['29:1']).toEqual({ hebrew1: false, hebrew2: false, targum: false })
    expect(disk.progress['matot-masei']['32:0']).toEqual(T())
    expect(disk.progress.masei['32:0']).toEqual(T())
  })

  it('the combined route clears both singles', () => {
    const disk = reading()
    performStartOver(makeIo(disk), 'matot-masei', 5787)
    expect(disk.progress).toEqual({})
    expect(disk.archive['matot-masei'][5787]).toEqual(reading().progress['matot-masei'])
  })

  it('does nothing for a route without marks', () => {
    const disk = makeDisk({ progress: { noach: { '5:8': { hebrew1: false, hebrew2: false, targum: false } } } })
    const io = makeIo(disk)
    expect(performStartOver(io, 'noach', 5787)).toBeNull()
    expect(performStartOver(io, 'bo', 5787)).toBeNull()
    expect(io.writes).toBe(0)
  })

  it('does not clear when the archive cannot be stored', () => {
    const disk = reading()
    expect(performStartOver(makeIo(disk, { failArchive: true }), 'matot', 5787)).toBeNull()
    expect(disk.progress).toEqual(reading().progress)
  })

  it('Undo restores the single and the combined route\'s copy of it', () => {
    const disk = reading()
    const entry = performStartOver(makeIo(disk), 'matot', 5787)
    expect(performRestore(makeIo(disk), [entry], () => 5787)).toBe(true)
    expect(disk.progress.matot['29:1']).toEqual(T())
    expect(disk.progress['matot-masei']['29:1']).toEqual(T())
    expect(disk.progress['matot-masei']['32:0']).toEqual(T())
  })
})

describe('Undo after the yearly move', () => {
  it('puts the marks back, labelled with the current cycle so they stay', () => {
    const disk = preRelease()
    const { archived } = startApp(makeIo(disk), RELEASE)
    expect(performRestore(makeIo(disk), archived, yearAt(RELEASE))).toBe(true)

    expect(disk.progress.noach).toEqual(preRelease().progress.noach)
    expect(disk.progress.matot).toEqual(preRelease().progress.matot)
    expect(disk.progress['matot-masei']).toEqual(preRelease().progress.matot)
    expect(disk.cycles.noach).toBe(5787)
    expect(disk.cycles.matot).toBe(5787)
    expect(disk.cycles['matot-masei']).toBe(5787)

    // The next check (start or day change) leaves them alone.
    expect(startApp(makeIo(disk), RELEASE).archived).toEqual([])
    expect(disk.progress.noach).toEqual(preRelease().progress.noach)
  })

  it('keeps marks made since, and reports false when there is nothing to restore', () => {
    const disk = preRelease()
    const { archived } = startApp(makeIo(disk), RELEASE)
    disk.progress.noach = { '5:9': T() }
    performRestore(makeIo(disk), archived, yearAt(RELEASE))
    expect(Object.keys(disk.progress.noach).sort()).toEqual(['5:8', '5:9'])
    expect(performRestore(makeIo(disk), [{ route: 'bo', year: 5786 }], yearAt(RELEASE))).toBe(false)
  })
})
