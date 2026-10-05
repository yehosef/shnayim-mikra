/**
 * The pure decisions behind src/lib/firebaseClient.js, kept apart so they are
 * testable in node without Firebase:
 *  - where a parsha's cloud document lives and what a push writes into it
 *  - how downloaded documents become syncStore's `pull` answer
 *  - which auth domain to use and which sign-in method to try first
 *
 * Cloud document: users/{uid}/years/{hebrewYear}/parshiyot/{route}
 *   { verses: { "perek:pasuk": { hebrew1?, hebrew2?, targum? } }, updatedAt }
 * (`updatedAt` is always the server's time; firestore.rules enforces it.)
 *
 * No Firebase, no Vue, no browser globals unless passed in.
 */

/** The address that serves the app on Firebase Hosting (site `shnayim`). */
export const FIREBASE_HOST = 'shnayim.web.app'

const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x)

/** Path segments of the year's parshiyot collection. */
export function parshiyotPath(uid, year) {
  return ['users', uid, 'years', String(year), 'parshiyot']
}

/** Path segments of one parsha's document. */
export function parshaDocPath(uid, year, route) {
  return [...parshiyotPath(uid, year), route]
}

/**
 * The data a push writes as a field-level merge (`setDoc(..., { merge: true })`):
 * only the changed pieces, plus the server-time stamp the caller supplies
 * (`serverTimestamp()`), never a whole document.
 */
export function pushData(patch, stamp) {
  return { verses: isObject(patch) ? patch : {}, updatedAt: stamp }
}

/**
 * `since` for a pull: null downloads everything; otherwise documents with
 * `updatedAt` after `since` (server millis). syncStore already subtracts an
 * overlap, so ">" versus ">=" cannot lose a document.
 */
export function pullCutoff(since) {
  return Number.isFinite(since) ? since : null
}

/** A Firestore Timestamp (or anything with toMillis) as millis, else null. */
export function toMillis(t) {
  if (t && typeof t.toMillis === 'function') {
    const ms = t.toMillis()
    return Number.isFinite(ms) ? ms : null
  }
  return Number.isFinite(t) ? t : null
}

/**
 * Downloaded documents as syncStore's pull answer.
 * @param {Array<{ id: string, data: Object }>} snapshots
 * @returns {{ docs: { [route]: { verses: Object, updatedAt: number | null } } }}
 */
export function docsFromSnapshots(snapshots) {
  const docs = {}
  for (const { id, data } of snapshots || []) {
    if (typeof id !== 'string' || !id) continue
    const d = isObject(data) ? data : {}
    docs[id] = { verses: isObject(d.verses) ? d.verses : {}, updatedAt: toMillis(d.updatedAt) }
  }
  return { docs }
}

/**
 * The auth domain for this page. On the Firebase Hosting address the sign-in
 * helper pages (/__/auth/...) are same-origin, which redirect sign-in needs in
 * browsers that partition third-party storage; anywhere else, the project's
 * default domain.
 */
export function authDomainFor(hostname, fallback) {
  return hostname === FIREBASE_HOST ? FIREBASE_HOST : fallback
}

/** Is the app running installed (home-screen / standalone window)? */
export function isStandalone(win = globalThis.window) {
  try {
    if (win?.navigator?.standalone === true) return true
    return !!win?.matchMedia?.('(display-mode: standalone)')?.matches
  } catch (e) {
    return false
  }
}

/**
 * Sign-in methods in the order to try. Popup first everywhere (it keeps the
 * page and its state); redirect first only for the installed app on the
 * Firebase Hosting address, where popups tend to open outside the app and the
 * redirect helper pages are same-origin.
 * @returns {Array<'popup' | 'redirect'>}
 */
export function signInOrder({ preferRedirect, hostname }) {
  return preferRedirect && hostname === FIREBASE_HOST ? ['redirect', 'popup'] : ['popup', 'redirect']
}

// Errors meaning "this method cannot work here", so the other one is tried.
const FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported'
])

/** Should a sign-in that failed with `code` be retried with the other method? */
export function shouldTryOtherMethod(code) {
  return FALLBACK_CODES.has(code)
}

// The reader closed or replaced the popup: not an error worth showing.
const QUIET_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'])

/** Is `code` a sign-in the reader abandoned rather than a failure? */
export function isQuietSignInError(code) {
  return QUIET_CODES.has(code)
}
