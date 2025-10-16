import { HebrewCalendar, Location } from '@hebcal/core'
import parshiyot, { parshiyotList } from '../data/parshiyot'

export function useParsha() {
  const getWeeklyParsha = (location = 'israel') => {
    try {
      const il = location === 'israel'
      // Use current year but clamp to valid range
      const year = Math.min(new Date().getFullYear(), 2024)
      const sedra = HebrewCalendar.getSedra(year, il)
      const today = new Date(year, new Date().getMonth(), new Date().getDate())
      const parsha = sedra.lookup(today)

      if (!parsha.parsha || parsha.parsha.length === 0) {
        return 'bereshit'
      }

      const parshaNames = parsha.parsha.map(p => p.toLowerCase().replace(/'/g, '-').replace(/ /g, '-'))
      const parshaName = parshaNames.join('-')

      // Try to find exact match first
      if (parshiyot[parshaName]) {
        return parshaName
      }

      // Try individual parshiyot if combined not found
      for (const name of parshaNames) {
        if (parshiyot[name]) {
          return name
        }
      }

      return 'bereshit'
    } catch (e) {
      console.error('Error getting weekly parsha:', e)
      return 'bereshit'
    }
  }

  return {
    parshiyot,
    parshiyotList,
    getWeeklyParsha
  }
}
