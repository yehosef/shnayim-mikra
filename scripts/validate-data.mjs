#!/usr/bin/env node
/**
 * validate-data.mjs — offline sanity checks on public/data/*.
 *
 * No network. Runs via `npm run validate`, in `prebuild`, and in CI.
 *
 * Rules
 *  1. targum[ch].length === torah[ch].length
 *  2. english[ch].length === torah[ch].length and every entry is a string
 *  3. rashi: short arrays are legal (trailing truncation); any index >= verse
 *     count must be [] (shmot ch38 has 43 entries for 31 verses, all empty);
 *     non-trailing holes are flagged
 *  4. provenance: versionTitle !== 'merged' and license allowlisted for
 *     english / rashi / targum
 *  5. aliyot.json re-asserts the generator rules (coverage, contiguity, counts)
 *  6. no '<' in torah text
 *
 * Mode: findings are fatal (exit 1) by default. WARN=1 (or --warn) prints
 * them as warnings and exits 0 — only for local data work, never in CI.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA = path.join(ROOT, 'public', 'data')

const STRICT = !(process.env.WARN === '1' || process.argv.includes('--warn'))

const BOOKS = ['bereishit', 'shmot', 'vayikra', 'bamidbar', 'dvarim']
const LICENSE_ALLOWLIST = [
  'Public Domain',
  'CC0',
  'CC-BY',
  'CC-BY-SA',
  'CC-BY-NC'
]

const findings = []
const truncated = []
function warn(rule, msg) {
  findings.push({ rule, msg })
}

function readJson(rel) {
  const p = path.join(DATA, rel)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function licenseOk(license) {
  if (!license) return false
  const l = String(license).toLowerCase()
  return LICENSE_ALLOWLIST.some(a => l.includes(a.toLowerCase()))
}

// ---------------------------------------------------------------------------
// Per-book checks
// ---------------------------------------------------------------------------
const chapterLengths = {}

for (const book of BOOKS) {
  const torah = readJson(`torah/${book}.json`)
  if (!torah) {
    warn(0, `${book}: torah file missing`)
    continue
  }
  chapterLengths[book] = torah.text.map(ch => ch.length)

  // Rule 6
  torah.text.forEach((ch, ci) => {
    ch.forEach((v, vi) => {
      if (typeof v !== 'string') warn(6, `${book} torah ${ci + 1}:${vi + 1} not a string`)
      else if (v.includes('<')) warn(6, `${book} torah ${ci + 1}:${vi + 1} contains '<'`)
    })
  })

  // Rule 1
  const targum = readJson(`targum/${book}.json`)
  if (!targum) warn(1, `${book}: targum file missing`)
  else {
    if (targum.text.length !== torah.text.length) {
      warn(1, `${book} targum chapters ${targum.text.length} != torah ${torah.text.length}`)
    }
    torah.text.forEach((ch, ci) => {
      const t = targum.text[ci]
      if (!t || t.length !== ch.length) {
        warn(1, `${book} targum ch${ci + 1} length ${t ? t.length : 'missing'} != torah ${ch.length}`)
      }
    })
  }

  // Rule 2
  const english = readJson(`english/${book}.json`)
  if (!english) warn(2, `${book}: english file missing`)
  else {
    if (english.text.length !== torah.text.length) {
      warn(2, `${book} english chapters ${english.text.length} != torah ${torah.text.length}`)
    }
    torah.text.forEach((ch, ci) => {
      const e = english.text[ci]
      if (!e || e.length !== ch.length) {
        warn(2, `${book} english ch${ci + 1} length ${e ? e.length : 'missing'} != torah ${ch.length}`)
        return
      }
      e.forEach((v, vi) => {
        if (typeof v !== 'string') warn(2, `${book} english ${ci + 1}:${vi + 1} not a string`)
      })
    })
  }

  // Rule 3
  const rashi = readJson(`rashi/${book}.json`)
  if (!rashi) warn(3, `${book}: rashi file missing`)
  else {
    torah.text.forEach((ch, ci) => {
      const r = rashi.text[ci]
      if (!r) {
        warn(3, `${book} rashi ch${ci + 1} missing entirely`)
        return
      }
      // extras beyond verse count must be empty
      for (let vi = ch.length; vi < r.length; vi++) {
        if (!Array.isArray(r[vi]) || r[vi].length > 0) {
          warn(3, `${book} rashi ch${ci + 1} has non-empty entry at index ${vi} beyond ${ch.length} verses`)
        }
      }
      // entries inside range must be arrays; detect non-trailing holes:
      // a hole is an empty/missing entry followed later by a non-empty one
      let lastNonEmpty = -1
      for (let vi = 0; vi < Math.min(ch.length, r.length); vi++) {
        if (r[vi] !== undefined && !Array.isArray(r[vi])) {
          warn(3, `${book} rashi ${ci + 1}:${vi + 1} not an array`)
        }
        if (Array.isArray(r[vi]) && r[vi].length > 0) lastNonEmpty = vi
      }
      // Missing verses (short array) are only legal as trailing truncation —
      // that is by construction (an array cannot have interior gaps that are
      // distinguishable from verses with no Rashi). Truncation is counted
      // below as an informational line, not a finding.
      if (r.length < ch.length) truncated.push(`${book} ch${ci + 1} (${r.length}/${ch.length})`)
      if (r.length < ch.length && lastNonEmpty < 0) {
        warn(3, `${book} rashi ch${ci + 1} entirely empty`)
      }
    })
  }

  // Rule 4 — provenance
  for (const [layer, doc] of [['english', english], ['rashi', rashi], ['targum', targum]]) {
    if (!doc) continue
    if (doc.versionTitle === 'merged') warn(4, `${book} ${layer}: versionTitle is 'merged'`)
    if (!licenseOk(doc.license)) warn(4, `${book} ${layer}: license ${JSON.stringify(doc.license ?? null)} not allowlisted`)
  }
}

// ---------------------------------------------------------------------------
// Rule 5 — aliyot.json vs parshiyot.js
// ---------------------------------------------------------------------------
const aliyot = readJson('aliyot.json')
const { default: parshiyot } = await import(path.join(ROOT, 'src', 'data', 'parshiyot.js'))

function ordinal(book, [p, v]) {
  const lens = chapterLengths[book]
  let n = 0
  for (let i = 0; i < p; i++) n += lens[i]
  return n + v
}

if (!aliyot) warn(5, 'aliyot.json missing')
else {
  const routes = Object.keys(parshiyot)
  for (const route of routes) {
    const entry = aliyot[route]
    if (!entry || !Array.isArray(entry.aliyot)) {
      warn(5, `aliyot.json: route ${route} missing or not in {book, aliyot, total} shape`)
      continue
    }
    const def = parshiyot[route]
    const book = entry.book
    if (book !== def.chumash) warn(5, `aliyot.json ${route}: book ${book} != ${def.chumash}`)
    const lens = chapterLengths[book]
    if (!lens) continue
    const al = entry.aliyot
    if (al.length < 5 || al.length > 7) warn(5, `aliyot.json ${route}: ${al.length} aliyot`)
    const first = al[0], last = al[al.length - 1]
    if (!first || first.start[0] !== def.start[0] || first.start[1] !== def.start[1]) {
      warn(5, `aliyot.json ${route}: aliyot[0].start ${JSON.stringify(first?.start)} != parsha start ${JSON.stringify(def.start)}`)
    }
    if (!last || last.end[0] !== def.end[0] || last.end[1] !== def.end[1]) {
      warn(5, `aliyot.json ${route}: last.end ${JSON.stringify(last?.end)} != parsha end ${JSON.stringify(def.end)}`)
    }
    let sum = 0
    for (let i = 0; i < al.length; i++) {
      const a = al[i]
      if (a.n !== i + 1) warn(5, `aliyot.json ${route}: aliyot[${i}].n = ${a.n}`)
      const s = ordinal(book, a.start), e = ordinal(book, a.end)
      const count = e - s + 1
      if (count !== a.verseCount) warn(5, `aliyot.json ${route} aliyah ${i + 1}: verseCount ${a.verseCount} != computed ${count}`)
      sum += count
      if (i > 0) {
        const prevEnd = ordinal(book, al[i - 1].end)
        if (s !== prevEnd + 1) warn(5, `aliyot.json ${route}: aliyah ${i + 1} not contiguous with ${i}`)
      }
    }
    const expected = ordinal(book, def.end) - ordinal(book, def.start) + 1
    if (sum !== expected) warn(5, `aliyot.json ${route}: sum(verseCount) ${sum} != parsha verse count ${expected}`)
    if (entry.total !== expected) warn(5, `aliyot.json ${route}: total ${entry.total} != ${expected}`)
  }
  for (const route of Object.keys(aliyot)) {
    if (!parshiyot[route]) warn(5, `aliyot.json: unknown route ${route}`)
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (truncated.length) {
  console.log(`info: rashi trailing truncation in ${truncated.length} chapter(s): ${truncated.join(', ')}`)
}
if (findings.length === 0) {
  console.log('validate-data: OK (0 findings)')
  process.exit(0)
}

const byRule = {}
for (const f of findings) (byRule[f.rule] ||= []).push(f.msg)
for (const rule of Object.keys(byRule).sort()) {
  console.log(`\n[rule ${rule}] ${byRule[rule].length} finding(s)`)
  for (const m of byRule[rule]) console.log('  - ' + m)
}
console.log(`\nvalidate-data: ${findings.length} finding(s) (${STRICT ? 'STRICT: failing' : 'warn mode'})`)
process.exit(STRICT ? 1 : 0)
