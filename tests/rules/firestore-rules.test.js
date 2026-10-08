/**
 * firestore.rules against the emulator: a signed-in reader can read and write
 * only their own parsha documents, in the exact shape the app writes
 * ({ verses, updatedAt = server time }), and nothing else anywhere.
 * Run with `npm run test:rules` (needs Java and the Firebase CLI).
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  query,
  where
} from 'firebase/firestore'
import { singleRoutes } from '../../src/lib/syncMerge.js'
import { parshaDocPath, pushData } from '../../src/lib/cloudDocs.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8')

let env
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-shnayim', firestore: { rules } })
})
afterAll(async () => { await env?.cleanup() })
beforeEach(async () => { await env.clearFirestore() })

const alice = () => env.authenticatedContext('alice').firestore()
const bob = () => env.authenticatedContext('bob').firestore()
const anon = () => env.unauthenticatedContext().firestore()

const ref = (db, uid = 'alice', year = 5787, route = 'noach') => doc(db, ...parshaDocPath(uid, year, route))
// Exactly what firebaseClient.cloud.push sends.
const push = (db, patch, at = ref(db)) => setDoc(at, pushData(patch, serverTimestamp()), { merge: true })

/** alice's noach document, written past the rules. */
async function seed(data = { verses: { '5:8': { hebrew1: true } }, updatedAt: Timestamp.fromMillis(1_800_000_000_000) }) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(ref(ctx.firestore()), data)
  })
}

describe('the owner', () => {
  it('creates their parsha document with a server timestamp', async () => {
    await assertSucceeds(push(alice(), { '5:8': { hebrew1: true } }))
  })

  it('merge-updates it field by field and reads it back', async () => {
    await assertSucceeds(push(alice(), { '5:8': { hebrew1: true } }))
    await assertSucceeds(push(alice(), { '5:8': { targum: true }, '5:9': { hebrew2: false } }))
    const snap = await assertSucceeds(getDoc(ref(alice())))
    const verses = snap.data().verses
    if (verses['5:8'].hebrew1 !== true || verses['5:8'].targum !== true || verses['5:9'].hebrew2 !== false) {
      throw new Error('merge lost a field: ' + JSON.stringify(verses))
    }
  })

  it('lists the year with and without the updatedAt filter the app uses', async () => {
    await seed()
    const col = collection(alice(), 'users', 'alice', 'years', '5787', 'parshiyot')
    await assertSucceeds(getDocs(col))
    await assertSucceeds(getDocs(query(col, where('updatedAt', '>', Timestamp.fromMillis(1_700_000_000_000)))))
  })

  it('writes every real single parsha route and a 300-verse document', async () => {
    for (const route of singleRoutes()) {
      await assertSucceeds(push(alice(), { '0:0': { hebrew1: true } }, ref(alice(), 'alice', 5787, route)))
    }
    const big = {}
    for (let i = 0; i < 300; i++) big[`0:${i}`] = { hebrew1: true }
    await assertSucceeds(push(alice(), big))
  })
})

describe('everyone else', () => {
  it('another signed-in user can neither read nor write', async () => {
    await seed()
    await assertFails(getDoc(ref(bob())))
    await assertFails(getDocs(collection(bob(), 'users', 'alice', 'years', '5787', 'parshiyot')))
    await assertFails(push(bob(), { '5:8': { hebrew1: false } }, ref(bob())))
    await assertFails(push(bob(), { '5:8': { hebrew1: true } }, ref(bob(), 'alice', 5787, 'bereshit')))
  })

  it('a signed-out user can neither read nor write', async () => {
    await seed()
    await assertFails(getDoc(ref(anon())))
    await assertFails(push(anon(), { '5:8': { hebrew1: true } }, ref(anon())))
  })
})

describe('the shape is enforced', () => {
  it('rejects a client-chosen updatedAt', async () => {
    await assertFails(setDoc(ref(alice()), { verses: {}, updatedAt: Timestamp.fromMillis(Date.now()) }, { merge: true }))
    await assertFails(setDoc(ref(alice()), { verses: {} }, { merge: true }))
    // An update must stamp server time too, not keep the old stamp.
    await seed()
    await assertFails(updateDoc(ref(alice()), { 'verses.5:9': { hebrew1: true } }))
  })

  it('rejects extra fields', async () => {
    await assertFails(setDoc(ref(alice()), { verses: {}, updatedAt: serverTimestamp(), owner: 'alice' }, { merge: true }))
  })

  it('rejects verses that are not a map', async () => {
    await assertFails(setDoc(ref(alice()), { verses: 'all', updatedAt: serverTimestamp() }, { merge: true }))
  })

  it('rejects more than 300 verses, including by merging into an existing document', async () => {
    const big = {}
    for (let i = 0; i < 301; i++) big[`0:${i}`] = { hebrew1: true }
    await assertFails(push(alice(), big))
    const full = {}
    for (let i = 0; i < 300; i++) full[`0:${i}`] = { hebrew1: true }
    await assertSucceeds(push(alice(), full))
    await assertFails(push(alice(), { '1:0': { hebrew1: true } }))
  })

  it('rejects a bad year or route id', async () => {
    for (const year of ['787', '15787', '6000', 'abcd', '5787x']) {
      await assertFails(push(alice(), { '0:0': { hebrew1: true } }, ref(alice(), 'alice', year)))
    }
    for (const route of ['Noach', '1noach', 'n', 'noach_2', 'a'.repeat(41), 'noach.']) {
      await assertFails(push(alice(), { '0:0': { hebrew1: true } }, ref(alice(), 'alice', 5787, route)))
    }
  })
})

describe('everything else is denied', () => {
  it('delete is denied, even to the owner', async () => {
    await seed()
    await assertFails(deleteDoc(ref(alice())))
  })

  it('any other path is denied', async () => {
    const db = alice()
    await assertFails(setDoc(doc(db, 'users', 'alice'), { name: 'x' }))
    await assertFails(getDoc(doc(db, 'users', 'alice')))
    await assertFails(setDoc(doc(db, 'users', 'alice', 'years', '5787'), { x: 1 }))
    await assertFails(setDoc(doc(db, 'users', 'alice', 'years', '5787', 'other', 'noach'), pushData({}, serverTimestamp())))
    await assertFails(setDoc(doc(db, 'users', 'alice', 'years', '5787', 'parshiyot', 'noach', 'more', 'x'), pushData({}, serverTimestamp())))
    await assertFails(getDoc(doc(db, 'settings', 'global')))
    await assertFails(setDoc(doc(db, 'settings', 'global'), { x: 1 }))
  })
})
