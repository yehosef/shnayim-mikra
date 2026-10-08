import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pwaOptions } from '../vite.config.js'

// The theme is Light / Dark / Auto in Settings; the resolved value lives in
// <html data-theme>. src/style.css defines the --c-* colour tokens once for
// light and redefines them in a :root[data-theme="dark"] block. Components use
// the tokens, never literal colours, so both themes stay complete.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(root, 'src/style.css'), 'utf8')
const html = readFileSync(join(root, 'index.html'), 'utf8')

const darkStart = css.indexOf(':root[data-theme="dark"]')
const lightCss = css.slice(0, darkStart)
const darkCss = css.slice(darkStart, css.indexOf('@media (prefers-reduced-motion'))

function tokens(text) {
  const out = {}
  for (const m of text.matchAll(/(--c-[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
const light = tokens(lightCss)
const dark = tokens(darkCss)

describe('colour tokens', () => {
  it('has a dark block that redefines every light colour token', () => {
    expect(darkStart).toBeGreaterThan(0)
    expect(Object.keys(light).length).toBeGreaterThan(20)
    for (const name of Object.keys(light)) {
      expect(dark[name], `${name} missing from the dark block`).toBeDefined()
    }
  })

  it('lets native controls follow the resolved theme', () => {
    expect(lightCss).toMatch(/color-scheme:\s*light;/)
    expect(darkCss).toMatch(/color-scheme:\s*dark;/)
  })

  it('keeps literal colours out of the components', () => {
    const dir = join(root, 'src/components')
    const files = readdirSync(dir).filter((f) => f.endsWith('.vue')).map((f) => join(dir, f))
    files.push(join(root, 'src/App.vue'))
    const literal = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|\bcolor:\s*(white|black)\b|\bbackground:\s*(white|black)\b/
    const found = []
    for (const file of files) {
      const style = readFileSync(file, 'utf8').split('<style')[1] || ''
      style.split('\n').forEach((line, i) => {
        // mask-image gradients are alpha masks, not visible colours
        if (/mask-image/.test(line)) return
        if (literal.test(line)) found.push(`${file.slice(root.length + 1)} (style line ${i}): ${line.trim()}`)
      })
    }
    expect(found).toEqual([])
  })
})

describe('installed-app colours', () => {
  it('opens on the light page background, not the old navy', () => {
    expect(pwaOptions.manifest.background_color).toBe(light['--c-bg'])
    expect(pwaOptions.manifest.theme_color).toBe(light['--c-bg'])
  })

  it('gives the browser bar each theme\'s page background', () => {
    // One theme-color meta, set before first paint by the index.html script
    // (and kept current by useTheme.js); both values must match the tokens.
    const m = html.match(/<meta name="theme-color" content="([^"]+)" \/>/)
    expect(m && m[1]).toBe(light['--c-bg'])
    expect(html).toContain(`theme === 'dark' ? '${dark['--c-bg']}' : '${light['--c-bg']}'`)
  })
})
