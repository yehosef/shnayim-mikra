/**
 * Sync rounds (src/lib/syncStore.js) between simulated devices and a fake
 * cloud, through the same `io` / `cloud` interfaces the app will use.
 *
 * A device is a `disk` (the five localStorage keys involved) plus helpers that
 * act like the reader: marking writes through to overlapping routes and labels
 * a route's first mark, "start over" clears like useProgress does. The cloud is
 * one object shared by every device; it stamps documents with its own clock,
 * can fail the next call, and can hold a call open so a test can act while it
 * is in flight.
 *
 * "Interrupted" means the tab closed before the Nth durable local write: every
 * write before it happened, that one and the rest did not.
 */
import { describe, it, expect } from 'vitest'
import { routesForVerse, clearTargets, partialClearWrites } from '../src/lib/overlap.js'
import { hasMarks } from '../src/lib/cycleStore.js'
import { syncOnce, pullSince, isProgressRaw, PULL_OVERLAP_MS } from '../src/lib/syncStore.js'

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const T = () => ({ hebrew1: true, hebrew2: true, targum: true })
const F = () => ({ hebrew1: false, hebrew2: false, targum: false })
const THIS_YEAR = () => 5787
const VZOT_LAGS = (route) => (route === 'vzot-haberachah' ? 5786 : 5787)

class Crash extends Error {}

function parseProgress(raw) {
  try {
    const p = JSON.parse(raw)
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
  } catch (e) {
    return {}
  }
}

/** One device's storage. `progress` is kept as the raw stored string (or null). */
function makeDisk({ progress = {}, raw, cycles = {}, sync = {}, base = {}, aside = {}, archive = {} } = {}) {
  return {
    progress: raw !== undefined ? raw : JSON.stringify(progress),
    // Marks still inside the persister's debounce window: in memory, not yet
    // on disk. readProgress / applyFields store them; replaceProgress drops them.
    unflushed: [],
    cycles: clone(cycles),
    sync: clone(sync),
    base: clone(base),
    aside: clone(aside),
    archive: clone(archive)
  }
}

/** Write-through of field writes into a progress map, like useProgress does. */
function writeThrough(p, ws) {
  for (const [route, k, f, v] of ws) {
    for (const r of routesForVerse(route, k)) {
      p[r] ||= {}
      p[r][k] ||= F()
      p[r][k][f] = v
    }
  }
  return p
}

/** Store the unflushed marks (the persister's flush). */
function flushDisk(disk) {
  const p = writeThrough(parseProgress(disk.progress), disk.unflushed)
  disk.unflushed = []
  disk.progress = JSON.stringify(p)
  return p
}

const local = (disk) => parseProgress(disk.progress)

/**
 * io over `disk`. Every method that stores something is one durable write;
 * `crashAt: n` throws before the n-th, `crashOn: 'name'` before the first call
 * of that method.
 */
function makeIo(disk, { crashAt = Infinity, crashOn = null } = {}) {
  let writes = 0
  const durable = (name, apply) => {
    writes++
    if (writes === crashAt || name === crashOn) throw new Crash(`crash before ${name} (write ${writes})`)
    apply()
    return true
  }
  return {
    get writes() { return writes },
    readProgressRaw: () => disk.progress,
    // Like useCycles' io: flushing first. The real persister rewrites a missing
    // or corrupt value as "{}" on a flush, so this does too.
    readProgress: () => clone(flushDisk(disk)),
    // Same semantics as useProgress.applyProgressFields (write-through, true
    // and false; the persister flush stores unflushed marks too).
    applyFields: (ws) => durable('applyFields', () => {
      disk.progress = JSON.stringify(writeThrough(flushDisk(disk), ws))
    }),
    // Like useProgress.replaceProgress: unflushed changes belonged to the map
    // being replaced and are dropped.
    replaceProgress: (m) => durable('replaceProgress', () => {
      disk.unflushed = []
      disk.progress = JSON.stringify(m)
    }),
    readCycles: () => clone(disk.cycles),
    writeCycles: (m) => durable('writeCycles', () => { disk.cycles = clone(m) }),
    readSync: () => clone(disk.sync),
    writeSync: (m) => durable('writeSync', () => { disk.sync = clone(m) }),
    readBase: () => clone(disk.base),
    writeBase: (m) => durable('writeBase', () => { disk.base = clone(m) }),
    readAside: () => clone(disk.aside),
    writeAside: (m) => durable('writeAside', () => { disk.aside = clone(m) }),
    readArchive: () => clone(disk.archive),
    writeArchive: (m) => durable('writeArchive', () => { disk.archive = clone(m) })
  }
}

/** The reader marks or un-marks a piece (useProgress.setVerseProgress + first-mark label). */
function mark(disk, route, verseKey, field, value = true, yearOf = THIS_YEAR) {
  const p = local(disk)
  for (const r of routesForVerse(route, verseKey)) {
    if (value && !hasMarks(p[r])) disk.cycles[r] = yearOf(r)
    p[r] ||= {}
    p[r][verseKey] ||= F()
    p[r][verseKey][field] = value
  }
  disk.progress = JSON.stringify(p)
}

const markAll = (disk, route, verseKey, value = true) => {
  for (const f of ['hebrew1', 'hebrew2', 'targum']) mark(disk, route, verseKey, f, value)
}

/** "Start this parsha over" (useProgress.clearParshaProgress). */
function startOver(disk, route) {
  const p = local(disk)
  for (const [r, k, f] of partialClearWrites(p, route)) p[r][k][f] = false
  for (const r of clearTargets(route).whole) delete p[r]
  disk.progress = JSON.stringify(p)
}

/** The shared cloud. */
function makeCloud() {
  let clock = 1_800_000_000_000
  const docs = new Map() // "uid|year|route" -> { verses, updatedAt }
  const pushes = []
  const pulls = []
  const gates = {}
  const fails = { pull: 0, push: 0 }
  const id = (uid, year, route) => `${uid}|${year}|${route}`

  const hold = async (kind) => {
    const gate = gates[kind]
    if (!gate) return
    delete gates[kind]
    gate.started()
    await gate.released
  }

  const write = (uid, year, route, patch) => {
    const doc = docs.get(id(uid, year, route)) || { verses: {} }
    for (const [k, fields] of Object.entries(patch)) doc.verses[k] = { ...(doc.verses[k] || {}), ...fields }
    clock += 100_000 // well past PULL_OVERLAP_MS, so `since` really filters
    doc.updatedAt = clock
    docs.set(id(uid, year, route), doc)
  }

  return {
    pushes,
    pulls,
    failNext(kind, n = 1) { fails[kind] += n },
    /** Hold the next `kind` call open; `started` resolves when it arrives. */
    pause(kind) {
      let release, started
      const startedP = new Promise((r) => { started = r })
      const released = new Promise((r) => { release = r })
      gates[kind] = { started, released }
      return { started: startedP, release }
    },
    /** Another device's write, as the server would store it. */
    seed(uid, year, route, patch) { write(uid, year, route, patch) },
    doc: (uid, year, route) => clone(docs.get(id(uid, year, route))?.verses),
    routesOf: (uid) => [...docs.keys()].filter(k => k.startsWith(uid + '|')).map(k => k.split('|').slice(1).join('|')).sort(),
    allVerses: () => Object.fromEntries([...docs].map(([k, d]) => [k, d.verses])),
    async pull(uid, year, since) {
      pulls.push({ uid, year, since })
      if (fails.pull) { fails.pull--; throw new Error('offline') }
      // The answer is computed when the request arrives, then delivered.
      const out = {}
      for (const [key, doc] of docs) {
        const [u, y, route] = key.split('|')
        if (u === uid && Number(y) === year && (since === null || doc.updatedAt >= since)) out[route] = clone(doc)
      }
      await hold('pull')
      return { docs: out }
    },
    async push(uid, year, route, patch) {
      pushes.push({ uid, year, route, patch: clone(patch) })
      await hold('push')
      if (fails.push) { fails.push--; throw new Error('offline') }
      write(uid, year, route, patch)
    }
  }
}

const sync = (disk, cloud, uid = 'alice', { yearOf = THIS_YEAR, ...ioOptions } = {}) =>
  syncOnce(makeIo(disk, ioOptions), cloud, { uid, currentYearOf: yearOf })

const stripRev = (base) => Object.fromEntries(Object.entries(base || {}).map(([r, e]) => [r, { year: e.year, verses: e.verses }]))

/** Everything that must match between an interrupted-then-rerun device and an uninterrupted one. */
const state = (disk, cloud) => ({
  progress: local(disk),
  cycles: disk.cycles,
  base: stripRev(disk.base),
  owner: disk.sync.owner,
  switching: disk.sync.switching,
  aside: Object.fromEntries(Object.entries(disk.aside).map(([u, a]) => [u, { ...a, base: stripRev(a.base) }])),
  archive: disk.archive,
  cloud: cloud.allVerses()
})

/** Two of alice's devices that have both synced noach 5:8 fully read. */
async function twoDevices() {
  const cloud = makeCloud()
  const a = makeDisk()
  markAll(a, 'noach', '5:8')
  await sync(a, cloud)
  const b = makeDisk()
  await sync(b, cloud)
  expect(local(b).noach['5:8']).toEqual(T())
  return { cloud, a, b }
}

describe('first sign-in and fresh devices', () => {
  it('first sign-in with marks on both sides keeps every mark on both', async () => {
    const cloud = makeCloud()
    cloud.seed('alice', 5787, 'noach', { '5:8': { hebrew2: true }, '5:9': { hebrew1: true } })
    const disk = makeDisk()
    mark(disk, 'noach', '5:8', 'hebrew1')

    const summary = await sync(disk, cloud)
    expect(summary).toEqual({ applied: 2, pushed: 1, pending: 0, failed: 0, skipped: 0 })
    expect(local(disk).noach['5:8']).toEqual({ hebrew1: true, hebrew2: true, targum: false })
    expect(local(disk).noach['5:9'].hebrew1).toBe(true)
    expect(cloud.doc('alice', 5787, 'noach')).toEqual({ '5:8': { hebrew1: true, hebrew2: true }, '5:9': { hebrew1: true } })
    expect(disk.sync.owner).toBe('alice')
    expect(disk.base.noach.verses).toEqual({ '5:8': { hebrew1: true, hebrew2: true }, '5:9': { hebrew1: true } })

    // Nothing left to do.
    expect(await sync(disk, cloud)).toEqual({ applied: 0, pushed: 0, pending: 0, failed: 0, skipped: 0 })
  })

  it('a fresh device restores from the cloud and uploads nothing', async () => {
    const cloud = makeCloud()
    cloud.seed('alice', 5787, 'noach', { '5:8': T() })
    cloud.seed('alice', 5787, 'bereshit', { '0:0': { hebrew1: true } })
    const disk = makeDisk({ raw: null })

    await sync(disk, cloud)
    expect(local(disk).noach['5:8']).toEqual(T())
    expect(local(disk).bereshit['0:0'].hebrew1).toBe(true)
    expect(disk.cycles).toEqual({ noach: 5787, bereshit: 5787 })
    expect(cloud.pushes).toEqual([])
    expect(cloud.pulls[0]).toEqual({ uid: 'alice', year: 5787, since: null })

    // The next round downloads only what changed since, minus the overlap.
    await sync(disk, cloud)
    const newest = Math.max(...Object.values(disk.sync.lastPull))
    expect(cloud.pulls[1].since).toBe(newest - PULL_OVERLAP_MS)
    expect(cloud.pushes).toEqual([])
  })
})

describe('two devices', () => {
  it('two devices change different pieces offline and both changes survive', async () => {
    const { cloud, a, b } = await twoDevices()
    mark(a, 'noach', '5:9', 'hebrew1')
    mark(b, 'noach', '5:8', 'targum', false)
    await sync(a, cloud)
    await sync(b, cloud)
    await sync(a, cloud)
    const want = { '5:8': { hebrew1: true, hebrew2: true, targum: false }, '5:9': { hebrew1: true, hebrew2: false, targum: false } }
    expect(local(a).noach).toEqual(want)
    expect(local(b).noach).toEqual(want)
  })

  for (const [first, second, winner] of [['a', 'b', true], ['b', 'a', false]]) {
    it(`two devices change the same piece: the later upload wins (${second} last)`, async () => {
      const cloud = makeCloud()
      const devices = { a: makeDisk(), b: makeDisk() }
      await sync(devices.b, cloud) // b agreed with an empty cloud
      mark(devices.a, 'noach', '5:8', 'hebrew1')
      await sync(devices.a, cloud) // a agreed on "read"
      mark(devices.a, 'noach', '5:8', 'hebrew1', false) // a un-marks offline
      mark(devices.b, 'noach', '5:8', 'hebrew1', true) // b marks offline
      await sync(devices[first], cloud)
      await sync(devices[second], cloud)
      await sync(devices[first], cloud)
      const lastWriter = second === 'b'
      expect(cloud.doc('alice', 5787, 'noach')['5:8'].hebrew1).toBe(lastWriter ? true : false)
      expect(local(devices.a).noach['5:8'].hebrew1).toBe(winner)
      expect(local(devices.b).noach['5:8'].hebrew1).toBe(winner)
    })
  }

  it('an un-mark travels', async () => {
    const { cloud, a, b } = await twoDevices()
    mark(a, 'noach', '5:8', 'hebrew2', false)
    await sync(a, cloud)
    await sync(b, cloud)
    expect(local(b).noach['5:8']).toEqual({ hebrew1: true, hebrew2: false, targum: true })
  })

  it('start over travels, and the other device\'s later marks in that parsha survive', async () => {
    const { cloud, a, b } = await twoDevices()
    markAll(a, 'noach', '5:9')
    await sync(a, cloud)
    await sync(b, cloud)

    startOver(a, 'noach')
    const s = await sync(a, cloud)
    expect(s.pushed).toBe(6)
    expect(cloud.doc('alice', 5787, 'noach')).toEqual({ '5:8': F(), '5:9': F() })

    mark(b, 'noach', '6:0', 'hebrew1')
    await sync(b, cloud)
    expect(hasMarks({ x: local(b).noach['5:8'] })).toBe(false)
    expect(hasMarks({ x: local(b).noach['5:9'] })).toBe(false)
    await sync(a, cloud)
    expect(local(a).noach['6:0'].hebrew1).toBe(true)
    expect(local(a).noach['5:8']).toBeUndefined()
    expect(local(b).noach['6:0'].hebrew1).toBe(true)
  })
})

describe('uploads in flight and failing', () => {
  it('an un-mark made while a push is in flight is still pending afterwards', async () => {
    const cloud = makeCloud()
    const disk = makeDisk()
    mark(disk, 'noach', '5:8', 'hebrew1')
    const gate = cloud.pause('push')
    const round = sync(disk, cloud)
    await gate.started
    mark(disk, 'noach', '5:8', 'hebrew1', false)
    gate.release()
    expect((await round).pushed).toBe(1)
    // The base records exactly what the server acknowledged (true) ...
    expect(disk.base.noach.verses).toEqual({ '5:8': { hebrew1: true } })
    expect(local(disk).noach['5:8'].hebrew1).toBe(false)
    // ... so the un-mark goes up next round.
    await sync(disk, cloud)
    expect(cloud.pushes.at(-1).patch).toEqual({ '5:8': { hebrew1: false } })
    expect(cloud.doc('alice', 5787, 'noach')['5:8'].hebrew1).toBe(false)
  })

  it('a push that fails stays pending and goes up next round', async () => {
    const cloud = makeCloud()
    const disk = makeDisk()
    mark(disk, 'noach', '5:8', 'hebrew1')
    mark(disk, 'bereshit', '0:0', 'hebrew1')
    cloud.failNext('push')
    const s1 = await sync(disk, cloud)
    expect(s1).toMatchObject({ pushed: 1, pending: 1, failed: 1 })
    const failedRoute = cloud.pushes[0].route
    expect(cloud.doc('alice', 5787, failedRoute)).toBeUndefined()
    expect(disk.base[failedRoute]?.verses ?? {}).toEqual({})

    const s2 = await sync(disk, cloud)
    expect(s2).toMatchObject({ pushed: 1, pending: 0, failed: 0 })
    expect(cloud.doc('alice', 5787, failedRoute)).toEqual(failedRoute === 'noach' ? { '5:8': { hebrew1: true } } : { '0:0': { hebrew1: true } })
    expect(disk.base[failedRoute].verses).toEqual(cloud.doc('alice', 5787, failedRoute))
  })

  it('a failed download still uploads local changes and does not move lastPull', async () => {
    const cloud = makeCloud()
    const disk = makeDisk()
    mark(disk, 'noach', '5:8', 'hebrew1')
    cloud.failNext('pull')
    const s = await sync(disk, cloud)
    expect(s).toMatchObject({ pushed: 1, failed: 1 })
    expect(disk.sync.lastPull).toEqual({})
  })
})

describe('interrupted rounds', () => {
  /** alice's device: a pending mark, while the cloud has an un-mark and a new parsha from another device. */
  const setup = () => {
    const cloud = makeCloud()
    cloud.seed('alice', 5787, 'noach', { '5:9': { hebrew1: true } })
    const disk = makeDisk({
      progress: { noach: { '5:9': { hebrew1: true, hebrew2: false, targum: false } } },
      cycles: { noach: 5787 },
      sync: { owner: 'alice', lastPull: {} },
      base: { noach: { year: 5787, verses: { '5:9': { hebrew1: true } }, rev: 1 } }
    })
    cloud.seed('alice', 5787, 'noach', { '5:9': { hebrew1: false } })
    cloud.seed('alice', 5787, 'bereshit', { '0:0': T() })
    mark(disk, 'noach', '5:8', 'hebrew1')
    return { cloud, disk }
  }

  it('a stop after the local apply and before the base write re-uploads nothing stale', async () => {
    const { cloud, disk } = setup()
    await expect(sync(disk, cloud, 'alice', { crashOn: 'writeBase' })).rejects.toThrow(Crash)
    // Local already has the cloud's values; the base is still the old one.
    expect(local(disk).noach['5:9'].hebrew1).toBe(false)
    expect(local(disk).bereshit['0:0']).toEqual(T())
    expect(disk.base.noach.verses).toEqual({ '5:9': { hebrew1: true } })

    const pushesBefore = cloud.pushes.length
    await sync(disk, cloud)
    // Only the reader's own pending mark goes up — the un-mark it just
    // received is recognised as the cloud's (local === cloud), not re-sent.
    expect(cloud.pushes.slice(pushesBefore)).toEqual([{ uid: 'alice', year: 5787, route: 'noach', patch: { '5:8': { hebrew1: true } } }])
    expect(cloud.doc('alice', 5787, 'noach')).toEqual({ '5:9': { hebrew1: false }, '5:8': { hebrew1: true } })
    expect(disk.base.noach.verses).toEqual({ '5:8': { hebrew1: true } })
  })

  it('a stop before the local apply never leaves the base ahead of local, so no stale value is uploaded', async () => {
    const { cloud, disk } = setup()
    await expect(sync(disk, cloud, 'alice', { crashOn: 'applyFields' })).rejects.toThrow(Crash)
    expect(disk.base.noach.verses).toEqual({ '5:9': { hebrew1: true } })
    expect(cloud.pushes).toEqual([])
    await sync(disk, cloud)
    // The stale local "true" for 5:9 was never uploaded over the cloud's un-mark.
    expect(cloud.pushes.every(p => !('5:9' in p.patch))).toBe(true)
    expect(local(disk).noach['5:9'].hebrew1).toBe(false)
    expect(cloud.doc('alice', 5787, 'noach')['5:9'].hebrew1).toBe(false)
  })

  it('stopped before every write and re-run, the result matches an uninterrupted round', async () => {
    const reference = setup()
    const counter = makeIo(reference.disk)
    await syncOnce(counter, reference.cloud, { uid: 'alice', currentYearOf: THIS_YEAR })
    const total = counter.writes
    expect(total).toBeGreaterThanOrEqual(4)
    for (let crashAt = 1; crashAt <= total; crashAt++) {
      const { cloud, disk } = setup()
      await expect(sync(disk, cloud, 'alice', { crashAt }), `crash ${crashAt}`).rejects.toThrow(Crash)
      await sync(disk, cloud)
      expect(state(disk, cloud), `crash before write ${crashAt}`).toEqual(state(reference.disk, reference.cloud))
    }
  })
})

describe('account switch', () => {
  /** alice has read noach 5:8 (synced) and un-marked its targum while signed out; bob's cloud has bereshit. */
  const setup = async () => {
    const cloud = makeCloud()
    cloud.seed('bob', 5787, 'bereshit', { '0:0': { hebrew1: true } })
    const disk = makeDisk()
    markAll(disk, 'noach', '5:8')
    await sync(disk, cloud, 'alice')
    mark(disk, 'noach', '5:8', 'targum', false)
    disk.archive = { 'lech-lecha': { 5786: { '11:0': T() } } }
    return { cloud, disk }
  }
  const aliceLocal = () => ({ noach: { '5:8': { hebrew1: true, hebrew2: true, targum: false } } })

  it('switching to another account and back leaks nothing either way', async () => {
    const { cloud, disk } = await setup()

    await sync(disk, cloud, 'bob')
    expect(local(disk)).toEqual({ bereshit: { '0:0': { hebrew1: true, hebrew2: false, targum: false } } })
    expect(disk.sync.owner).toBe('bob')
    expect(disk.aside.alice.progress).toEqual(aliceLocal())
    expect(cloud.routesOf('bob')).toEqual(['5787|bereshit'])

    mark(disk, 'bereshit', '0:1', 'hebrew1')
    await sync(disk, cloud, 'bob')
    expect(cloud.doc('bob', 5787, 'bereshit')['0:1'].hebrew1).toBe(true)

    await sync(disk, cloud, 'alice')
    expect(local(disk)).toEqual(aliceLocal())
    expect(disk.sync.owner).toBe('alice')
    expect(Object.keys(disk.aside)).toEqual(['bob'])
    expect(disk.aside.bob.progress.bereshit['0:1'].hebrew1).toBe(true)
    // alice's un-mark made while signed out still travelled, to alice only.
    expect(cloud.doc('alice', 5787, 'noach')['5:8'].targum).toBe(false)
    expect(cloud.routesOf('alice')).toEqual(['5787|noach'])
    expect(cloud.routesOf('bob')).toEqual(['5787|bereshit'])
    expect(cloud.pushes.filter(p => p.uid === 'bob').every(p => p.route === 'bereshit')).toBe(true)
    expect(cloud.pushes.filter(p => p.uid === 'alice').every(p => p.route === 'noach')).toBe(true)

    // And bob gets his marks back on his next sign-in.
    await sync(disk, cloud, 'bob')
    expect(local(disk).bereshit['0:1'].hebrew1).toBe(true)
    expect(local(disk).noach).toBeUndefined()
  })

  it('sign-out changes nothing; the same account resumes with a normal merge', async () => {
    const { cloud, disk } = await setup()
    // Signing out is simply not calling syncOnce. Signing back in as alice:
    await sync(disk, cloud, 'alice')
    expect(disk.aside).toEqual({})
    expect(cloud.doc('alice', 5787, 'noach')['5:8'].targum).toBe(false)
  })

  it('stopped before every write of the switch and re-run, the result matches; the aside copy is always alice\'s', async () => {
    const reference = await setup()
    const counter = makeIo(reference.disk)
    await syncOnce(counter, reference.cloud, { uid: 'bob', currentYearOf: THIS_YEAR })
    const total = counter.writes
    expect(total).toBeGreaterThanOrEqual(6)
    for (let crashAt = 1; crashAt <= total; crashAt++) {
      const { cloud, disk } = await setup()
      await expect(sync(disk, cloud, 'bob', { crashAt }), `crash ${crashAt}`).rejects.toThrow(Crash)
      if (disk.aside.alice) expect(disk.aside.alice.progress, `crash ${crashAt}`).toEqual(aliceLocal())
      await sync(disk, cloud, 'bob')
      expect(state(disk, cloud), `crash before write ${crashAt}`).toEqual(state(reference.disk, reference.cloud))
    }
  })

  it('archived marks travel with their account and are never restorable under another', async () => {
    const { cloud, disk } = await setup()
    const aliceArchive = { 'lech-lecha': { 5786: { '11:0': T() } } }
    disk.archive = clone(aliceArchive)

    await sync(disk, cloud, 'bob')
    expect(disk.archive).toEqual({})
    expect(disk.aside.alice.archive).toEqual(aliceArchive)

    // bob starts a parsha over on this device: his own archive.
    const bobArchive = { bereshit: { 5787: { '0:0': { hebrew1: true, hebrew2: false, targum: false } } } }
    disk.archive = clone(bobArchive)

    await sync(disk, cloud, 'alice')
    expect(disk.archive).toEqual(aliceArchive)
    expect(disk.aside.bob.archive).toEqual(bobArchive)
    expect(disk.aside.alice).toBeUndefined()

    await sync(disk, cloud, 'bob')
    expect(disk.archive).toEqual(bobArchive)
    expect(disk.aside.alice.archive).toEqual(aliceArchive)
  })

  it('an aside copy from before archives were set aside loads as an empty archive', async () => {
    const { cloud, disk } = await setup()
    disk.aside = { bob: { progress: { bereshit: { '0:5': T() } }, cycles: { bereshit: 5787 }, base: {} } }
    disk.archive = { noach: { 5786: { '5:8': T() } } }
    await sync(disk, cloud, 'bob')
    expect(disk.archive).toEqual({})
    expect(disk.aside.alice.archive).toEqual({ noach: { 5786: { '5:8': T() } } })
  })

  it('marks still inside the save delay when the account switches belong to the account that made them', async () => {
    const { cloud, disk } = await setup()
    // alice marks a piece; it is still in memory (inside the 300 ms debounce)
    // when bob signs in on this device.
    disk.unflushed.push(['noach', '5:9', 'hebrew1', true])

    await sync(disk, cloud, 'bob')
    expect(disk.aside.alice.progress.noach['5:9'].hebrew1).toBe(true)
    expect(local(disk).noach).toBeUndefined()
    expect(cloud.pushes.filter(p => p.uid === 'bob').every(p => p.route !== 'noach')).toBe(true)

    await sync(disk, cloud, 'alice')
    expect(local(disk).noach['5:9'].hebrew1).toBe(true)
    expect(cloud.doc('alice', 5787, 'noach')['5:9'].hebrew1).toBe(true)
    expect(cloud.routesOf('bob')).toEqual(['5787|bereshit'])
  })

  it('a switch stopped halfway and then signed back into the first account restores it intact', async () => {
    const reference = await setup()
    const counter = makeIo(reference.disk)
    await syncOnce(counter, reference.cloud, { uid: 'bob', currentYearOf: THIS_YEAR })
    for (let crashAt = 1; crashAt <= counter.writes; crashAt++) {
      const { cloud, disk } = await setup()
      await expect(sync(disk, cloud, 'bob', { crashAt })).rejects.toThrow(Crash)
      await sync(disk, cloud, 'alice')
      expect(local(disk), `crash ${crashAt}`).toEqual(aliceLocal())
      expect(disk.sync.owner).toBe('alice')
      expect(cloud.routesOf('alice'), `crash ${crashAt}`).toEqual(['5787|noach'])
      expect(cloud.doc('alice', 5787, 'noach')['5:8'].targum).toBe(false)
      expect(cloud.doc('bob', 5787, 'bereshit'), `crash ${crashAt}`).toEqual({ '0:0': { hebrew1: true } })
    }
  })
})

describe('lost and emptied local stores', () => {
  for (const [name, raw] of [['missing', null], ['unparseable', '{"noach": tru']]) {
    it(`local store lost (${name}) with the base intact: the cloud restores, nothing is un-marked`, async () => {
      const { cloud, a } = await twoDevices()
      a.progress = raw
      const s = await sync(a, cloud)
      expect(s.pushed).toBe(0)
      expect(cloud.pushes.filter(p => p.patch['5:8'])).toHaveLength(1) // only the original upload
      expect(local(a).noach['5:8']).toEqual(T())
      expect(cloud.doc('alice', 5787, 'noach')['5:8']).toEqual(T())
    })
  }

  it('a valid empty store (every parsha started over) uploads the un-marks', async () => {
    const { cloud, a, b } = await twoDevices()
    a.progress = '{}'
    const s = await sync(a, cloud)
    expect(s.pushed).toBe(3)
    expect(cloud.doc('alice', 5787, 'noach')['5:8']).toEqual(F())
    await sync(b, cloud)
    expect(local(b).noach['5:8']).toEqual(F())
  })

  it('isProgressRaw and pullSince', () => {
    expect(isProgressRaw('{}')).toBe(true)
    expect(isProgressRaw(null)).toBe(false)
    expect(isProgressRaw('[]')).toBe(false)
    expect(isProgressRaw('nope')).toBe(false)
    const meta = { lastPull: { 5787: 1000000 } }
    expect(pullSince(meta, { noach: { year: 5787, verses: {} } }, 5787)).toBe(1000000 - PULL_OVERLAP_MS)
    // No base entry for the year: download everything.
    expect(pullSince(meta, {}, 5787)).toBe(null)
    expect(pullSince(meta, { noach: { year: 5787, verses: {} } }, 5786)).toBe(null)
  })
})

describe('cycle years', () => {
  it('a device that has not rolled over yet skips the route', async () => {
    const cloud = makeCloud()
    cloud.seed('alice', 5788, 'noach', { '6:0': { hebrew1: true } })
    const disk = makeDisk({
      progress: { noach: { '5:8': T() } },
      cycles: { noach: 5787 },
      sync: { owner: 'alice', lastPull: {} },
      base: { noach: { year: 5787, verses: { '5:8': T() }, rev: 1 } }
    })
    const s = await sync(disk, cloud, 'alice', { yearOf: () => 5788 })
    expect(s.skipped).toBe(1)
    expect(cloud.pushes).toEqual([])
    expect(local(disk).noach).toEqual({ '5:8': T() })
    expect(cloud.pulls.map(p => p.year)).toEqual([5788])
    expect(disk.base.noach.year).toBe(5787)
  })

  it('Vezot Haberachah syncs into last year\'s document while everything else uses this year', async () => {
    const cloud = makeCloud()
    cloud.seed('alice', 5786, 'vzot-haberachah', { '32:1': { hebrew1: true } })
    cloud.seed('alice', 5786, 'noach', { '5:0': T() }) // last year's noach: never applied
    const disk = makeDisk()
    mark(disk, 'vzot-haberachah', '32:0', 'hebrew1', true, VZOT_LAGS)
    mark(disk, 'noach', '5:8', 'hebrew1', true, VZOT_LAGS)
    expect(disk.cycles).toEqual({ 'vzot-haberachah': 5786, noach: 5787 })

    await sync(disk, cloud, 'alice', { yearOf: VZOT_LAGS })
    expect([...new Set(cloud.pulls.map(p => p.year))].sort()).toEqual([5786, 5787])
    expect(cloud.pushes.map(p => [p.route, p.year]).sort()).toEqual([['noach', 5787], ['vzot-haberachah', 5786]])
    expect(local(disk)['vzot-haberachah']['32:1'].hebrew1).toBe(true)
    expect(local(disk).noach['5:0']).toBeUndefined()
    expect(disk.base['vzot-haberachah'].year).toBe(5786)
  })

  it('a parsha that gets its first mark from the cloud is labelled with that year', async () => {
    const cloud = makeCloud()
    cloud.seed('alice', 5787, 'matot', { '29:1': { hebrew1: true } })
    const disk = makeDisk({ cycles: { matot: 5786, 'matot-masei': 5786 } })
    await sync(disk, cloud)
    expect(disk.cycles).toEqual({ matot: 5787, 'matot-masei': 5787 })
  })
})

describe('combined parshiyot', () => {
  it('marks under a combined route reach the singles\' documents; nothing is ever pushed for a combined route', async () => {
    const cloud = makeCloud()
    const a = makeDisk()
    mark(a, 'matot-masei', '29:1', 'hebrew1') // a verse of Matot
    mark(a, 'matot-masei', '32:0', 'targum') // a verse of Masei
    await sync(a, cloud)
    expect(cloud.doc('alice', 5787, 'matot')).toEqual({ '29:1': { hebrew1: true } })
    expect(cloud.doc('alice', 5787, 'masei')).toEqual({ '32:0': { targum: true } })

    const b = makeDisk()
    await sync(b, cloud)
    expect(local(b)['matot-masei']['29:1'].hebrew1).toBe(true)
    expect(local(b)['matot-masei']['32:0'].targum).toBe(true)

    startOver(b, 'matot-masei')
    await sync(b, cloud)
    await sync(a, cloud)
    expect(hasMarks(local(a)['matot-masei'])).toBe(false)
    expect(hasMarks(local(a).matot)).toBe(false)
    expect(cloud.doc('alice', 5787, 'matot')['29:1'].hebrew1).toBe(false)

    // A cloud document under a combined route is never applied either.
    cloud.seed('alice', 5787, 'matot-masei', { '29:2': T() })
    await sync(a, cloud)
    expect(local(a)['matot-masei']?.['29:2']).toBeUndefined()

    expect(cloud.pushes.length).toBeGreaterThan(0)
    expect(cloud.pushes.filter(p => p.route === 'matot-masei')).toEqual([])
    expect(Object.keys(a.base).concat(Object.keys(b.base)).includes('matot-masei')).toBe(false)
  })
})

describe('two interleaved rounds on one device', () => {
  it('a download that went stale during another round\'s upload cannot undo the mark', async () => {
    const cloud = makeCloud()
    cloud.seed('alice', 5787, 'noach', { '5:8': { hebrew1: false } }) // another device's earlier start over
    const disk = makeDisk({ sync: { owner: 'alice', lastPull: {} } })
    mark(disk, 'noach', '5:8', 'hebrew1')

    const pushGate = cloud.pause('push')
    const first = sync(disk, cloud)
    await pushGate.started // first round is uploading "true"
    const pullGate = cloud.pause('pull')
    const second = sync(disk, cloud)
    await pullGate.started // second round's download says "false"
    pushGate.release()
    await first // base now says true
    pullGate.release()
    await second

    expect(local(disk).noach['5:8'].hebrew1).toBe(true)
    expect(cloud.doc('alice', 5787, 'noach')['5:8'].hebrew1).toBe(true)
    await sync(disk, cloud)
    expect(local(disk).noach['5:8'].hebrew1).toBe(true)
    expect(disk.base.noach.verses).toEqual({ '5:8': { hebrew1: true } })
  })

  it('two rounds racing from the start converge without losing a mark', async () => {
    const { cloud, a, b } = await twoDevices()
    mark(a, 'noach', '5:9', 'hebrew1')
    mark(b, 'noach', '5:8', 'hebrew1', false)
    await sync(b, cloud)
    await Promise.all([sync(a, cloud), sync(a, cloud)])
    mark(a, 'noach', '6:0', 'targum')
    await Promise.all([sync(a, cloud), sync(a, cloud), sync(b, cloud)])
    await sync(b, cloud)
    await sync(a, cloud)
    const want = {
      '5:8': { hebrew1: false, hebrew2: true, targum: true },
      '5:9': { hebrew1: true, hebrew2: false, targum: false },
      '6:0': { hebrew1: false, hebrew2: false, targum: true }
    }
    expect(local(a).noach).toEqual(want)
    expect(local(b).noach).toEqual(want)
  })
})
