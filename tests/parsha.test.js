/**
 * Weekly-parsha resolution sweep: every Shabbat of 5786–5795, Israel and
 * diaspora, must resolve to a real parshiyot.js route, with no 'bereshit'
 * fallback outside genuine Bereshit weeks.
 */
import { describe, it, expect } from 'vitest'
import { HebrewCalendar, HDate, months } from '@hebcal/core'
import parshiyot from '../src/data/parshiyot.js'
import { resolveWeek, resolveParshaRoute } from '../src/composables/useParsha.js'

const YEARS = Array.from({ length: 10 }, (_, i) => 5786 + i)

describe('resolveParshaRoute', () => {
  it('maps apostrophe names and combined weeks', () => {
    expect(resolveParshaRoute(["Ha'azinu"])).toBe('haazinu')
    expect(resolveParshaRoute(["Beha'alotcha"])).toBe('behaalotcha')
    expect(resolveParshaRoute(["Sh'lach"])).toBe('shlach')
    expect(resolveParshaRoute(["Re'eh"])).toBe('reeh')
    expect(resolveParshaRoute(['Chayei Sara'])).toBe('chayei-sara')
    expect(resolveParshaRoute(['Matot', 'Masei'])).toBe('matot-masei')
    expect(resolveParshaRoute(['Nitzavim', 'Vayeilech'])).toBe('nitzavim-vayeilech')
    expect(resolveParshaRoute(['Vezot Haberakhah'])).toBe('vzot-haberachah')
    expect(resolveParshaRoute(['Sukkot Shabbat Chol ha-Moed'])).toBeNull()
    expect(resolveParshaRoute([])).toBeNull()
  })

  it('hebcalName is a bijection with the hebcal name set', () => {
    const seen = new Set()
    for (const def of Object.values(parshiyot)) {
      const key = Array.isArray(def.hebcalName) ? def.hebcalName.join('|') : def.hebcalName
      expect(seen.has(key), `duplicate hebcalName ${key}`).toBe(false)
      seen.add(key)
    }
    expect(seen.size).toBe(61)
  })
})

describe('resolveWeek sweep 5786–5795', () => {
  for (const il of [true, false]) {
    it(`il=${il}: every Shabbat resolves, no spurious bereshit`, () => {
      let shabbatot = 0
      let chagWeeks = 0
      for (const year of YEARS) {
        const sedra = HebrewCalendar.getSedra(year, il)
        let d = new HDate(1, months.TISHREI, year).onOrAfter(6)
        const nextRH = new HDate(1, months.TISHREI, year + 1)
        while (d.abs() < nextRH.abs()) {
          shabbatot++
          const raw = sedra.lookup(d)
          // Resolve from the Sunday before, so the "next Shabbat" target is exercised
          const sunday = d.subtract(6)
          const { route, shabbat } = resolveWeek(sunday, il)
          expect(parshiyot[route], `${year} ${d.toString()} -> ${route}`).toBeDefined()

          const inVezotWindow = sunday.getMonth() === months.TISHREI && sunday.getDate() > 10 && sunday.getDate() <= (il ? 21 : 22)
          if (inVezotWindow && !(d.getDate() <= 14 && d.getMonth() === months.TISHREI)) {
            // Between Yom Kippur and Simchat Torah (with no Ha'azinu Shabbat
            // still ahead) the week belongs to Vezot Haberachah, whatever the
            // coming Shabbat reads.
            expect(route).toBe('vzot-haberachah')
          } else if (!raw.chag) {
            expect(route).toBe(resolveParshaRoute(raw.parsha))
            expect(shabbat.abs()).toBe(d.abs())
          } else {
            chagWeeks++
            // Chag Shabbat: walk forward must land on a real upcoming parsha.
            expect(shabbat.abs()).toBeGreaterThan(d.abs())
            if (route === 'bereshit') {
              // only legal when the walk-forward lands on real Bereshit
              const target = HebrewCalendar.getSedra(shabbat.getFullYear(), il).lookup(shabbat)
              expect(target.parsha).toEqual(['Bereshit'])
            }
          }
          d = d.add(7)
        }
      }
      expect(shabbatot).toBeGreaterThan(500)
      expect(chagWeeks).toBeGreaterThan(20)
    })
  }

  it('Vezot Haberachah is returned between Yom Kippur and Hoshana Rabbah', () => {
    for (const year of YEARS) {
      for (const il of [true, false]) {
        // day after Sukkot begins: always Vezot Haberachah
        expect(resolveWeek(new HDate(16, months.TISHREI, year), il).route).toBe('vzot-haberachah')
        expect(resolveWeek(new HDate(21, months.TISHREI, year), il).route).toBe('vzot-haberachah')
        // after Simchat Torah: Bereshit
        expect(resolveWeek(new HDate(24, months.TISHREI, year), il).route).toBe('bereshit')
      }
    }
  })

  it('a Shabbat between Yom Kippur and Sukkot is still Ha\'azinu', () => {
    // find a year where 11..14 Tishrei contains a Shabbat
    let checked = 0
    for (const year of YEARS) {
      for (let day = 11; day <= 14; day++) {
        const hd = new HDate(day, months.TISHREI, year)
        if (hd.getDay() === 6) {
          expect(resolveWeek(new HDate(11, months.TISHREI, year), true).route).toBe('haazinu')
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('2026-09-06 resolves to haazinu (Rosh Hashana Shabbat walked forward)', () => {
    expect(resolveWeek(new Date(2026, 8, 6), true).route).toBe('haazinu')
    expect(resolveWeek(new Date(2026, 8, 6), false).route).toBe('haazinu')
  })

  it('Shabbat itself resolves to that Shabbat, not the next', () => {
    const d = new HDate(new Date(2026, 8, 19)) // Shabbat Shuva 5787
    expect(d.getDay()).toBe(6)
    expect(resolveWeek(d, true).shabbat.abs()).toBe(d.abs())
  })
})

/**
 * When Rosh Hashana falls on Thursday both 10 and 17 Tishrei are chag
 * Shabbatot, so the walk-forward loop used to jump 4–10 Tishrei three weeks
 * ahead to Bereshit and then back to Vezot Haberachah on 11 Tishrei. The
 * resolved week must only ever move forward, one parsha at a time.
 */
describe('resolveWeek never moves backwards through Tishrei–Cheshvan', () => {
  // The order the cycle actually runs in over these two months (the export
  // order of parshiyotList wraps Vezot Haberachah -> Bereshit).
  const CYCLE = [
    'nitzavim', 'vayeilech', 'nitzavim-vayeilech', 'haazinu', 'vzot-haberachah',
    'bereshit', 'noach', 'lech-lecha', 'vayera', 'chayei-sara', 'toldot', 'vayetzei'
  ]

  // Rosh Hashana on Thursday: Yom Kippur and Chol ha-Moed Sukkot are both Shabbat.
  for (const year of [5789, 5792, 5795]) {
    it(`${year} (Rosh Hashana on Thursday) is monotonic in il and diaspora`, () => {
      expect(new HDate(1, months.TISHREI, year).getDay()).toBe(4)
      for (const il of [true, false]) {
        let d = new HDate(1, months.TISHREI, year)
        const end = new HDate(1, months.KISLEV, year)
        let prevIdx = -1
        let prevLabel = 'start'
        let days = 0
        while (d.abs() < end.abs()) {
          const { route } = resolveWeek(d, il)
          const idx = CYCLE.indexOf(route)
          expect(idx, `il=${il} ${d.toString()} -> unexpected ${route}`).toBeGreaterThanOrEqual(0)
          expect(
            idx,
            `il=${il} ${d.toString()}: ${prevLabel} -> ${route} moves backwards`
          ).toBeGreaterThanOrEqual(prevIdx)
          if (prevIdx >= 0) {
            // and never skips a parsha of the cycle
            expect(idx - prevIdx, `il=${il} ${d.toString()}: ${prevLabel} -> ${route} skips a week`).toBeLessThanOrEqual(1)
          }
          prevIdx = idx
          prevLabel = route
          days++
          d = d.add(1)
        }
        expect(days).toBeGreaterThan(55)
        // The whole span must actually be traversed, Ha'azinu through Bereshit.
        expect(prevIdx).toBeGreaterThan(CYCLE.indexOf('bereshit'))
      }
    })
  }

  it('Vezot Haberachah opens as soon as no parsha Shabbat is left before Sukkot', () => {
    for (const year of [5789, 5792, 5795]) {
      for (const il of [true, false]) {
        // 3 Tishrei is Shabbat Ha'azinu; from 4 Tishrei only chag Shabbatot
        // remain before Simchat Torah.
        expect(resolveWeek(new HDate(3, months.TISHREI, year), il).route).toBe('haazinu')
        for (let day = 4; day <= (il ? 21 : 22); day++) {
          expect(
            resolveWeek(new HDate(day, months.TISHREI, year), il).route,
            `${year} il=${il} ${day} Tishrei`
          ).toBe('vzot-haberachah')
        }
      }
    }
  })
})
