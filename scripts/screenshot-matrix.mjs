// Screenshot + metrics harness for the dev server (default port 5199, override with PORT=).
// Copied from the 2026-10-06 UX review session; requires a global Playwright install
// (/opt/homebrew/lib/node_modules/playwright) and its cached Chromium. Output: ./shots next to this file.
// Usage: node scripts/screenshot-matrix.mjs '<json spec>'   or   node shot.mjs specs.json (array of specs)
// Spec fields (all optional except name):
//   name       output basename (PNG + .json metrics written next to this script in ./shots)
//   width/height  viewport (default 390x844)
//   mobile     true -> touch + deviceScaleFactor 3 + isMobile
//   lang       'he' | 'en'  (interfaceLanguage)
//   settings   object merged into shnayim-settings (fontSize, displayMode, showRashi, showEnglish, targumType, readingStyle, currentAliyah, locationChosen...)
//   route      parsha route for the hash, e.g. 'bereshit' (default: weekly default, no hash)
//   progress   { "perek:pasuk": {hebrew1,hebrew2,targum} } marks for the route (0-indexed keys)
//   markFirst  N -> mark the first N pesukim of the route fully read (convenience)
//   view       'list' (default) | 'focus' | 'settings' | 'help' (focus-mode keyboard help)
//   clickVerse index of the verse whose 🔍 opens focus mode (default 0)
//   fullPage   true -> full-page screenshot (list view can be very long; default false)
//   dark       true -> prefers-color-scheme dark
//   reducedMotion true
//   actions    array of {type:'click'|'press'|'wait', selector?, key?, ms?} run before the shot
//   noNotice   true (default) -> locationChosen:true so the first-run banner is hidden
import { chromium, devices } from '/opt/homebrew/lib/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const outDir = path.join(here, 'shots')
fs.mkdirSync(outDir, { recursive: true })

const arg = process.argv[2]
if (!arg) { console.error('need a spec'); process.exit(1) }
let specs = arg.trim().startsWith('{') || arg.trim().startsWith('[')
  ? JSON.parse(arg)
  : JSON.parse(fs.readFileSync(arg, 'utf8'))
if (!Array.isArray(specs)) specs = [specs]

const browser = await chromium.launch({ executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const results = []
for (const spec of specs) {
  try { results.push(await run(spec)) } catch (e) { results.push({ name: spec.name, error: String(e) }) }
}
await browser.close()
console.log(JSON.stringify(results, null, 2))

async function run(spec) {
  const width = spec.width || 390, height = spec.height || 844
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: spec.mobile ? 3 : 1,
    isMobile: !!spec.mobile,
    hasTouch: !!spec.mobile,
    colorScheme: spec.dark ? 'dark' : 'light',
    reducedMotion: spec.reducedMotion ? 'reduce' : 'no-preference',
    locale: spec.lang === 'he' ? 'he-IL' : 'en-US',
  })
  const settings = Object.assign(
    { interfaceLanguage: spec.lang || 'en', locationChosen: spec.noNotice === false ? false : true },
    spec.settings || {})
  let progress = {}
  if (spec.route && (spec.progress || spec.markFirst)) {
    const marks = { ...(spec.progress || {}) }
    if (spec.markFirst) {
      // need chapter layout: fetch the torah json for the route via the page later; simpler: mark by perek 0 first N
      // caller can pass explicit progress for precision; markFirst assumes perek has >= N verses
      for (let i = 0; i < spec.markFirst; i++) marks[`${spec.firstPerek ?? 0}:${i}`] = { hebrew1: true, hebrew2: true, targum: true }
    }
    progress[spec.route] = marks
  }
  await ctx.addInitScript(({ settings, progress }) => {
    localStorage.setItem('shnayim-settings', JSON.stringify(settings))
    if (Object.keys(progress).length) localStorage.setItem('shnayim-progress', JSON.stringify(progress))
  }, { settings, progress })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const url = 'http://localhost:' + (process.env.PORT || '5199') + '/' + (spec.route ? '#' + spec.route : '')
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.content, .focus-mode, .error', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(400)

  if (spec.view === 'focus' || spec.view === 'help') {
    // In one-pasuk list mode only one card (and one magnifier) exists; focus
    // mode then opens at the keyboard selection, which seeds at the pointer.
    let btn = page.locator('.focus-btn').nth(spec.clickVerse || 0)
    if (await btn.count() === 0) btn = page.locator('.focus-btn').first()
    await btn.waitFor({ timeout: 10000 })
    await btn.click()
    await page.waitForSelector('.focus-mode', { timeout: 5000 })
    await page.waitForTimeout(500)
    if (spec.view === 'help') { await page.locator('.help-btn').click(); await page.waitForTimeout(300) }
  } else if (spec.view === 'settings') {
    await page.locator('.header .controls .btn').first().click()
    await page.waitForTimeout(400)
  }
  for (const a of spec.actions || []) {
    if (a.type === 'click') await page.locator(a.selector).first().click()
    else if (a.type === 'press') await page.keyboard.press(a.key)
    else if (a.type === 'wait') await page.waitForTimeout(a.ms || 300)
    else if (a.type === 'scroll') await page.evaluate((y) => window.scrollTo(0, y), a.y || 0)
    else if (a.type === 'scrollSel') await page.locator(a.selector).first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
  }

  const metrics = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight
    const doc = document.documentElement
    const hOverflow = Math.max(doc.scrollWidth, document.body.scrollWidth) - vw
    const smallTargets = []
    const offscreen = []
    const sel = 'button, a, select, input, [role=button], .clickable-text, .step-indicator span, .focus-btn'
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)
      const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')
      if ((r.width < 44 || r.height < 44) && !el.classList.contains('clickable-text')) smallTargets.push({ tag, label, w: Math.round(r.width), h: Math.round(r.height) })
      if (r.right > vw + 1 || r.left < -1) offscreen.push({ tag, label, left: Math.round(r.left), right: Math.round(r.right) })
    }
    const fontOf = (q) => { const el = document.querySelector(q); if (!el) return null; const cs = getComputedStyle(el); return { size: cs.fontSize, lh: cs.lineHeight, family: cs.fontFamily.split(',')[0], dir: el.closest('[dir]')?.getAttribute('dir') } }
    const header = document.querySelector('.header, .focus-header')
    const headerH = header ? Math.round(header.getBoundingClientRect().height) : null
    const texts = {}
    for (const q of ['h1', '.hebrew-text', '.targum-text', '.english-text', '.rashi-text', '.aliya-label', '.perek-pasuk', '.progress-text', '.btn', '.mode-toggle', '.pasuk-nav', '.settings-modal label', '.daily-guide', '.aliyah-bar']) texts[q] = fontOf(q)
    const contrastSamples = []
    for (const q of ['.progress-text', '.pasuk-number', '.verse-number', '.perek-pasuk', '.aliya-label', '.help-btn', '.btn', '.daily-guide', '.hint', 'small']) {
      const el = document.querySelector(q); if (!el) continue
      const cs = getComputedStyle(el); contrastSamples.push({ q, color: cs.color, bg: cs.backgroundColor, size: cs.fontSize })
    }
    return { vw, vh, hOverflow, docHeight: doc.scrollHeight, headerH, htmlDir: doc.dir, htmlLang: doc.lang, smallTargets: smallTargets.slice(0, 40), offscreen: offscreen.slice(0, 20), texts, contrastSamples, title: document.title, bodyText: document.body.innerText.slice(0, 1500) }
  })
  const file = path.join(outDir, spec.name + '.png')
  await page.screenshot({ path: file, fullPage: !!spec.fullPage })
  const out = { name: spec.name, file, spec, errors, metrics }
  fs.writeFileSync(path.join(outDir, spec.name + '.json'), JSON.stringify(out, null, 2))
  await ctx.close()
  return { name: spec.name, file, errors, hOverflow: metrics.hOverflow, headerH: metrics.headerH, smallTargets: metrics.smallTargets.length, offscreen: metrics.offscreen.length, dir: metrics.htmlDir }
}
