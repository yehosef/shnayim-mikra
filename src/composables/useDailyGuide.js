import { ref, computed, toValue, onScopeDispose, getCurrentScope } from 'vue'
import { HDate, Location, Zmanim, months } from '@hebcal/core'
import { dailyGuide, urgency } from '../lib/progressMath'

/**
 * Advisory daily guide: which aliyot the traditional schedule suggests for
 * today, and how urgent this week's reading is. Never gates anything — every
 * value here is a label. See progressMath.js for the invariant.
 */

const JERUSALEM = Location.lookup('Jerusalem')

/**
 * 0=Sunday .. 6=Shabbat. The Jewish day rolls at sunset: in Israel we use
 * Jerusalem sunset; elsewhere we fall back to the civil day (no city known).
 */
export function jewishDayOfWeek(now, location = 'israel') {
  let day = now.getDay()
  if (location === 'israel') {
    try {
      const sunset = new Zmanim(JERUSALEM, now, false).sunset()
      if (sunset && now > sunset) day = (day + 1) % 7
    } catch (e) {
      // civil-day fallback
    }
  }
  return day
}

/** Hoshana Rabbah (21 Tishrei) of the Hebrew year containing `shabbat`, as a civil Date. */
export function hoshanaRabbahFor(shabbat) {
  const hd = shabbat instanceof HDate ? shabbat : new HDate(shabbat)
  return new HDate(21, months.TISHREI, hd.getFullYear()).greg()
}

/**
 * @param {() => number}     aliyahCount
 * @param {() => HDate|Date} shabbat      the Shabbat this parsha is read on
 * @param {() => string}     route
 * @param {() => string}     location     'israel' | 'chul'
 */
export function useDailyGuide({ aliyahCount, shabbat, route, location }) {
  const now = ref(new Date())
  const timer = setInterval(() => { now.value = new Date() }, 60 * 1000)
  if (getCurrentScope()) onScopeDispose(() => clearInterval(timer))

  const day = computed(() => jewishDayOfWeek(now.value, toValue(location)))

  const guide = computed(() => {
    const count = toValue(aliyahCount)
    if (!count) return { aliyot: [], review: false }
    return dailyGuide(day.value, count)
  })

  const status = computed(() => {
    const sh = toValue(shabbat)
    if (!sh) return null
    const shDate = sh instanceof HDate ? sh.greg() : new Date(sh)
    const civilMidnight = new Date(shDate.getFullYear(), shDate.getMonth(), shDate.getDate())
    const opts = {}
    if (toValue(route) === 'vzot-haberachah') {
      const hr = hoshanaRabbahFor(sh)
      opts.deadline = new Date(hr.getFullYear(), hr.getMonth(), hr.getDate())
    }
    return urgency(now.value, civilMidnight, opts)
  })

  return { now, day, guide, status }
}
