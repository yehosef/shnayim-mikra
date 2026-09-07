/**
 * Safe localStorage access + the shared persistence plumbing.
 *
 * Two reasons this exists:
 *
 * 1. `localStorage` is not always reachable. Chrome's "block all cookies",
 *    locked-down WebViews and some private modes make the property access or
 *    the call itself *throw* instead of returning null. An unguarded read at
 *    module scope then stops the whole app from mounting. Every accessor here
 *    degrades to an in-memory map so the session still works, unsaved.
 *
 * 2. Progress and settings need the same write plumbing: debounce, a flush on
 *    every way a page can go away (beforeunload alone does not fire on
 *    iOS/PWA termination), and a cross-tab merge so two open tabs do not
 *    clobber each other. That lives in `createPersister` / `onExternalWrite`.
 *
 * No Vue in here.
 */

const memory = new Map()
// Keys whose real backing store rejected a write; reads for them must come
// from `memory` or they would resurrect the stale on-disk value.
const memoryOnly = new Set()

function store() {
  try {
    return globalThis.localStorage || null
  } catch (e) {
    return null
  }
}

export function getItem(key) {
  if (!memoryOnly.has(key)) {
    const s = store()
    if (s) {
      try {
        return s.getItem(key)
      } catch (e) { /* fall through to the in-memory copy */ }
    }
  }
  return memory.has(key) ? memory.get(key) : null
}

export function setItem(key, value) {
  const s = store()
  if (s) {
    try {
      s.setItem(key, value)
      memoryOnly.delete(key)
      return true
    } catch (e) { /* quota, blocked storage — keep it for this session */ }
  }
  memoryOnly.add(key)
  memory.set(key, value)
  return false
}

export function removeItem(key) {
  const s = store()
  if (s) {
    try {
      s.removeItem(key)
    } catch (e) { /* nothing to do */ }
  }
  memory.delete(key)
  memoryOnly.delete(key)
}

/**
 * Run `fn` on every path by which this page can stop being visible.
 * beforeunload is not reliable on mobile Safari or a swiped-away PWA;
 * pagehide and visibilitychange === 'hidden' are.
 */
export function onHidden(fn) {
  const win = globalThis.window
  if (win && win.addEventListener) {
    win.addEventListener('beforeunload', fn)
    win.addEventListener('pagehide', fn)
  }
  const doc = globalThis.document
  if (doc && doc.addEventListener) {
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'hidden') fn()
    })
  }
}

/**
 * Run `fn` on every path by which this page becomes usable again after having
 * been hidden: a bfcache / frozen-tab restore (pageshow) and a plain return to
 * the foreground. A page that is frozen or in the back/forward cache does not
 * receive `storage` events and they are not replayed on restore, so without
 * this a resumed tab keeps a stale map forever.
 */
export function onVisible(fn) {
  const win = globalThis.window
  if (win && win.addEventListener) {
    win.addEventListener('pageshow', fn)
  }
  const doc = globalThis.document
  if (doc && doc.addEventListener) {
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'visible') fn()
    })
  }
}

/**
 * Call `fn(newValue)` when another tab writes `key`. `newValue` is the raw
 * string, or null when the key was removed or storage was cleared.
 */
export function onExternalWrite(key, fn) {
  const win = globalThis.window
  if (!win || !win.addEventListener) return
  win.addEventListener('storage', (e) => {
    // e.key === null means storage.clear() — that affects our key too.
    if (e.key !== null && e.key !== key) return
    fn(e.newValue)
  })
}

/**
 * Debounced writer for one key.
 *
 * `produce(rawOnDisk)` is called at write time — never at schedule time — and
 * returns the string to store (or null to skip). Giving it the current on-disk
 * value is what lets a caller merge in whatever another tab wrote since the
 * last flush. A write that would store exactly what is already on disk is
 * skipped, which is what keeps a value that came in from another tab from
 * bouncing straight back out through the caller's watcher.
 *
 * The debounce is a fixed window from the *first* pending change, not a timer
 * restarted by every change: a user marking verses steadily must not be able to
 * hold the write off indefinitely.
 */
export function createPersister(key, produce, delay = 300) {
  let timer = null

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    const current = getItem(key)
    const next = produce(current)
    if (next === null || next === undefined || next === current) return
    setItem(key, next)
  }

  const schedule = () => {
    if (timer !== null) return
    timer = setTimeout(flush, delay)
  }

  onHidden(flush)

  return { schedule, flush }
}
