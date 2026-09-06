#!/usr/bin/env node
/**
 * report-versions.mjs — list Sefaria versions (title, language, licence,
 * source, status) for every text layer this app ships, so licences can be
 * checked before fetching. Read-only; writes scripts/out/versions-*.json
 * (gitignored) and prints a summary table.
 *
 *   node scripts/report-versions.mjs            # all four layers, all five books
 *   node scripts/report-versions.mjs Genesis    # one index
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })

const BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']
const LAYERS = {
  torah: b => b,
  english: b => b,
  rashi: b => `Rashi_on_${b}`,
  targum: b => `Onkelos_${b}`
}

const UA = 'shnayim-mikra-build (https://github.com/yehosef/shnayim-mikra)'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    const ct = res.headers.get('content-type') || ''
    if (res.ok && ct.includes('json')) return res.json()
    const body = (await res.text()).slice(0, 200)
    if (i === tries) throw new Error(`${url}: HTTP ${res.status} ${ct} ${body}`)
    await sleep(500 * i)
  }
}

const only = process.argv[2]
const indexes = new Set()
for (const b of BOOKS) for (const fn of Object.values(LAYERS)) indexes.add(fn(b))

const rows = []
for (const index of only ? [only] : [...indexes]) {
  const url = `https://www.sefaria.org/api/v3/versions/${encodeURIComponent(index)}`
  let versions
  try {
    versions = await getJson(url)
  } catch (e) {
    console.error(`FAIL ${index}: ${e.message}`)
    continue
  }
  fs.writeFileSync(path.join(OUT, `versions-${index}.json`), JSON.stringify(versions, null, 2))
  for (const v of versions) {
    rows.push({
      index,
      language: v.language,
      versionTitle: v.versionTitle,
      license: v.license || '',
      status: v.status || '',
      priority: v.priority ?? '',
      versionSource: v.versionSource || ''
    })
  }
  await sleep(250)
}

// Summary: english + hebrew commentary/targum only
const interesting = rows.filter(r => r.language === 'en' || !/^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)$/.test(r.index))
for (const r of interesting) {
  console.log([r.index, r.language, r.license || '(none)', r.status, r.priority, r.versionTitle].join(' | '))
}
console.log(`\n${rows.length} versions across ${only ? 1 : indexes.size} indexes -> ${OUT}`)
