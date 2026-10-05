/**
 * cycleOf: which yearly cycle a mark belongs to. Sweeps 5786–5795 in Israel
 * and the diaspora, in the style of parsha.test.js.
 *
 * A cycle is named by the Hebrew year it begins in; every route switches the
 * day after Simchat Torah, except Vezot Haberachah, which stays in the ending
 * cycle exactly as long as resolveDefaultWeek still offers it as last week's
 * unfinished parsha.
 */
import { describe, it, expect } from 'vitest'
import { HDate, months } from '@hebcal/core'
import parshiyot from '../src/data/parshiyot.js'
import { resolveWeek, resolveDefaultWeek } from '../src/composables/useParsha.js'
import {
  cycleOf,
  upgradeYearOf,
  UPGRADE_CURRENT_ROUTES,
  UPGRADE_CURRENT_YEAR,
  UPGRADE_PREVIOUS_YEAR
} from '../src/lib/cycle.js'

const YEARS = Array.from({ length: 10 }, (_, i) => 5786 + i)
const NONE = () => false
const REGULAR = Object.keys(parshiyot).filter(r => r !== 'vzot-haberachah')
const simchatTorah = (year, il) => new HDate(il ? 22 : 23, months.TISHREI, year)

describe('cycleOf: anchors around Simchat Torah 5787 (2026-10-03 in Israel)', () => {
  it('Israel: Bereshit is 5786 on Simchat Torah and 5787 from the next day', () => {
    expect(cycleOf('bereshit', new Date(2026, 9, 3), true)).toBe(5786)
    expect(cycleOf('bereshit', new Date(2026, 9, 4), true)).toBe(5787)
    expect(cycleOf('noach', new Date(2026, 9, 4), true)).toBe(5787)
  })

  it('diaspora: Simchat Torah is a day later, so is the switch', () => {
    expect(cycleOf('bereshit', new Date(2026, 9, 4), false)).toBe(5786)
    expect(cycleOf('bereshit', new Date(2026, 9, 5), false)).toBe(5787)
  })

  it('Vezot Haberachah stays in 5786 through Sunday–Tuesday after Simchat Torah', () => {
    for (const il of [true, false]) {
      expect(cycleOf('vzot-haberachah', new Date(2026, 9, 4), il)).toBe(5786)
      expect(cycleOf('vzot-haberachah', new Date(2026, 9, 5), il)).toBe(5786)
      expect(cycleOf('vzot-haberachah', new Date(2026, 9, 6), il)).toBe(5786)
      expect(cycleOf('vzot-haberachah', new Date(2026, 9, 7), il)).toBe(5787)
    }
  })

  it('accepts an HDate as well as a Date', () => {
    expect(cycleOf('bereshit', new HDate(23, months.TISHREI, 5787), true)).toBe(5787)
  })

  it('the upgrade constants match the release week of 2026-10-05', () => {
    const release = new Date(2026, 9, 5, 12)
    expect(UPGRADE_PREVIOUS_YEAR).toBe(UPGRADE_CURRENT_YEAR - 1)
    for (const il of [true, false]) {
      for (const route of UPGRADE_CURRENT_ROUTES) {
        expect(cycleOf(route, release, il)).toBe(UPGRADE_CURRENT_YEAR)
        expect(upgradeYearOf(route)).toBe(UPGRADE_CURRENT_YEAR)
      }
    }
    expect(upgradeYearOf('noach')).toBe(UPGRADE_PREVIOUS_YEAR)
    expect(upgradeYearOf('vzot-haberachah')).toBe(UPGRADE_PREVIOUS_YEAR)
  })
})

describe('cycleOf sweep 5786–5795', () => {
  for (const il of [true, false]) {
    it(`il=${il}: regular routes switch exactly once a year, the day after Simchat Torah`, () => {
      for (const year of YEARS) {
        const st = simchatTorah(year, il)
        let d = new HDate(1, months.TISHREI, year)
        const end = new HDate(1, months.TISHREI, year + 1)
        while (d.abs() < end.abs()) {
          const expected = d.abs() <= st.abs() ? year - 1 : year
          for (const route of REGULAR) {
            expect(cycleOf(route, d, il), `${route} ${d.toString()}`).toBe(expected)
          }
          d = d.add(1)
        }
      }
    })

    it(`il=${il}: the Bereshit Shabbat is always in the new cycle, Ha'azinu in the old`, () => {
      for (const year of YEARS) {
        let d = new HDate(1, months.TISHREI, year).onOrAfter(6)
        const end = new HDate(1, months.CHESHVAN, year)
        while (d.abs() < end.abs()) {
          const { route } = resolveWeek(d, il)
          if (route === 'bereshit') expect(cycleOf('bereshit', d, il)).toBe(year)
          if (route === 'haazinu') expect(cycleOf('haazinu', d, il)).toBe(year - 1)
          d = d.add(7)
        }
      }
    })

    it(`il=${il}: Vezot Haberachah stays in the old cycle exactly while resolveDefaultWeek still offers it`, () => {
      let exceptionDays = 0
      for (const year of YEARS) {
        const st = simchatTorah(year, il)
        for (let day = 1; day <= 30; day++) {
          const d = new HDate(day, months.TISHREI, year)
          const civilDay = d.getDay()
          // Plain civil day, then the sunset-adjusted day (civil + 1).
          for (const jewishDay of [undefined, (civilDay + 1) % 7]) {
            const effective = jewishDay === undefined ? d : d.add(1)
            const got = cycleOf('vzot-haberachah', d, il, jewishDay)
            const label = `${il} ${d.toString()} jd=${jewishDay}`
            if (effective.abs() <= st.abs()) {
              expect(got, label).toBe(year - 1)
              continue
            }
            const offered = resolveDefaultWeek(d, il, NONE, jewishDay).route === 'vzot-haberachah'
            expect(got, label).toBe(offered ? year - 1 : year)
            if (offered) {
              exceptionDays++
              expect(effective.abs() - st.abs(), label).toBeLessThanOrEqual(3)
            }
          }
        }
      }
      expect(exceptionDays).toBeGreaterThan(0)
    })

    it(`il=${il}: the sunset-adjusted day moves the switch to the evening before`, () => {
      for (const year of YEARS) {
        const st = simchatTorah(year, il)
        for (const route of ['bereshit', 'noach', 'matot-masei']) {
          const nextDay = (st.getDay() + 1) % 7
          expect(cycleOf(route, st, il)).toBe(year - 1)
          expect(cycleOf(route, st, il, nextDay)).toBe(year)
          // Any other jewishDay value is ignored, as in resolveDefaultWeek.
          expect(cycleOf(route, st, il, st.getDay())).toBe(year - 1)
        }
      }
    })
  }

  it('Israel and diaspora differ only on the diaspora Simchat Torah', () => {
    for (const year of YEARS) {
      let d = new HDate(1, months.TISHREI, year)
      const end = new HDate(1, months.CHESHVAN, year)
      while (d.abs() < end.abs()) {
        const same = cycleOf('noach', d, true) === cycleOf('noach', d, false)
        const isDiasporaSt = d.getDate() === 23 && d.getMonth() === months.TISHREI
        expect(same, d.toString()).toBe(!isDiasporaSt)
        d = d.add(1)
      }
    }
  })
})
