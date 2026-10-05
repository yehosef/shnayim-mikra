/**
 * Yearly reading cycles.
 *
 * A cycle is one year of Torah reading, Bereshit to Vezot Haberachah, named by
 * the Hebrew year in which it begins: the cycle that began after Simchat Torah
 * on 2026-10-03 (22 Tishrei 5787, Israel) is 5787.
 *
 * Pure: @hebcal/core only. No Vue, no localStorage.
 */
import { HDate, months } from '@hebcal/core'

/**
 * Upgrade rule for marks that already exist when this release first runs
 * (routes with marks but no cycle label yet). Fixed in the code, never taken
 * from the device clock, so two devices upgrading on different days label the
 * same old marks the same way.
 *
 * These two constants describe the release week of 2026-10-05: Bereshit's 5787
 * week has begun, so its marks are this cycle's; every other route's marks are
 * from 5786 and get archived on first run (Vezot Haberachah only once its
 * catch-up days end). If the release happens after 2026-10-10, add 'noach' to
 * UPGRADE_CURRENT_ROUTES.
 */
export const UPGRADE_CURRENT_ROUTES = ['bereshit']
export const UPGRADE_CURRENT_YEAR = 5787
export const UPGRADE_PREVIOUS_YEAR = UPGRADE_CURRENT_YEAR - 1

/** Label the upgrade rule gives pre-existing marks of `route`. */
export function upgradeYearOf(route) {
  return UPGRADE_CURRENT_ROUTES.includes(route) ? UPGRADE_CURRENT_YEAR : UPGRADE_PREVIOUS_YEAR
}

const SHABBAT = 6
/** Sunday(0) .. Tuesday(2): the same lenient window as resolveDefaultWeek. */
const LATE_LAST_DAY = 2

/**
 * The cycle a mark made on `date` belongs to, for `route`.
 *
 * Every route switches to the new cycle the day after Simchat Torah (22
 * Tishrei in Israel, 23 in the diaspora). The exception is `vzot-haberachah`:
 * through the catch-up days that resolveDefaultWeek (src/composables/
 * useParsha.js) still offers it as last week's unfinished parsha — Sunday to
 * Tuesday, at most three days after Simchat Torah, with no Shabbat in between
 * — it stays in the ending cycle. tests/cycle.test.js checks the two agree on
 * every day of 5786–5795.
 *
 * @param {string} route
 * @param {HDate|Date} date
 * @param {boolean} il
 * @param {number} [jewishDay] 0..6, the sunset-adjusted day the app uses
 *   (jewishDayOfWeek). When it is the civil day + 1 the date moves forward a
 *   day, exactly as in resolveDefaultWeek.
 * @returns {number} Hebrew year naming the cycle
 */
export function cycleOf(route, date, il, jewishDay) {
  let hd = date instanceof HDate ? date : new HDate(date)
  if (jewishDay === (hd.getDay() + 1) % 7) hd = hd.add(1)
  const year = hd.getFullYear()
  if (hd.getMonth() !== months.TISHREI) return year

  const simchatTorah = new HDate(il ? 22 : 23, months.TISHREI, year)
  const since = hd.abs() - simchatTorah.abs()
  if (since <= 0) return year - 1

  if (
    route === 'vzot-haberachah' &&
    since <= LATE_LAST_DAY + 1 &&
    hd.getDay() <= LATE_LAST_DAY &&
    hd.onOrBefore(SHABBAT).abs() <= simchatTorah.abs()
  ) {
    return year - 1
  }
  return year
}
