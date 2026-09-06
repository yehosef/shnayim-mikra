import { HebrewCalendar, HDate, months } from '@hebcal/core'
import parshiyot, { parshiyotList } from '../data/parshiyot'

/**
 * Weekly parsha resolution.
 *
 * Rules
 *  - The target is the NEXT Shabbat (today if today is Shabbat).
 *  - hebcal names are matched through the explicit `hebcalName` field in
 *    parshiyot.js, after normalising apostrophes on both sides (hebcal emits
 *    "Ha'azinu", "Sh'lach", "Re'eh", "Beha'alotcha").
 *  - Chag Shabbatot (Sedra returns `chag: true`) walk forward a week at a
 *    time, at most 6 tries, each date resolved in its own Hebrew year.
 *  - Between Yom Kippur and Hoshana Rabbah the week belongs to Vezot
 *    Haberachah unless a regular parsha Shabbat (Ha'azinu) still lies ahead
 *    before Sukkot. Sedra never returns Vezot Haberachah on its own.
 *  - Combined weeks (e.g. Matot-Masei) resolve to the combined route; if a
 *    combined route were ever missing, the first single is used.
 */

const normalize = (s) => String(s).toLowerCase().replace(/['‘’]/g, '').replace(/\s+/g, '-')

const routeBySingle = {}
const routeByCombined = {}
for (const [route, def] of Object.entries(parshiyot)) {
  const name = def.hebcalName
  if (Array.isArray(name)) routeByCombined[name.map(normalize).join('|')] = route
  else routeBySingle[normalize(name)] = route
}

/** hebcal parsha name array -> route key, or null */
export function resolveParshaRoute(names) {
  if (!Array.isArray(names) || names.length === 0) return null
  const norm = names.map(normalize)
  if (norm.length > 1) {
    const combined = routeByCombined[norm.join('|')]
    if (combined) return combined
  }
  for (const n of norm) {
    if (routeBySingle[n]) return routeBySingle[n]
  }
  return null
}

const SHABBAT = 6
const MAX_WALK = 6

/**
 * Resolve the parsha week containing `date`.
 * @param {HDate|Date} date
 * @param {boolean} il
 * @returns {{ route: string, shabbat: HDate }}
 */
export function resolveWeek(date, il) {
  const hd = date instanceof HDate ? date : new HDate(date)
  let shabbat = hd.onOrAfter(SHABBAT)

  // Vezot Haberachah window: after Yom Kippur through Hoshana Rabbah
  // (diaspora: through Shmini Atzeret, since Simchat Torah is the next day).
  if (hd.getMonth() === months.TISHREI) {
    const day = hd.getDate()
    const lastDay = il ? 21 : 22
    if (day > 10 && day <= lastDay) {
      const sukkot = new HDate(15, months.TISHREI, hd.getFullYear())
      if (shabbat.abs() < sukkot.abs()) {
        const r = lookupShabbat(shabbat, il)
        if (r) return r
      }
      return { route: 'vzot-haberachah', shabbat: new HDate(lastDay + 1, months.TISHREI, hd.getFullYear()) }
    }
  }

  for (let i = 0; i < MAX_WALK; i++) {
    const r = lookupShabbat(shabbat, il)
    if (r) return r
    shabbat = shabbat.add(7)
  }
  return { route: 'bereshit', shabbat }
}

function lookupShabbat(shabbat, il) {
  const sedra = HebrewCalendar.getSedra(shabbat.getFullYear(), il)
  const result = sedra.lookup(shabbat)
  if (!result || result.chag || !result.parsha || result.parsha.length === 0) return null
  const route = resolveParshaRoute(result.parsha)
  return route ? { route, shabbat } : null
}

export function useParsha() {
  const getWeeklyParsha = (location = 'israel') => {
    try {
      return resolveWeek(new HDate(), location === 'israel').route
    } catch (e) {
      console.error('Error getting weekly parsha:', e)
      return 'bereshit'
    }
  }

  return {
    parshiyot,
    parshiyotList,
    getWeeklyParsha,
    resolveWeek
  }
}
