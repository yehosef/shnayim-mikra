/**
 * Daily Aliyah Helper
 * Integrates with @hebcal/core to determine daily Torah study schedule
 * Follows traditional weekly aliyah distribution
 */

import { HDate } from '@hebcal/core'

export function useDailyAliyah() {
  /**
   * Get aliyot recommended for today based on Jewish calendar
   * Monday-Friday: specific aliyot for each day
   * Shabbat/Sunday: null (review day)
   */
  function getTodaysAliyah() {
    try {
      const hebrewDate = new HDate()
      const dayOfWeek = hebrewDate.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday

      // Traditional weekly schedule:
      // Monday: Aliyot 1-2
      // Tuesday: Aliyah 3
      // Wednesday: Aliyah 4
      // Thursday: Aliyah 5
      // Friday: Aliyot 6-7
      // Shabbat/Sunday: Review (no new aliyot)

      const schedule = {
        1: [1, 2], // Monday
        2: [3], // Tuesday
        3: [4], // Wednesday
        4: [5], // Thursday
        5: [6, 7], // Friday
      }

      return schedule[dayOfWeek] || null // null on Shabbat (6) or Sunday (0)
    } catch (e) {
      console.error('Error getting todays aliyah:', e)
      return null
    }
  }

  /**
   * Get day name in Hebrew
   */
  function getDayName(dayOfWeek) {
    const names = {
      0: 'ראשון', // Sunday
      1: 'שני', // Monday
      2: 'שלישי', // Tuesday
      3: 'רביעי', // Wednesday
      4: 'חמישי', // Thursday
      5: 'שישי', // Friday
      6: 'שבת', // Saturday
    }
    return names[dayOfWeek] || 'יום'
  }

  /**
   * Get Hebrew date as formatted string
   */
  function getHebrewDateString() {
    try {
      const hebrewDate = new HDate()
      return hebrewDate.render('he')
    } catch (e) {
      return 'תאריך'
    }
  }

  /**
   * Check if a specific aliyah was completed
   */
  function isAliyahCompleted(aliyahNum, completedItemIds, allItems) {
    if (!completedItemIds || !allItems) return false

    // Get all items for this aliyah
    const aliyahItems = allItems.filter((item) => item.aliyahNum === aliyahNum)
    if (aliyahItems.length === 0) return false

    // Check if all aliyah items are completed
    return aliyahItems.every((item) => completedItemIds.includes(item.id))
  }

  /**
   * Get incomplete aliyot
   */
  function getIncompleteAliyot(completedItemIds, allItems) {
    if (!allItems || allItems.length === 0) return []

    const aliyotMap = {}

    // Group items by aliyah
    allItems.forEach((item) => {
      if (!aliyotMap[item.aliyahNum]) {
        aliyotMap[item.aliyahNum] = { total: 0, completed: 0 }
      }
      aliyotMap[item.aliyahNum].total++

      if (completedItemIds && completedItemIds.includes(item.id)) {
        aliyotMap[item.aliyahNum].completed++
      }
    })

    // Find incomplete aliyot
    return Object.entries(aliyotMap)
      .filter(([, progress]) => progress.completed < progress.total)
      .map(([num]) => parseInt(num))
      .sort((a, b) => a - b)
  }

  /**
   * Check if yesterday's aliyah is incomplete
   * Useful for showing "you didn't finish yesterday" warning
   */
  function showYesterdayWarning(completedItemIds, allItems) {
    try {
      const today = new HDate()
      const todayMs = today.greg().getTime()
      const yesterday = new HDate(new Date(todayMs - 24 * 60 * 60 * 1000))
      const yesterdayDay = yesterday.getDay()

      // Get yesterday's expected aliyot
      const schedule = {
        1: [1, 2], // Monday
        2: [3], // Tuesday
        3: [4], // Wednesday
        4: [5], // Thursday
        5: [6, 7], // Friday
      }

      const expectedAliyot = schedule[yesterdayDay]
      if (!expectedAliyot) {
        // Yesterday was Shabbat or Sunday (no expected reading)
        return null
      }

      // Check which aliyot are incomplete
      const incomplete = getIncompleteAliyot(completedItemIds, allItems)
      const missedAliyot = expectedAliyot.filter((a) => incomplete.includes(a))

      if (missedAliyot.length > 0) {
        return {
          show: true,
          aliyot: missedAliyot,
          message: `לא הושלם אתמול: עליות ${missedAliyot.join(', ')}`,
          messageEn: `Not completed yesterday: Aliyot ${missedAliyot.join(', ')}`,
          dayName: getDayName(yesterdayDay),
        }
      }

      return null
    } catch (e) {
      console.error('Error checking yesterday warning:', e)
      return null
    }
  }

  /**
   * Get formatted string for today's aliyot
   */
  function getTodaysAliyahDisplay() {
    try {
      const todaysAliyot = getTodaysAliyah()
      if (!todaysAliyot) {
        return 'יום חזרה'
      }
      return `עליות ${todaysAliyot.join(', ')}`
    } catch (e) {
      return 'היום'
    }
  }

  /**
   * Get next aliyah to study (for manual navigation)
   */
  function getNextAliyah(currentAliyahNum, totalAliyot = 7) {
    if (currentAliyahNum < totalAliyot) {
      return currentAliyahNum + 1
    }
    return null // At last aliyah
  }

  /**
   * Get previous aliyah (for manual navigation)
   */
  function getPreviousAliyah(currentAliyahNum) {
    if (currentAliyahNum > 1) {
      return currentAliyahNum - 1
    }
    return null // At first aliyah
  }

  /**
   * Check if all aliyot are completed
   */
  function areAllAliyotCompleted(completedItemIds, allItems) {
    if (!allItems || allItems.length === 0) return false
    return completedItemIds && completedItemIds.length === allItems.length
  }

  /**
   * Get progress percentage for aliyot
   */
  function getProgressPercentage(completedItemIds, allItems) {
    if (!allItems || allItems.length === 0) return 0
    if (!completedItemIds) return 0
    return Math.round((completedItemIds.length / allItems.length) * 100)
  }

  return {
    getTodaysAliyah,
    getDayName,
    getHebrewDateString,
    isAliyahCompleted,
    getIncompleteAliyot,
    showYesterdayWarning,
    getTodaysAliyahDisplay,
    getNextAliyah,
    getPreviousAliyah,
    areAllAliyotCompleted,
    getProgressPercentage,
  }
}
