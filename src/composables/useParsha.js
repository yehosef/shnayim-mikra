import { HebrewCalendar, HDate, months } from '@hebcal/core'
import parshiyot, { parshiyotList } from '../data/parshiyot'
import { jewishDayOfWeek } from './useDailyGuide'

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
 *  - Through Hoshana Rabbah the week belongs to Vezot Haberachah as soon as no
 *    regular parsha Shabbat (Shabbat Shuva / Ha'azinu) is left before Sukkot.
 *    Sedra never returns Vezot Haberachah on its own.
 *  - resolveDefaultWeek() wraps this with the Sunday–Tuesday grace window for
 *    an unfinished previous week.
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

  // Vezot Haberachah window: opens as soon as no parsha Shabbat is left before
  // Sukkot (Shabbat Shuva / Ha'azinu already read, or only chag Shabbatot ahead)
  // and runs through Hoshana Rabbah (diaspora: through Shmini Atzeret, since
  // Simchat Torah is the next day). Keying on `day > 10` instead made 4–10
  // Tishrei of a Yom-Kippur-on-Shabbat year resolve forward to Bereshit and
  // then jump backwards to Vezot Haberachah on 11 Tishrei.
  if (hd.getMonth() === months.TISHREI) {
    const lastDay = il ? 21 : 22
    if (hd.getDate() <= lastDay) {
      const year = hd.getFullYear()
      const sukkot = new HDate(15, months.TISHREI, year)
      for (let s = shabbat; s.abs() < sukkot.abs(); s = s.add(7)) {
        const r = lookupShabbat(s, il)
        if (r) return r
      }
      return { route: 'vzot-haberachah', shabbat: new HDate(lastDay + 1, months.TISHREI, year) }
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

const MAX_BACK = 3
/** Sunday(0) .. Tuesday(2): the lenient window for finishing last week's parsha. */
const LATE_LAST_DAY = 2

/**
 * The week the app should open on, honouring the lenient "finish it by
 * Tuesday" window.
 *
 * `next` is the coming Shabbat's week (resolveWeek, unchanged). `previous` is
 * the week that just ended — the Shabbat before `next`'s, walked back further
 * while it still resolves to the same route (a chag walk-forward, or the Vezot
 * Haberachah window, can map several Shabbatot onto one parsha).
 *
 * Sunday through the end of Tuesday, an unfinished `previous` stays the default
 * (`late: true`); otherwise the default is `next`.
 *
 * Two guards keep that window honest:
 *  - `previous` must be the reading of the week that JUST ended, i.e. its
 *    Shabbat is at most `LATE_LAST_DAY + 1` days back. When a chag Shabbat puts
 *    two weeks between parsha Shabbatot (every Chol HaMoed Pesach and Sukkot,
 *    and Rosh Hashana on Shabbat), `previous` is 8–17 days old and its own
 *    urgency is already 'past'; without this the default rolled BACKWARDS on
 *    the Sunday and forwards again on the Wednesday.
 *  - `jewishDay` (optional, 0=Sunday..6=Shabbat) lets the caller hand in the
 *    sunset-adjusted day the daily guide uses, so both agree on "Tuesday". It
 *    may only be the civil day or the civil day + 1; when it is + 1 the whole
 *    resolution moves to the next date, so the coming Shabbat rolls with it.
 *
 * @param {HDate|Date} date
 * @param {boolean} il
 * @param {(route: string) => boolean} [isComplete] missing => treated as done
 * @param {number} [jewishDay] 0..6; defaults to the civil day of `date`
 * @returns {{ route: string, shabbat: HDate, late: boolean, previous: object, next: object }}
 */
export function resolveDefaultWeek(date, il, isComplete, jewishDay) {
  const done = typeof isComplete === 'function' ? isComplete : () => true
  let hd = date instanceof HDate ? date : new HDate(date)
  // After sunset the Jewish day has already rolled over while `date` has not.
  if (jewishDay === (hd.getDay() + 1) % 7) hd = hd.add(1)
  const next = resolveWeek(hd, il)

  let previous = next
  for (let i = 1; i <= MAX_BACK; i++) {
    previous = resolveWeek(next.shabbat.subtract(7 * i), il)
    if (previous.route !== next.route) break
  }

  const sincePrevious = hd.abs() - previous.shabbat.abs()
  const late =
    hd.getDay() <= LATE_LAST_DAY &&
    sincePrevious >= 0 &&
    sincePrevious <= LATE_LAST_DAY + 1 &&
    previous.route !== next.route &&
    !done(previous.route)
  const chosen = late ? previous : next
  return { route: chosen.route, shabbat: chosen.shabbat, late, previous, next }
}

export function useParsha() {
  const getDefaultWeek = (location = 'israel', isComplete) => {
    try {
      // Same sunset-adjusted day the daily guide runs on, so the header cannot
      // show "today: Wednesday" while the week is still pinned to Tuesday.
      const now = new Date()
      return resolveDefaultWeek(now, location === 'israel', isComplete, jewishDayOfWeek(now, location))
    } catch (e) {
      console.error('Error getting weekly parsha:', e)
      return { route: 'bereshit', shabbat: null, late: false, previous: null, next: null }
    }
  }

  const getWeeklyParsha = (location = 'israel', isComplete) =>
    getDefaultWeek(location, isComplete).route

  return {
    parshiyot,
    parshiyotList,
    getWeeklyParsha,
    getDefaultWeek,
    resolveWeek,
    resolveDefaultWeek
  }
}
