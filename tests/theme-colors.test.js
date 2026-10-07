import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pwaOptions } from '../vite.config.js'

// The dark theme follows the system setting only: src/style.css defines the
// --c-* colour tokens once for light and redefines them in a
// prefers-color-scheme: dark block. Components use the tokens, never literal
// colours, so both themes stay complete.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(root, 'src/style.css'), 'utf8')
const html = readFileSync(join(root, 'index.html'), 'utf8')

const darkStart = css.indexOf('@media (prefers-color-scheme: dark)')
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

  it('lets native controls follow the system theme', () => {
    expect(lightCss).toMatch(/color-scheme:\s*light dark/)
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
    const meta = (scheme) => {
      const m = html.match(new RegExp(`<meta name="theme-color" content="([^"]+)" media="\\(prefers-color-scheme: ${scheme}\\)"`))
      return m && m[1]
    }
    expect(meta('light')).toBe(light['--c-bg'])
    expect(meta('dark')).toBe(dark['--c-bg'])
  })
})
