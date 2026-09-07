/**
 * resolveDefaultWeek: which week the app opens on.
 *
 * The coming Shabbat's week (`next`) is the default, except Sunday through the
 * end of Tuesday, when an unfinished `previous` week stays the default and is
 * flagged `late`.
 */
import { describe, it, expect } from 'vitest'
import { HDate, months } from '@hebcal/core'
import { resolveDefaultWeek, useParsha } from '../src/composables/useParsha.js'

const NONE = () => false
const ALL = () => true

const YEARS = Array.from({ length: 10 }, (_, i) => 5786 + i)

describe('resolveDefaultWeek: the Sunday–Tuesday grace window', () => {
  // 4 Jan 2026 is a Sunday in the Vayechi -> Shemot changeover week.
  const sunday = new Date(2026, 0, 4)
  const monday = new Date(2026, 0, 5)
  const tuesday = new Date(2026, 0, 6)
  const wednesday = new Date(2026, 0, 7)
  const shabbat = new Date(2026, 0, 10)

  it('names the two weeks around the coming Shabbat', () => {
    const r = resolveDefaultWeek(sunday, true, ALL)
    expect(r.next.route).toBe('shemot')
    expect(r.previous.route).toBe('vayechi')
    expect(r.next.shabbat.abs() - r.previous.shabbat.abs()).toBe(7)
  })

  for (const [name, date] of [['Sunday', sunday], ['Monday', monday], ['Tuesday', tuesday]]) {
    it(`${name} with the previous parsha unfinished keeps it as the default`, () => {
      const r = resolveDefaultWeek(date, true, NONE)
      expect(r.route).toBe('vayechi')
      expect(r.late).toBe(true)
      expect(r.shabbat.abs()).toBe(r.previous.shabbat.abs())
    })

    it(`${name} with the previous parsha finished moves on to the coming week`, () => {
      const r = resolveDefaultWeek(date, true, ALL)
      expect(r.route).toBe('shemot')
      expect(r.late).toBe(false)
      expect(r.shabbat.abs()).toBe(r.next.shabbat.abs())
    })
  }

  it('Wednesday moves on even with the previous parsha unfinished', () => {
    const r = resolveDefaultWeek(wednesday, true, NONE)
    expect(r.route).toBe('shemot')
    expect(r.late).toBe(false)
  })

  it('Shabbat itself is never late', () => {
    const r = resolveDefaultWeek(shabbat, true, NONE)
    expect(new HDate(shabbat).getDay()).toBe(6)
    expect(r.route).toBe('shemot')
    expect(r.late).toBe(false)
  })

  it('a missing isComplete callback behaves as "done" (never late)', () => {
    const r = resolveDefaultWeek(sunday, true)
    expect(r.route).toBe('shemot')
    expect(r.late).toBe(false)
  })

  it('only the previous route is asked about', () => {
    const asked = []
    resolveDefaultWeek(sunday, true, (route) => {
      asked.push(route)
      return true
    })
    expect(asked).toEqual(['vayechi'])
  })

  it('previous is always a different parsha from next', () => {
    for (const il of [true, false]) {
      for (const year of YEARS) {
        let d = new HDate(1, months.TISHREI, year)
        const end = new HDate(1, months.TISHREI, year + 1)
        while (d.abs() < end.abs()) {
          const r = resolveDefaultWeek(d, il, ALL)
          expect(r.previous.route, `${il} ${d.toString()}`).not.toBe(r.next.route)
          expect(r.previous.shabbat.abs()).toBeLessThan(r.next.shabbat.abs())
          d = d.add(1)
        }
      }
    }
  })
})

describe('resolveDefaultWeek: the Bereshit / Vezot Haberachah boundary', () => {
  it('il 5787: Tuesday 25 Tishrei still offers the unfinished Vezot Haberachah', () => {
    const d = new HDate(25, months.TISHREI, 5787)
    expect(d.getDay()).toBe(2)
    const late = resolveDefaultWeek(d, true, NONE)
    expect(late.next.route).toBe('bereshit')
    expect(late.previous.route).toBe('vzot-haberachah')
    expect(late.route).toBe('vzot-haberachah')
    expect(late.late).toBe(true)
    // Simchat Torah in Israel: 22 Tishrei
    expect(late.shabbat.getDate()).toBe(22)

    const done = resolveDefaultWeek(d, true, ALL)
    expect(done.route).toBe('bereshit')
    expect(done.late).toBe(false)
  })

  it('diaspora 5787: same day, Vezot Haberachah dated to Simchat Torah 23 Tishrei', () => {
    const d = new HDate(25, months.TISHREI, 5787)
    const late = resolveDefaultWeek(d, false, NONE)
    expect(late.next.route).toBe('bereshit')
    expect(late.previous.route).toBe('vzot-haberachah')
    expect(late.route).toBe('vzot-haberachah')
    expect(late.late).toBe(true)
    expect(late.shabbat.getDate()).toBe(23)
  })

  it('from Simchat Torah to the Bereshit Shabbat, previous is Vezot Haberachah', () => {
    for (const il of [true, false]) {
      for (const year of YEARS) {
        const simchatTorah = il ? 22 : 23
        let d = new HDate(simchatTorah, months.TISHREI, year)
        const bereshit = resolveDefaultWeek(d, il, ALL).next.shabbat
        while (d.abs() <= bereshit.abs()) {
          const r = resolveDefaultWeek(d, il, ALL)
          expect(r.next.route, `${il} ${d.toString()}`).toBe('bereshit')
          expect(r.previous.route, `${il} ${d.toString()}`).toBe('vzot-haberachah')
          d = d.add(1)
        }
      }
    }
  })

  it('the day before Simchat Torah still belongs to Vezot Haberachah', () => {
    for (const il of [true, false]) {
      for (const year of YEARS) {
        const d = new HDate(il ? 21 : 22, months.TISHREI, year)
        expect(resolveDefaultWeek(d, il, ALL).next.route).toBe('vzot-haberachah')
      }
    }
  })
})

describe('useParsha()', () => {
  const { getWeeklyParsha, getDefaultWeek } = useParsha()

  it('getWeeklyParsha still returns a route string', () => {
    const route = getWeeklyParsha('israel')
    expect(typeof route).toBe('string')
    expect(route).toBe(getDefaultWeek('israel').route)
  })

  it('getDefaultWeek returns the whole decision', () => {
    const r = getDefaultWeek('diaspora', ALL)
    expect(Object.keys(r).sort()).toEqual(['late', 'next', 'previous', 'route', 'shabbat'])
    expect(r.late).toBe(false)
    expect(r.route).toBe(r.next.route)
  })

  it('getWeeklyParsha honours isComplete when it is passed', () => {
    const withNone = getDefaultWeek('israel', NONE)
    expect(getWeeklyParsha('israel', NONE)).toBe(withNone.route)
    if (withNone.late) expect(withNone.route).toBe(withNone.previous.route)
  })
})
