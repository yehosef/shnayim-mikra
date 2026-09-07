#!/usr/bin/env node
/**
 * check-styles.mjs — enforce the style contract from CLAUDE.md on src/:
 *   - no `!important`
 *   - no `line-through` (completed text is never struck out)
 *   - no `opacity` on text (a per-line escape: `/* allow-opacity: <reason> *\/`
 *     on the same line or the line above)
 * Read / pointer / in-scope state must be expressed through borders,
 * backgrounds, and markers — never by dimming or crossing out the text.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(vue|css)$/.test(e.name)) out.push(p)
  }
  return out
}

const problems = []
for (const file of walk(SRC)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const rel = path.relative(ROOT, file) + ':' + (i + 1)
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (/!important/.test(line)) problems.push(`${rel}: !important`)
    if (/line-through/.test(line)) problems.push(`${rel}: line-through`)
    if (/opacity\s*:/.test(line) || /filter:\s*[^;]*opacity\(/.test(line)) {
      const prev = lines[i - 1] || ''
      if (!/allow-opacity:/.test(line) && !/allow-opacity:/.test(prev)) {
        problems.push(`${rel}: opacity without /* allow-opacity: reason */`)
      }
    }
  })
}

if (problems.length) {
  console.error('check-styles: ' + problems.length + ' problem(s)')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('check-styles: OK')
