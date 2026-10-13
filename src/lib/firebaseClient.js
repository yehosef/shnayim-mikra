/**
 * The only file that imports Firebase. Loaded with a dynamic import() by
 * src/composables/useSync.js — only when Settings opens or when this device
 * was signed in before — so signed-out readers never download or run it.
 *
 * Auth: Google only, persisted in IndexedDB. Firestore: the lightweight client
 * (no realtime listeners, no offline cache — localStorage is the app's store).
 * `cloud` implements the pull / push interface documented in syncStore.js.
 */
import { initializeApp } from 'firebase/app'
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore/lite'
import { firebaseConfig } from './firebaseConfig.js'
import {
  authDomainFor,
  parshaDocPath,
  parshiyotPath,
  pushData,
  pullCutoff,
  docsFromSnapshots,
  signInOrder,
  shouldTryOtherMethod
} from './cloudDocs.js'

const hostname = globalThis.location?.hostname || ''

const app = initializeApp({ ...firebaseConfig, authDomain: authDomainFor(hostname, firebaseConfig.authDomain) })
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
})
const db = getFirestore(app)

// Set just before leaving for a redirect sign-in, so the return trip knows to
// collect its result (and its error) without paying for that on every load.
const REDIRECT_FLAG = 'shnayim-sync-redirect'

function session() {
  try {
    return globalThis.sessionStorage || null
  } catch (e) {
    return null
  }
}

function provider() {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}

function start(method) {
  if (method === 'popup') return signInWithPopup(auth, provider())
  try {
    session()?.setItem(REDIRECT_FLAG, '1')
  } catch (e) { /* storage blocked: the auth state listener still sees the user */ }
  return signInWithRedirect(auth, provider())
}

/**
 * Calls `cb({ uid, name, email } | null)` now and on every sign-in / sign-out.
 * @returns {() => void} unsubscribe
 */
export function onUser(cb) {
  return onAuthStateChanged(auth, (user) => {
    cb(user ? { uid: user.uid, name: user.displayName || '', email: user.email || '' } : null)
  })
}

/**
 * Start Google sign-in. Must be called straight from the click handler: the
 * first method starts synchronously (no await before it), or Safari blocks the
 * popup. If that method cannot work here, the other one is tried.
 * @returns {Promise<void>} settles when the popup closes (a redirect leaves the page)
 */
export function signIn({ preferRedirect = false } = {}) {
  const [first, second] = signInOrder({ preferRedirect, hostname })
  const attempt = start(first)
  return attempt.then(
    () => {},
    (e) => {
      if (!shouldTryOtherMethod(e?.code)) throw e
      return start(second).then(() => {})
    }
  )
}

/** After returning from a redirect sign-in: surface its error, if any. */
export async function completeRedirect() {
  const s = session()
  if (!s?.getItem(REDIRECT_FLAG)) return
  try {
    s.removeItem(REDIRECT_FLAG)
  } catch (e) { /* nothing to do */ }
  await getRedirectResult(auth)
}

export function signOut() {
  return firebaseSignOut(auth)
}

export const cloud = {
  async pull(uid, year, since) {
    const col = collection(db, ...parshiyotPath(uid, year))
    const cutoff = pullCutoff(since)
    const q = cutoff === null ? col : query(col, where('updatedAt', '>', Timestamp.fromMillis(cutoff)))
    const snap = await getDocs(q)
    return docsFromSnapshots(snap.docs.map((d) => ({ id: d.id, data: d.data() })))
  },
  async push(uid, year, route, patch) {
    await setDoc(doc(db, ...parshaDocPath(uid, year, route)), pushData(patch, serverTimestamp()), { merge: true })
  }
}
