/** The inline "Sources and licences" panel in Settings reads public/data/CREDITS.md. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCredits, looksLikeMarkdown } from '../src/lib/creditsText.js'

const md = readFileSync(new URL('../public/data/CREDITS.md', import.meta.url), 'utf8')

describe('parseCredits', () => {
  it('turns the shipped CREDITS.md into a heading, paragraphs and one table', () => {
    const blocks = parseCredits(md)
    expect(blocks[0]).toEqual({ type: 'heading', text: 'Text credits' })
    const tables = blocks.filter(b => b.type === 'rows')
    expect(tables).toHaveLength(1)
    expect(tables[0].header).toEqual(['Layer', 'Version', 'Licence', 'Source'])
    expect(tables[0].rows.length).toBeGreaterThanOrEqual(4)
    for (const row of tables[0].rows) expect(row).toHaveLength(4)
    expect(blocks.some(b => b.type === 'para')).toBe(true)
  })

  it('strips Markdown syntax from the text', () => {
    const text = JSON.stringify(parseCredits(md))
    expect(text).not.toMatch(/\]\(/)
    expect(text).not.toContain('`')
    expect(text).not.toContain('**')
  })

  it('joins wrapped paragraph lines and keeps link text', () => {
    expect(parseCredits('From [Sefaria](https://x.org)\nand `more`.')).toEqual([
      { type: 'para', text: 'From Sefaria and more.' }
    ])
  })

  it('tolerates empty input', () => {
    expect(parseCredits('')).toEqual([])
    expect(parseCredits(undefined)).toEqual([])
  })
})

describe('looksLikeMarkdown', () => {
  it('rejects the HTML app shell a missing file is answered with', () => {
    expect(looksLikeMarkdown('<!doctype html><html>')).toBe(false)
    expect(looksLikeMarkdown('')).toBe(false)
    expect(looksLikeMarkdown(md)).toBe(true)
  })
})
