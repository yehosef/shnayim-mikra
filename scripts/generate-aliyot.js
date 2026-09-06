#!/usr/bin/env node

/**
 * Generate aliyot (Torah reading portion) boundaries.
 *
 * Source of truth for aliyah boundaries is @hebcal/leyning's
 * `getLeyningForParsha` (never `getLeyningForParshaHaShavua`, which applies
 * date-specific overlays). For each route in src/data/parshiyot.js we read
 * `fullkriyah` keys '1'..'7' (and 'M' when present) and fold the maftir
 * reading into aliyah 7.
 *
 * Output: public/data/aliyot.json
 *   {
 *     [route]: {
 *       book: 'bereishit',
 *       aliyot: [ { n: 1, start: [perek, pasuk], end: [perek, pasuk], verseCount }, ... ],
 *       total: number
 *     },
 *     ...
 *   }
 * perek/pasuk are 0-indexed. Chapter lengths (needed to convert positions to
 * a linear ordinal for contiguity/verse-count checks against the stored
 * corpus) come from the actual public/data/torah/*.json files, not a
 * hardcoded table.
 *
 * Known versification variants (corpus vs. hebcal's Masoretic NUM_VERSES):
 *  - Numbers 25/26: hebcal counts "vayehi acharei hamagefah" as its own
 *    verse 25:19 (so hebcal ch25 = 19 verses); the corpus (Sefaria) merges
 *    it into chapter 26 verse 1 instead (corpus ch25 = 18 verses). Both
 *    agree chapter 26 has 65 verses, so every hebcal chapter:verse boundary
 *    still maps 1:1 onto the corpus EXCEPT a reference to 25:19 itself —
 *    and no aliyah/maftir boundary in the whole leyning cycle lands there.
 *  - Exodus 20 (Aseret HaDibrot): hebcal counts 26 verses in ch20 (each
 *    "lo ..." commandment split out), the corpus counts 23 (combined). No
 *    aliyah boundary in Yitro/Mishpatim references past corpus verse 23,
 *    so this never surfaces either.
 * Because of these variants we cannot use the corpus's own chapter lengths
 * to sanity-check hebcal's reported `v` (verse count) for an aliyah — a
 * boundary that is legitimately positioned relative to hebcal's own
 * versification can look "wrong" against the corpus's shorter chapter. So
 * the `v` check below is done in hebcal's own versification (NUM_VERSES),
 * proving only that our chapter:verse *parsing* of `b`/`e` is internally
 * consistent with hebcal's `v` — not that it matches the corpus. Every
 * corpus-relative assertion (start/end vs. def, contiguity, verse totals)
 * still uses the corpus's own chapter lengths, and every converted boundary
 * is additionally checked to actually exist in the corpus.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getLeyningForParsha, NUM_VERSES } from '@hebcal/leyning'

import parshiyot from '../src/data/parshiyot.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

const BOOKS = ['bereishit', 'shmot', 'vayikra', 'bamidbar', 'dvarim']

const BOOK_MAP = {
  Genesis: 'bereishit',
  Exodus: 'shmot',
  Leviticus: 'vayikra',
  Numbers: 'bamidbar',
  Deuteronomy: 'dvarim'
}

function fail(route, message) {
  console.error(`✗ ${route}: ${message}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Chapter lengths, straight from the corpus.
// ---------------------------------------------------------------------------
const chapterLengths = {}
for (const book of BOOKS) {
  const file = path.join(ROOT, 'public', 'data', 'torah', `${book}.json`)
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  chapterLengths[book] = data.text.map(ch => ch.length)
}

function ordinal(book, [perek, pasuk]) {
  const lens = chapterLengths[book]
  let n = 0
  for (let i = 0; i < perek; i++) n += lens[i]
  return n + pasuk
}

// hebcal's own chapter lengths (its NUM_VERSES tables are 1-indexed with a
// leading dummy 0 at index 0), used only to sanity-check hebcal's reported
// `v` against our parsing of `b`/`e` — see versification note above.
const hebcalChapterLengths = {}
for (const [hebcalName, book] of Object.entries(BOOK_MAP)) {
  const table = NUM_VERSES[hebcalName]
  hebcalChapterLengths[book] = table.slice(1)
}

function hebcalOrdinal(book, [perek, pasuk]) {
  const lens = hebcalChapterLengths[book]
  let n = 0
  for (let i = 0; i < perek; i++) n += lens[i]
  return n + pasuk
}

// Parse hebcal's 1-indexed "chapter:verse" into a 0-indexed [perek, pasuk].
function parseRef(ref) {
  const [chapter, verse] = ref.split(':').map(Number)
  return [chapter - 1, verse - 1]
}

// A hebcal boundary must actually exist in the corpus (guards against the
// versification variants above ever silently producing a bogus position).
function assertInCorpus(route, label, book, [perek, pasuk]) {
  const lens = chapterLengths[book]
  if (perek < 0 || perek >= lens.length || pasuk < 0 || pasuk >= lens[perek]) {
    fail(route, `${label} [${perek},${pasuk}] does not exist in corpus book ${book} (chapter has ${lens[perek]} verses)`)
  }
}

// ---------------------------------------------------------------------------
// Per-route generation.
// ---------------------------------------------------------------------------
const routes = Object.keys(parshiyot)
const output = {}

for (const route of routes) {
  const def = parshiyot[route]
  const leyning = getLeyningForParsha(def.hebcalName)
  const fk = leyning.fullkriyah

  const aliyot = []
  let book = null

  for (let n = 1; n <= 7; n++) {
    const part = fk[String(n)]
    if (!part) fail(route, `missing fullkriyah aliyah ${n}`)

    const partBook = BOOK_MAP[part.k]
    if (!partBook) fail(route, `unknown leyning book "${part.k}" for aliyah ${n}`)
    if (book === null) book = partBook
    else if (partBook !== book) fail(route, `aliyah ${n} book ${partBook} != aliyah 1 book ${book}`)

    const start = parseRef(part.b)
    const end = parseRef(part.e)

    // Check hebcal's `v` against hebcal's own versification (proves our
    // b/e parsing is right), not against the corpus (see note above).
    const hebcalCount = hebcalOrdinal(partBook, end) - hebcalOrdinal(partBook, start) + 1
    if (hebcalCount !== part.v) {
      fail(route, `aliyah ${n}: leyning v=${part.v} != hebcal-versification computed ${hebcalCount} (b=${part.b}, e=${part.e})`)
    }

    assertInCorpus(route, `aliyah ${n} start`, partBook, start)
    assertInCorpus(route, `aliyah ${n} end`, partBook, end)

    let finalEnd = end
    if (n === 7 && fk.M) {
      const maftirBook = BOOK_MAP[fk.M.k]
      if (!maftirBook) fail(route, `unknown leyning book "${fk.M.k}" for maftir`)
      if (maftirBook !== book) fail(route, `maftir book ${maftirBook} != aliyah 7 book ${book}`)
      const maftirEnd = parseRef(fk.M.e)
      assertInCorpus(route, 'maftir end', maftirBook, maftirEnd)
      finalEnd = ordinal(book, maftirEnd) > ordinal(book, end) ? maftirEnd : end
    }

    const verseCount = ordinal(partBook, finalEnd) - ordinal(partBook, start) + 1
    aliyot.push({ n, start, end: finalEnd, verseCount })
  }

  if (book !== def.chumash) {
    fail(route, `book from leyning (${book}) != def.chumash (${def.chumash})`)
  }

  const first = aliyot[0]
  const last = aliyot[aliyot.length - 1]

  if (first.start[0] !== def.start[0] || first.start[1] !== def.start[1]) {
    fail(route, `aliyot[0].start ${JSON.stringify(first.start)} != def.start ${JSON.stringify(def.start)}`)
  }
  if (last.end[0] !== def.end[0] || last.end[1] !== def.end[1]) {
    fail(route, `last.end ${JSON.stringify(last.end)} != def.end ${JSON.stringify(def.end)}`)
  }

  for (let i = 1; i < aliyot.length; i++) {
    const prevEnd = ordinal(book, aliyot[i - 1].end)
    const start = ordinal(book, aliyot[i].start)
    if (start !== prevEnd + 1) {
      fail(
        route,
        `aliyah ${i + 1} not contiguous with aliyah ${i}: aliyah ${i} end ordinal ${prevEnd}, aliyah ${i + 1} start ordinal ${start}`
      )
    }
  }

  const total = aliyot.reduce((sum, a) => sum + a.verseCount, 0)
  const expectedTotal = ordinal(book, def.end) - ordinal(book, def.start) + 1
  if (total !== expectedTotal) {
    fail(route, `sum(verseCount) ${total} != corpus verse count ${expectedTotal} (def.start=${JSON.stringify(def.start)}, def.end=${JSON.stringify(def.end)})`)
  }

  output[route] = { book, aliyot, total }
  console.log(`${route}: ${aliyot.length} aliyot, ${total} verses`)
}

if (routes.length < 61) {
  fail('generate-aliyot', `only ${routes.length} routes processed, expected at least 61`)
}

const outputFile = path.join(ROOT, 'public', 'data', 'aliyot.json')
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2) + '\n')

console.log(`\nOK: generated ${routes.length} routes -> ${path.relative(ROOT, outputFile)}`)
