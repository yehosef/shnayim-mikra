/**
 * progressMath — pure derivations over per-verse progress.
 *
 * Per-verse progress is the ONLY stored truth. Its shape is the storage
 * contract (see tests/progress-compat.test.js) and is never changed here:
 *
 *   progress for one parsha: { [verseKey]: { hebrew1, hebrew2, targum } }
 *   verseKey = `${perekNum}:${pasukNum}` — BOTH 0-indexed integers,
 *   so "0:0" is Genesis 1:1.
 *
 * Everything else — aliyah completion, the reading pointer, the daily guide,
 * urgency — is DERIVED from that map by the pure functions below. No Vue, no
 * localStorage, no Date.now(): the current time is always passed in.
 *
 * HARD INVARIANT — NO GATING:
 * Nothing exported here returns anything that can be used to hide, disable,
 * lock, or gate content. The daily guide and urgency are ADVISORY LABELS only.
 * Returned objects must never carry keys like hidden / disabled / locked /
 * allowed / gated / canRead, and dailyGuide returns plain aliyah numbers.
 * The full whitelist of keys any export may return:
 *   aliyahStats -> hebrew1, hebrew2, targum, complete, total, percent
 *   nextUnread  -> key, phase   (or null)
 *   isRouteComplete -> a boolean (no object)
 *   dailyGuide  -> aliyot, review
 *   urgency     -> a string: 'upcoming' | 'open' | 'due' | 'late' | 'past'
 * This is enforced by tests/reading-state.test.js and tests/daily-guide.test.js.
 */

/** The three phases of every verse, in reading order. */
export const PHASES = ['hebrew1', 'hebrew2', 'targum']

function isIndex(n) {
  return Number.isInteger(n) && n >= 0
}

/** `[perek, pasuk]` (0-indexed) -> "perek:pasuk". */
export function verseKey(perek, pasuk) {
  if (!isIndex(perek) || !isIndex(pasuk)) {
    throw new RangeError(`verseKey: expected non-negative integers, got ${perek}, ${pasuk}`)
  }
  return `${perek}:${pasuk}`
}

/** "3:12" -> [3, 12]. */
export function parseKey(key) {
  const m = /^(\d+):(\d+)$/.exec(String(key))
  if (!m) throw new RangeError(`parseKey: bad verse key ${JSON.stringify(key)}`)
  return [Number(m[1]), Number(m[2])]
}

/** True iff the record exists and all three phases are true. */
export function isVerseComplete(rec) {
  return !!rec && PHASES.every((phase) => rec[phase] === true)
}

function assertPosition(label, pos, chapterLengths) {
  if (!Array.isArray(pos) || pos.length !== 2) {
    throw new RangeError(`rangeKeys: ${label} must be [perek, pasuk]`)
  }
  const [perek, pasuk] = pos
  if (!isIndex(perek) || !isIndex(pasuk)) {
    throw new RangeError(`rangeKeys: ${label} must hold non-negative integers`)
  }
  if (perek >= chapterLengths.length) {
    throw new RangeError(`rangeKeys: ${label} perek ${perek} out of range`)
  }
  if (pasuk >= chapterLengths[perek]) {
    throw new RangeError(`rangeKeys: ${label} pasuk ${pasuk} out of range for perek ${perek}`)
  }
}

/**
 * Ordered verse keys from `start` to `end` inclusive, crossing chapter
 * boundaries. Positions are 0-indexed `[perek, pasuk]`; `chapterLengths[i]` is
 * the number of verses in chapter i.
 */
export function rangeKeys(start, end, chapterLengths) {
  if (!Array.isArray(chapterLengths) || chapterLengths.length === 0) {
    throw new RangeError('rangeKeys: chapterLengths must be a non-empty array')
  }
  for (const len of chapterLengths) {
    if (!Number.isInteger(len) || len < 0) {
      throw new RangeError('rangeKeys: chapterLengths must hold non-negative integers')
    }
  }
  assertPosition('start', start, chapterLengths)
  assertPosition('end', end, chapterLengths)

  const [startPerek, startPasuk] = start
  const [endPerek, endPasuk] = end
  if (endPerek < startPerek || (endPerek === startPerek && endPasuk < startPasuk)) {
    throw new RangeError('rangeKeys: end is before start')
  }

  const keys = []
  for (let perek = startPerek; perek <= endPerek; perek++) {
    const from = perek === startPerek ? startPasuk : 0
    const to = perek === endPerek ? endPasuk : chapterLengths[perek] - 1
    for (let pasuk = from; pasuk <= to; pasuk++) keys.push(verseKey(perek, pasuk))
  }
  return keys
}

/**
 * Phase counts over `keys`. Missing records count as all-false.
 * -> { hebrew1, hebrew2, targum, complete, total, percent }
 */
export function aliyahStats(progress, keys) {
  const map = progress || {}
  const list = keys || []
  const stats = { hebrew1: 0, hebrew2: 0, targum: 0, complete: 0, total: list.length, percent: 0 }
  for (const key of list) {
    const rec = map[key]
    if (!rec) continue
    for (const phase of PHASES) if (rec[phase] === true) stats[phase]++
    if (isVerseComplete(rec)) stats.complete++
  }
  stats.percent = stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0
  return stats
}

/** True when [perek, pasuk] lies inside an aliyah's inclusive [start, end]. */
function inAliyahRange(aliyah, perek, pasuk) {
  const start = aliyah?.start
  const end = aliyah?.end
  if (!Array.isArray(start) || !Array.isArray(end)) return false
  if (perek < start[0] || (perek === start[0] && pasuk < start[1])) return false
  if (perek > end[0] || (perek === end[0] && pasuk > end[1])) return false
  return true
}

/**
 * True when every verse of a parsha is complete, judged WITHOUT chapter
 * lengths: the aliyot entry already carries the expected verse count
 * (`total`, or the sum of the aliyot `verseCount`s), and progress keys are
 * unique, so counting the complete records that fall inside the aliyot ranges
 * and comparing with that total is exact — no chumash fetch needed.
 *
 * `aliyotEntry` is one entry of aliyot.json:
 *   { book, aliyot: [{ n, start:[p,v], end:[p,v], verseCount }], total }
 * Returns false when the entry is missing or unusable (callers decide what an
 * unknown parsha means; nothing here gates content).
 */
export function isRouteComplete(progress, aliyotEntry) {
  const aliyot = aliyotEntry?.aliyot
  if (!Array.isArray(aliyot) || aliyot.length === 0) return false

  let total = aliyotEntry.total
  if (!Number.isInteger(total)) {
    total = 0
    for (const a of aliyot) {
      if (!Number.isInteger(a?.verseCount)) return false
      total += a.verseCount
    }
  }
  if (total <= 0) return false

  let done = 0
  for (const [key, rec] of Object.entries(progress || {})) {
    if (!isVerseComplete(rec)) continue
    let perek
    let pasuk
    try {
      ;[perek, pasuk] = parseKey(key)
    } catch (e) {
      continue // a foreign key can never count towards the total
    }
    if (aliyot.some((a) => inAliyahRange(a, perek, pasuk))) done++
  }
  return done >= total
}

function isPhaseDone(progress, key, phase) {
  return progress?.[key]?.[phase] === true
}

/**
 * Restrict `blocks` to the block indexes in `only` (a number or an array of
 * numbers), keeping block order. Indexes outside the array are dropped, so an
 * out-of-range scope yields an empty traversal (pointer null), never a throw.
 */
function scopeBlocks(blocks, only) {
  if (only === undefined || only === null) return blocks
  const wanted = Array.isArray(only) ? only : [only]
  const picked = []
  for (const i of wanted) {
    if (!Number.isInteger(i)) {
      throw new RangeError(`nextUnread: opts.only must hold integers, got ${JSON.stringify(i)}`)
    }
    if (i >= 0 && i < blocks.length) picked.push(blocks[i])
  }
  return picked
}

/**
 * First unread (key, phase) in traversal order, or null when everything is done.
 *
 * `blocks` is one ordered array of keys per aliyah, in aliyah order.
 * style 'verse' : keys in order (blocks flattened); per key hebrew1 -> hebrew2 -> targum.
 * style 'aliyah': per block, every key's hebrew1, then every key's hebrew2,
 *                 then every key's targum; then on to the next block.
 *
 * `opts.only` (number | number[]) restricts the traversal to those block
 * indexes — the scoped pointer used when only one aliyah is displayed. The
 * traversal order within a block is unchanged, so 'aliyah' style still runs
 * hebrew1 over the whole block before hebrew2.
 */
export function nextUnread(progress, blocks, style, opts = {}) {
  if (style !== 'verse' && style !== 'aliyah') {
    throw new RangeError(`nextUnread: unknown style ${JSON.stringify(style)}`)
  }
  const list = scopeBlocks(blocks || [], opts?.only)

  if (style === 'verse') {
    for (const block of list) {
      for (const key of block) {
        for (const phase of PHASES) {
          if (!isPhaseDone(progress, key, phase)) return { key, phase }
        }
      }
    }
    return null
  }

  for (const block of list) {
    for (const phase of PHASES) {
      for (const key of block) {
        if (!isPhaseDone(progress, key, phase)) return { key, phase }
      }
    }
  }
  return null
}

/**
 * Advisory daily suggestion. `jewishDayOfWeek`: 0=Sunday .. 6=Shabbat (the
 * caller handles sunset rollover). `aliyahCount`: how many aliyot this parsha
 * actually has; suggestions above it are dropped.
 * -> { aliyot: number[], review: boolean }
 */
const DAY_ALIYOT = [[], [1, 2], [3], [4], [5], [6, 7], []]
const REVIEW_DAYS = new Set([0, 6]) // Sunday = review / catch up, Shabbat = review

export function dailyGuide(jewishDayOfWeek, aliyahCount) {
  if (!Number.isInteger(jewishDayOfWeek) || jewishDayOfWeek < 0 || jewishDayOfWeek > 6) {
    throw new RangeError(`dailyGuide: jewishDayOfWeek must be 0..6, got ${jewishDayOfWeek}`)
  }
  if (!Number.isInteger(aliyahCount) || aliyahCount < 1 || aliyahCount > 7) {
    throw new RangeError(`dailyGuide: aliyahCount must be 1..7, got ${aliyahCount}`)
  }
  return {
    aliyot: DAY_ALIYOT[jewishDayOfWeek].filter((n) => n <= aliyahCount),
    review: REVIEW_DAYS.has(jewishDayOfWeek)
  }
}

/** Local civil time `hours:00` on the day `dayOffset` days from `date`. DST-safe. */
function localDay(date, dayOffset = 0, hours = 0) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset, hours, 0, 0, 0)
}

function assertDate(label, value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`urgency: ${label} must be a valid Date`)
  }
}

/**
 * Advisory urgency label for one parsha. Purely a function of the two dates.
 *
 * `now`     : the current moment.
 * `shabbat` : local civil midnight of the Shabbat this parsha is read on.
 * `opts.deadline` : optional local civil midnight replacing the default
 *                   "lenient through the following Wednesday" end (used for
 *                   Vezot Haberachah, whose deadline is Hoshana Rabbah).
 *
 * 'upcoming' before the prior Shabbat's Mincha (modelled as shabbat − 7d, 13:00)
 * 'open'     from then until the target Shabbat's civil day begins
 * 'due'      during the target Shabbat's civil day
 * 'late'     after Shabbat through the end of the lenient window
 * 'past'     after that
 */
export function urgency(now, shabbat, opts = {}) {
  assertDate('now', now)
  assertDate('shabbat', shabbat)
  const deadline = opts?.deadline
  if (deadline !== undefined && deadline !== null) assertDate('opts.deadline', deadline)

  const opensAt = localDay(shabbat, -7, 13)
  if (now < opensAt) return 'upcoming'

  const shabbatStart = localDay(shabbat, 0)
  if (now < shabbatStart) return 'open'

  const shabbatEnd = localDay(shabbat, 1)
  if (now < shabbatEnd) return 'due'

  // Lenient window: through the end of the following Wednesday (day 3), or
  // through the end of opts.deadline's civil day when one is supplied.
  const daysToWednesday = ((3 - shabbat.getDay() + 6) % 7) + 1
  const lenientEnd = deadline ? localDay(deadline, 1) : localDay(shabbat, daysToWednesday + 1)
  return now < lenientEnd ? 'late' : 'past'
}
