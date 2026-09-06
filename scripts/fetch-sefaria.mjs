#!/usr/bin/env node
/**
 * fetch-sefaria.mjs — rebuild public/data/english/*.json and
 * public/data/rashi/*.json from Sefaria with an explicit, licence-checked
 * version (never `merged`).
 *
 *   node scripts/fetch-sefaria.mjs            # english + rashi, all books
 *   node scripts/fetch-sefaria.mjs english    # one layer
 *   node scripts/fetch-sefaria.mjs rashi Deuteronomy
 *
 * Output JSON keeps the shape the app reads ({ text: string[][] } for
 * english, { text: string[][][] } for rashi) and adds provenance:
 * license, versionTitle, versionSource, fetchedAt.
 *
 * Network: 250ms spacing, 3 retries, User-Agent shnayim-mikra-build,
 * response cache in scripts/.cache/ (gitignored) so re-runs are free.
 *
 * Licence gate: the chosen version's licence must be in ALLOWLIST or the
 * script exits 1 without writing anything.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA = path.join(ROOT, 'public', 'data')
const CACHE = path.join(__dirname, '.cache')
fs.mkdirSync(CACHE, { recursive: true })

const BOOKS = [
  { en: 'Genesis', file: 'bereishit' },
  { en: 'Exodus', file: 'shmot' },
  { en: 'Leviticus', file: 'vayikra' },
  { en: 'Numbers', file: 'bamidbar' },
  { en: 'Deuteronomy', file: 'dvarim' }
]

const ALLOWLIST = ['Public Domain', 'CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-NC']

// Preference chains, first available + allowlisted wins.
const ENGLISH_CHAIN = [
  'The Contemporary Torah, Jewish Publication Society, 2006',
  'Sefaria Community Translation'
]
const RASHI_CHAIN = [
  'Rashi Chumash, Metsudah Publications, 2009'
]

const UA = 'shnayim-mikra-build (https://github.com/yehosef/shnayim-mikra)'
const sleep = ms => new Promise(r => setTimeout(r, ms))

function licenseOk(license) {
  if (!license) return false
  const l = String(license).toLowerCase()
  return ALLOWLIST.some(a => l.includes(a.toLowerCase()))
}

async function getJson(url, tries = 3) {
  const key = Buffer.from(url).toString('base64url')
  const cached = path.join(CACHE, key + '.json')
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf8'))
  for (let i = 1; i <= tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    const ct = res.headers.get('content-type') || ''
    if (res.ok && ct.includes('json')) {
      const json = await res.json()
      fs.writeFileSync(cached, JSON.stringify(json))
      await sleep(250)
      return json
    }
    const body = (await res.text()).slice(0, 200)
    if (i === tries) throw new Error(`${url}: HTTP ${res.status} ${ct} ${body}`)
    await sleep(500 * i)
  }
}

async function chooseVersion(index, lang, chain) {
  const versions = await getJson(`https://www.sefaria.org/api/v3/versions/${encodeURIComponent(index)}`)
  for (const title of chain) {
    const v = versions.find(x => x.language === lang && x.versionTitle === title)
    if (!v) continue
    if (!licenseOk(v.license)) {
      console.error(`  ${index}: "${title}" licence "${v.license}" not allowlisted — skipping`)
      continue
    }
    return v
  }
  return null
}

function chapterCount(file) {
  const torah = JSON.parse(fs.readFileSync(path.join(DATA, 'torah', `${file}.json`), 'utf8'))
  return torah.text.length
}

async function fetchLayer(layer, books) {
  const isRashi = layer === 'rashi'
  const lang = isRashi ? 'hebrew' : 'english'
  const chain = isRashi ? RASHI_CHAIN : ENGLISH_CHAIN
  const fmt = isRashi ? 'text_only' : 'strip_only_footnotes'

  for (const book of books) {
    const index = isRashi ? `Rashi on ${book.en}` : book.en
    console.log(`${layer}/${book.file} <- ${index}`)
    const version = await chooseVersion(index, lang, chain)
    if (!version) {
      console.error(`FAIL ${index}: no allowlisted version in chain [${chain.join(' | ')}]`)
      console.error('QUESTION FOR USER: which version should be used, or should this layer ship without it?')
      process.exit(1)
    }
    console.log(`  using "${version.versionTitle}" (${version.license})`)

    const chapters = chapterCount(book.file)
    const text = []
    for (let ch = 1; ch <= chapters; ch++) {
      const ref = `${index} ${ch}`
      const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=${lang}|${encodeURIComponent(version.versionTitle)}&return_format=${fmt}`
      const json = await getJson(url)
      const v = json.versions?.[0]
      if (!v) throw new Error(`${ref}: no versions in response`)
      if (v.versionTitle !== version.versionTitle) {
        throw new Error(`${ref}: got "${v.versionTitle}", requested "${version.versionTitle}"`)
      }
      // english: text[verse] string; rashi: text[verse] string[] (comments)
      let chapterText = v.text
      if (isRashi) {
        chapterText = chapterText.map(entry => (Array.isArray(entry) ? entry : entry ? [entry] : []))
      } else {
        chapterText = chapterText.map(entry => (typeof entry === 'string' ? entry : Array.isArray(entry) ? entry.join(' ') : ''))
      }
      text.push(chapterText)
      process.stdout.write(`  ch ${ch}/${chapters}\r`)
    }
    process.stdout.write('\n')

    const out = {
      title: index,
      heTitle: json0(version),
      language: lang === 'hebrew' ? 'he' : 'en',
      versionTitle: version.versionTitle,
      versionSource: version.versionSource || '',
      license: version.license || '',
      fetchedAt: new Date().toISOString(),
      sectionNames: ['Chapter', 'Verse'],
      text
    }
    const target = path.join(DATA, layer, `${book.file}.json`)
    fs.writeFileSync(target, JSON.stringify(out) + '\n')
    console.log(`  wrote ${path.relative(ROOT, target)} (${chapters} chapters)`)
  }
}

function json0(version) {
  return version.versionTitleInHebrew || ''
}

const [, , layerArg, bookArg] = process.argv
const layers = layerArg ? [layerArg] : ['english', 'rashi']
const books = bookArg ? BOOKS.filter(b => b.en === bookArg) : BOOKS
if (books.length === 0) {
  console.error(`unknown book ${bookArg}; expected one of ${BOOKS.map(b => b.en).join(', ')}`)
  process.exit(1)
}
for (const layer of layers) {
  if (!['english', 'rashi'].includes(layer)) {
    console.error(`unknown layer ${layer}; expected english | rashi`)
    process.exit(1)
  }
  await fetchLayer(layer, books)
}
console.log('\nDone. Now run: npm run validate')
