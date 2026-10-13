/**
 * public/data/CREDITS.md as plain blocks for the Settings "Sources and
 * licences" panel, so it shows inline instead of opening a raw Markdown file.
 * Handles only what that file uses: headings, paragraphs (lines joined), one
 * pipe table, [text](url) links, `code` and **bold**. Text only, no HTML: the
 * component renders each block with text interpolation.
 *
 * Blocks: { type: 'heading', text } | { type: 'para', text }
 *       | { type: 'rows', header: string[], rows: string[][] }
 */

const inline = (s) => s
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .trim()

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => inline(c))
const isDivider = (line) => /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('-')

export function parseCredits(md) {
  const blocks = []
  let para = []
  let table = null
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'para', text: inline(para.join(' ')) })
    para = []
  }
  const flushTable = () => {
    if (table) blocks.push(table)
    table = null
  }
  for (const raw of String(md || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushTable()
      continue
    }
    if (line.startsWith('|')) {
      flushPara()
      if (!table) table = { type: 'rows', header: cells(line), rows: [] }
      else if (!isDivider(line)) table.rows.push(cells(line))
      continue
    }
    flushTable()
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      flushPara()
      blocks.push({ type: 'heading', text: inline(heading[1]) })
      continue
    }
    para.push(line)
  }
  flushPara()
  flushTable()
  return blocks
}

/** A Vercel miss answers 200 with index.html; that is not the credits file. */
export function looksLikeMarkdown(text) {
  return typeof text === 'string' && text.trim().length > 0 && !/^\s*</.test(text)
}
