import { reactive, watch } from 'vue'
import { getItem, setItem, removeItem, onHidden, onVisible } from '../lib/storage'
import {
  useProgress,
  flushProgress,
  applyProgressFields,
  replaceProgress,
  progressRawAtLoad
} from './useProgress'
import { useCycles } from './useCycles'
import { syncOnce, countPending, SYNC_KEY, BASE_KEY, ASIDE_KEY } from '../lib/syncStore'
import { normalizeSync } from '../lib/syncMerge'
import { CYCLES_KEY, ARCHIVE_KEY, parseObject } from '../lib/cycleStore'
import { isStandalone, isQuietSignInError } from '../lib/cloudDocs'

/**
 * Opt-in Google sign-in and cloud sync of reading marks. Thin wiring of
 * src/lib/syncStore.js (one sync round, pure apart from its io / cloud
 * objects) onto real storage, the progress singleton and the Firebase client.
 *
 * src/lib/firebaseClient.js is loaded with a dynamic import() only when
 * Settings opens (preload) or at startup when this device was signed in
 * before (startSync, flag below). Signed-out readers never run Firebase code,
 * and nothing in the app waits for or depends on any of this.
 *
 * A round runs right after sign-in, when the tab becomes visible, when the
 * connection returns, 30 s after the first change not yet uploaded (changes
 * inside that window ride along) and, best effort, when the page is hidden.
 * One round at a time per tab (a request during a round queues one more), and
 * one tab at a time where Web Locks exist.
 */

// Present while this device is signed in, so startup knows to load the client.
export const SYNC_ON_KEY = 'shnayim-sync-on'
export const UPLOAD_DELAY_MS = 30 * 1000
// Retry delay while another tab holds the sync lock.
const BUSY_RETRY_MS = 5 * 1000

const PROGRESS_KEY = 'shnayim-progress'

const { progress } = useProgress()
const { checkCycles, currentYearOf, bulkRevision } = useCycles()

/**
 * status: 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'
 * user: { name, email } | null; lastSyncedAt: millis | null;
 * pending: pieces not yet uploaded; ready: the client has loaded;
 * loadFailed: the client could not be loaded; signInError: Firebase error code
 */
const state = reactive({
  status: 'signed-out',
  user: null,
  lastSyncedAt: null,
  pending: 0,
  ready: false,
  loadFailed: false,
  signInError: null
})

let client = null
let clientPromise = null
let uid = null
let running = null
let again = false
let timer = null
let cyclesChecked = false
let stopWatch = null
let listening = false
// False until this tab's first round has started: until then the loss guard
// must see the stored progress as the page found it (see readProgressRaw in
// syncStore.js). After it has run once, the live value is the truth.
let guardRan = false

const readKey = (key) => parseObject(getItem(key))
const writeKey = (key, value) => setItem(key, JSON.stringify(value))

const io = {
  readProgressRaw: () => (guardRan ? getItem(PROGRESS_KEY) : progressRawAtLoad()),
  readProgress() {
    // Flushing folds in other tabs' writes and stores this tab's pending ones.
    flushProgress()
    return progress.value
  },
  applyFields: (writes) => applyProgressFields(writes),
  replaceProgress: (map) => replaceProgress(map),
  readCycles: () => readKey(CYCLES_KEY),
  writeCycles: (map) => writeKey(CYCLES_KEY, map),
  readSync: () => readKey(SYNC_KEY),
  writeSync: (meta) => writeKey(SYNC_KEY, meta),
  readBase: () => readKey(BASE_KEY),
  writeBase: (map) => writeKey(BASE_KEY, map),
  readAside: () => readKey(ASIDE_KEY),
  writeAside: (map) => writeKey(ASIDE_KEY, map),
  readArchive: () => readKey(ARCHIVE_KEY),
  writeArchive: (map) => writeKey(ARCHIVE_KEY, map)
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = null
}

function armTimer(delay = UPLOAD_DELAY_MS) {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    requestRound()
  }, delay)
}

function refreshPending() {
  if (!uid) {
    state.pending = 0
    return
  }
  const owner = normalizeSync(readKey(SYNC_KEY)).owner
  // Marks owned by another account are set aside on the next round, never
  // uploaded for this one.
  state.pending = owner !== null && owner !== uid
    ? 0
    : countPending(progress.value, readKey(BASE_KEY), readKey(CYCLES_KEY), currentYearOf)
}

function withLock(fn) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : null
  if (!locks || typeof locks.request !== 'function') return fn()
  // null: another tab is syncing. It uploads whatever is stored, this tab's
  // marks included.
  return locks.request('shnayim-sync', { ifAvailable: true }, (lock) => (lock ? fn() : null))
}

async function oneRound() {
  const roundUid = uid
  if (!roundUid || !client) return
  clearTimer()
  if (isOffline()) {
    state.status = 'offline'
    refreshPending()
    return
  }
  if (!cyclesChecked) {
    // The yearly move must run before the first round (idempotent).
    checkCycles()
    cyclesChecked = true
  }
  const ownerBefore = normalizeSync(readKey(SYNC_KEY)).owner
  // An account switch replaces local data: store marks still inside the save
  // delay first, so they are set aside with the account that made them.
  if (ownerBefore !== roundUid) flushProgress()
  state.status = 'syncing'
  let summary
  try {
    summary = await withLock(() => {
      const round = syncOnce(io, client.cloud, { uid: roundUid, currentYearOf })
      guardRan = true // the loss guard runs synchronously at the start of syncOnce
      return round
    })
  } catch (e) {
    console.error('Sync failed:', e)
    if (uid === roundUid) state.status = isOffline() ? 'offline' : 'error'
    return
  }
  const ownerAfter = normalizeSync(readKey(SYNC_KEY)).owner
  // Whole parshiyot may have changed: let the list view re-seed its selection.
  if (summary && (summary.applied > 0 || ownerAfter !== ownerBefore)) bulkRevision.value++
  if (uid !== roundUid) return
  refreshPending()
  if (summary === null) {
    if (state.pending > 0) armTimer(BUSY_RETRY_MS)
    else {
      state.status = 'synced'
      state.lastSyncedAt = Date.now()
    }
    return
  }
  if (summary.failed > 0) {
    state.status = isOffline() ? 'offline' : 'error'
    return
  }
  state.status = 'synced'
  state.lastSyncedAt = Date.now()
  // Changes made while this round was uploading.
  if (state.pending > 0) armTimer()
}

/** Run a round now, or once more after the one in progress. */
function requestRound() {
  if (!uid || !client) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        await oneRound()
      } while (again && uid)
    } finally {
      running = null
    }
  })()
  return running
}

function onProgressChange() {
  if (!uid) return
  refreshPending()
  if (state.pending > 0) armTimer()
}

function listen() {
  if (listening) return
  listening = true
  onVisible(() => { if (uid) requestRound() })
  onHidden(() => { if (uid && state.pending > 0) requestRound() })
  const win = globalThis.window
  if (win && win.addEventListener) {
    win.addEventListener('online', () => { if (uid) requestRound() })
    win.addEventListener('offline', () => { if (uid && state.status !== 'syncing') state.status = 'offline' })
  }
}

function handleUser(user) {
  const previous = uid
  uid = user ? user.uid : null
  if (!user) {
    clearTimer()
    if (stopWatch) stopWatch()
    stopWatch = null
    state.user = null
    state.status = 'signed-out'
    state.pending = 0
    state.lastSyncedAt = null
    removeItem(SYNC_ON_KEY)
    return
  }
  state.user = { name: user.name, email: user.email }
  state.signInError = null
  setItem(SYNC_ON_KEY, '1')
  // Watch marks only while signed in, so signed-out readers pay nothing.
  if (!stopWatch) stopWatch = watch(progress, onProgressChange, { deep: true })
  listen()
  refreshPending()
  if (previous !== uid) requestRound()
}

function loadClient() {
  if (!clientPromise) {
    clientPromise = import('../lib/firebaseClient.js').then(
      (mod) => {
        client = mod
        state.ready = true
        state.loadFailed = false
        mod.completeRedirect().catch((e) => {
          if (!isQuietSignInError(e?.code)) state.signInError = e?.code || 'unknown'
        })
        mod.onUser(handleUser)
        return mod
      },
      (e) => {
        console.warn('Could not load sign-in:', e)
        clientPromise = null
        state.loadFailed = true
        return null
      }
    )
  }
  return clientPromise
}

/** Load the sign-in client in the background (Settings calls this on open). */
export function preload() {
  return loadClient()
}

/** At startup: load the client only if this device was signed in before. */
export function startSync() {
  if (getItem(SYNC_ON_KEY)) loadClient()
}

/**
 * Start Google sign-in. Call straight from the click handler with nothing
 * awaited first, or Safari blocks the popup; the button stays disabled until
 * the client has loaded (state.ready) for the same reason.
 * @returns {Promise<boolean>} true once the sign-in finished (redirects leave the page)
 */
function signIn() {
  state.signInError = null
  if (!client) {
    loadClient()
    return Promise.resolve(false)
  }
  return client.signIn({ preferRedirect: isStandalone() }).then(
    () => true,
    (e) => {
      if (!isQuietSignInError(e?.code)) state.signInError = e?.code || String(e?.message || e)
      return false
    }
  )
}

/** Sign out. Local marks stay on the device. */
async function signOut() {
  if (!client) return
  clearTimer()
  try {
    await client.signOut()
  } catch (e) {
    console.error('Sign-out failed:', e)
  }
}

export function useSync() {
  return {
    sync: state,
    preload,
    signIn,
    signOut,
    retry: requestRound
  }
}
