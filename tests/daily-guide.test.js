/**
 * The daily guide and the urgency label — both advisory only.
 *
 * dailyGuide maps a Jewish day-of-week (0=Sunday .. 6=Shabbat, sunset rollover
 * is the caller's problem) to suggested aliyot; urgency labels where "now"
 * sits relative to the Shabbat this parsha is read on.
 */
import { describe, it, expect } from 'vitest'
import { dailyGuide, urgency, isRouteComplete } from '../src/lib/progressMath.js'
import { resolveDefaultWeek } from '../src/composables/useParsha.js'

const SUNDAY = 0
const MONDAY = 1
const TUESDAY = 2
const WEDNESDAY = 3
const THURSDAY = 4
const FRIDAY = 5
const SHABBAT = 6

describe('dailyGuide', () => {
  it('maps every day of the week for a full 7-aliyah parsha', () => {
    expect(dailyGuide(SUNDAY, 7)).toEqual({ aliyot: [], review: true })
    expect(dailyGuide(MONDAY, 7)).toEqual({ aliyot: [1, 2], review: false })
    expect(dailyGuide(TUESDAY, 7)).toEqual({ aliyot: [3], review: false })
    expect(dailyGuide(WEDNESDAY, 7)).toEqual({ aliyot: [4], review: false })
    expect(dailyGuide(THURSDAY, 7)).toEqual({ aliyot: [5], review: false })
    expect(dailyGuide(FRIDAY, 7)).toEqual({ aliyot: [6, 7], review: false })
    expect(dailyGuide(SHABBAT, 7)).toEqual({ aliyot: [], review: true })
  })

  it('clamps suggestions to the aliyot a parsha actually has', () => {
    // Vezot Haberachah has 5 aliyot: Thursday still works, Friday has nothing left.
    expect(dailyGuide(THURSDAY, 5).aliyot).toEqual([5])
    expect(dailyGuide(FRIDAY, 5).aliyot).toEqual([])
    // Eikev / Nitzavim have 6: Friday keeps only the sixth.
    expect(dailyGuide(FRIDAY, 6).aliyot).toEqual([6])
    // A 1-aliyah edge case drops everything past the first.
    expect(dailyGuide(MONDAY, 1).aliyot).toEqual([1])
    expect(dailyGuide(TUESDAY, 1).aliyot).toEqual([])
  })

  it('never suggests an aliyah number above the count, for any day/count pair', () => {
    for (let day = 0; day <= 6; day++) {
      for (let count = 1; count <= 7; count++) {
        for (const n of dailyGuide(day, count).aliyot) {
          expect(n).toBeLessThanOrEqual(count)
          expect(n).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('flags review only on Sunday (catch up) and Shabbat', () => {
    for (let day = 0; day <= 6; day++) {
      expect(dailyGuide(day, 7).review).toBe(day === SUNDAY || day === SHABBAT)
    }
  })

  it('returns a fresh array each call (callers cannot poison the table)', () => {
    const first = dailyGuide(MONDAY, 7)
    first.aliyot.push(99)
    expect(dailyGuide(MONDAY, 7).aliyot).toEqual([1, 2])
  })

  it('throws on a bad day or a bad aliyah count', () => {
    expect(() => dailyGuide(-1, 7)).toThrow(/jewishDayOfWeek/)
    expect(() => dailyGuide(7, 7)).toThrow(/jewishDayOfWeek/)
    expect(() => dailyGuide(1.5, 7)).toThrow(/jewishDayOfWeek/)
    expect(() => dailyGuide(MONDAY, 0)).toThrow(/aliyahCount/)
    expect(() => dailyGuide(MONDAY, 8)).toThrow(/aliyahCount/)
    expect(() => dailyGuide(MONDAY, '7')).toThrow(/aliyahCount/)
  })
})

describe('urgency', () => {
  // Target Shabbat: Sat 12 Sep 2026, local civil midnight.
  const shabbat = new Date(2026, 8, 12)

  it('is "upcoming" before the prior Shabbat afternoon', () => {
    expect(urgency(new Date(2026, 8, 4), shabbat)).toBe('upcoming') // 8 days before
    expect(urgency(new Date(2026, 8, 5, 12, 0), shabbat)).toBe('upcoming') // prior Sat 12:00
  })

  it('opens at the prior Shabbat\'s Mincha (modelled as 13:00) and stays open until Shabbat', () => {
    expect(urgency(new Date(2026, 8, 5, 13, 0), shabbat)).toBe('open') // exactly at Mincha
    expect(urgency(new Date(2026, 8, 5, 14, 0), shabbat)).toBe('open') // prior Sat 14:00
    expect(urgency(new Date(2026, 8, 9, 9, 0), shabbat)).toBe('open') // Wednesday before
    expect(urgency(new Date(2026, 8, 11, 23, 59), shabbat)).toBe('open') // Friday night
  })

  it('is "due" during the Shabbat civil day', () => {
    expect(urgency(new Date(2026, 8, 12, 0, 0), shabbat)).toBe('due') // civil midnight
    expect(urgency(new Date(2026, 8, 12, 10, 0), shabbat)).toBe('due')
    expect(urgency(new Date(2026, 8, 12, 23, 59), shabbat)).toBe('due')
  })

  it('is "late" through the end of the following Wednesday', () => {
    expect(urgency(new Date(2026, 8, 13, 9, 0), shabbat)).toBe('late') // Sunday after
    expect(urgency(new Date(2026, 8, 16, 23, 0), shabbat)).toBe('late') // Wednesday after 23:00
  })

  it('is "past" once the lenient window closes', () => {
    expect(urgency(new Date(2026, 8, 17, 1, 0), shabbat)).toBe('past') // Thursday after 01:00
    expect(urgency(new Date(2026, 9, 1), shabbat)).toBe('past')
  })

  it('honours an explicit deadline (e.g. Hoshana Rabbah for Vezot Haberachah)', () => {
    const deadline = new Date(2026, 8, 14) // the following Monday, civil midnight
    expect(urgency(new Date(2026, 8, 14, 12, 0), shabbat, { deadline })).toBe('late')
    expect(urgency(new Date(2026, 8, 15, 9, 0), shabbat, { deadline })).toBe('past')
    // The deadline only replaces the lenient end; earlier phases are unchanged.
    expect(urgency(new Date(2026, 8, 9), shabbat, { deadline })).toBe('open')
    expect(urgency(new Date(2026, 8, 12, 10, 0), shabbat, { deadline })).toBe('due')
  })

  it('throws on invalid dates', () => {
    expect(() => urgency('2026-09-12', shabbat)).toThrow(/now/)
    expect(() => urgency(new Date(2026, 8, 12), null)).toThrow(/shabbat/)
    expect(() => urgency(new Date('nope'), shabbat)).toThrow(/now/)
    expect(() => urgency(new Date(2026, 8, 12), shabbat, { deadline: 'monday' })).toThrow(/deadline/)
  })

  it('always returns one of the five advisory labels, and only a string', () => {
    const levels = ['upcoming', 'open', 'due', 'late', 'past']
    const seen = new Set()
    for (let offset = -14; offset <= 14; offset++) {
      for (const hour of [0, 6, 13, 21]) {
        const now = new Date(2026, 8, 12 + offset, hour)
        const level = urgency(now, shabbat)
        expect(typeof level).toBe('string')
        expect(levels).toContain(level)
        seen.add(level)
      }
    }
    expect([...seen].sort()).toEqual([...levels].sort())
  })

  it('is monotonic through time', () => {
    const order = ['upcoming', 'open', 'due', 'late', 'past']
    let last = -1
    for (let hours = -24 * 14; hours <= 24 * 14; hours++) {
      const now = new Date(2026, 8, 12, hours)
      const idx = order.indexOf(urgency(now, shabbat))
      expect(idx).toBeGreaterThanOrEqual(last)
      last = idx
    }
  })
})

describe('anti-gating invariant', () => {
  it('dailyGuide returns exactly { aliyot, review } — nothing that can gate content', () => {
    for (let day = 0; day <= 6; day++) {
      for (let count = 1; count <= 7; count++) {
        const guide = dailyGuide(day, count)
        expect(Object.keys(guide).sort()).toEqual(['aliyot', 'review'])
        expect(Array.isArray(guide.aliyot)).toBe(true)
        expect(typeof guide.review).toBe('boolean')
      }
    }
  })

  it('urgency returns a bare label, not an object with permissions', () => {
    const shabbat = new Date(2026, 8, 12)
    const label = urgency(new Date(2026, 8, 10), shabbat)
    expect(typeof label).toBe('string')
    expect(label).not.toBeInstanceOf(Object)
  })
})

/**
 * 'late' and 'past' are only reachable when the app feeds urgency the Shabbat of
 * the week actually ON SCREEN. Feeding it the coming Shabbat only — which is
 * always today or later — made those two labels dead code.
 *
 * 4 Jan 2026 is a Sunday in the Vayechi -> Shemot changeover week.
 */
describe('the week on screen decides which urgency labels are reachable', () => {
  const sunday = new Date(2026, 0, 4, 10, 0)
  const thursday = new Date(2026, 0, 8, 10, 0)
  const unfinished = () => false

  /** Civil midnight of an HDate, the way the app hands a Shabbat to urgency(). */
  const civilMidnight = (hdate) => {
    const d = hdate.greg()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  it("last week's parsha is 'late' on Sunday while the coming one is merely 'open'", () => {
    const week = resolveDefaultWeek(sunday, true, unfinished)
    expect(week.route).toBe(week.previous.route)
    expect(urgency(sunday, civilMidnight(week.previous.shabbat))).toBe('late')
    expect(urgency(sunday, civilMidnight(week.next.shabbat))).toBe('open')
  })

  it("turns 'past' once the lenient window of that week closes", () => {
    const week = resolveDefaultWeek(sunday, true, unfinished)
    expect(urgency(thursday, civilMidnight(week.previous.shabbat))).toBe('past')
  })

  it('per-route completeness is what decides the default week', () => {
    // A three-aliyah stand-in parsha, complete in one progress map and not the other.
    const entry = {
      book: 'test',
      aliyot: [
        { n: 1, start: [0, 0], end: [0, 1], verseCount: 2 },
        { n: 2, start: [0, 2], end: [0, 3], verseCount: 2 }
      ],
      total: 4
    }
    const full = {}
    for (const key of ['0:0', '0:1', '0:2', '0:3']) {
      full[key] = { hebrew1: true, hebrew2: true, targum: true }
    }
    const partial = { ...full, '0:3': { hebrew1: true, hebrew2: true, targum: false } }

    const done = (progress) => (route) =>
      route === 'vayechi' ? isRouteComplete(progress, entry) : true

    expect(resolveDefaultWeek(sunday, true, done(full)).route).toBe('shemot')
    expect(resolveDefaultWeek(sunday, true, done(partial)).route).toBe('vayechi')
    expect(resolveDefaultWeek(sunday, true, done(partial)).late).toBe(true)
  })
})
