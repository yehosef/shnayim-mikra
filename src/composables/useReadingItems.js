/**
 * Reading Items Generator
 * Converts parsha verses into a linear list of reading items
 * Supports two approaches: pasuk-by-pasuk or aliyah-by-aliyah
 */

import { ref, computed } from 'vue'

export function useReadingItems() {
  const items = ref([])
  const aliyotByParsha = ref({})

  /**
   * Extract aliyot boundaries from verse objects
   * Verses already have .aliya property set by useData
   */
  function extractAliyotFromVerses(verses) {
    const aliyot = {}
    let currentAliyahNum = 1
    let currentAliyahStart = null
    let currentAliyahVerses = []

    verses.forEach((verse, idx) => {
      // Check if this verse starts a new aliyah (has .aliya property)
      if (verse.aliya) {
        // Save previous aliyah if it has verses
        if (currentAliyahVerses.length > 0) {
          aliyot[currentAliyahNum] = {
            num: currentAliyahNum,
            start: currentAliyahStart,
            end: {
              perek: currentAliyahVerses[currentAliyahVerses.length - 1].perekNum,
              pasuk: currentAliyahVerses[currentAliyahVerses.length - 1].pasukNum
            },
            verses: [...currentAliyahVerses]
          }
        }

        // Start new aliyah
        currentAliyahNum++
        currentAliyahStart = { perek: verse.perekNum, pasuk: verse.pasukNum }
        currentAliyahVerses = [verse]
      } else {
        // Add verse to current aliyah
        currentAliyahVerses.push(verse)
      }
    })

    // Save final aliyah
    if (currentAliyahVerses.length > 0) {
      aliyot[currentAliyahNum] = {
        num: currentAliyahNum,
        start: currentAliyahStart,
        end: {
          perek: currentAliyahVerses[currentAliyahVerses.length - 1].perekNum,
          pasuk: currentAliyahVerses[currentAliyahVerses.length - 1].pasukNum
        },
        verses: [...currentAliyahVerses]
      }
    }

    return aliyot
  }

  /**
   * Generate reading items for pasuk-by-pasuk approach
   * Returns: [torah-1, torah-2, targum] for each verse
   */
  function generatePasukByPasukItems(parsha, verses, aliyot) {
    const readingItems = []
    let itemIndex = 0

    verses.forEach((verse) => {
      const aliyahNum = findAliyahForVerse(verse, aliyot)
      const verseLabel = `${verse.perek}:${verse.pasuk}`

      // Torah first reading
      readingItems.push({
        id: `${parsha}-p${verse.perekNum}-v${verse.pasukNum}-torah-1`,
        index: itemIndex++,
        aliyahNum,
        perek: verse.perekNum,
        pasuk: verse.pasukNum,
        verses: [verse],
        type: 'torah',
        iteration: 1,
        label: `${verseLabel}, תורה (ראשון)`,
        labelEn: `${verseLabel}, Torah (1st)`
      })

      // Torah second reading
      readingItems.push({
        id: `${parsha}-p${verse.perekNum}-v${verse.pasukNum}-torah-2`,
        index: itemIndex++,
        aliyahNum,
        perek: verse.perekNum,
        pasuk: verse.pasukNum,
        verses: [verse],
        type: 'torah',
        iteration: 2,
        label: `${verseLabel}, תורה (שני)`,
        labelEn: `${verseLabel}, Torah (2nd)`
      })

      // Targum reading
      readingItems.push({
        id: `${parsha}-p${verse.perekNum}-v${verse.pasukNum}-targum-1`,
        index: itemIndex++,
        aliyahNum,
        perek: verse.perekNum,
        pasuk: verse.pasukNum,
        verses: [verse],
        type: 'targum',
        iteration: 1,
        label: `${verseLabel}, תרגום`,
        labelEn: `${verseLabel}, Targum`
      })
    })

    return readingItems
  }

  /**
   * Generate reading items for aliyah-by-aliyah approach
   * Returns: [torah-1, torah-2, targum] for each aliyah
   */
  function generateAliyahByAliyahItems(parsha, aliyot) {
    const readingItems = []
    let itemIndex = 0

    Object.values(aliyot).forEach((aliyah) => {
      const aliyahLabel = `עלייה ${aliyah.num}`
      const aliyahLabelEn = `Aliyah ${aliyah.num}`

      // Torah first reading
      readingItems.push({
        id: `${parsha}-a${aliyah.num}-torah-1`,
        index: itemIndex++,
        aliyahNum: aliyah.num,
        startPerek: aliyah.start.perek,
        startPasuk: aliyah.start.pasuk,
        endPerek: aliyah.end.perek,
        endPasuk: aliyah.end.pasuk,
        verses: aliyah.verses,
        type: 'torah',
        iteration: 1,
        label: `${aliyahLabel}, תורה (ראשון)`,
        labelEn: `${aliyahLabelEn}, Torah (1st)`
      })

      // Torah second reading
      readingItems.push({
        id: `${parsha}-a${aliyah.num}-torah-2`,
        index: itemIndex++,
        aliyahNum: aliyah.num,
        startPerek: aliyah.start.perek,
        startPasuk: aliyah.start.pasuk,
        endPerek: aliyah.end.perek,
        endPasuk: aliyah.end.pasuk,
        verses: aliyah.verses,
        type: 'torah',
        iteration: 2,
        label: `${aliyahLabel}, תורה (שני)`,
        labelEn: `${aliyahLabelEn}, Torah (2nd)`
      })

      // Targum reading
      readingItems.push({
        id: `${parsha}-a${aliyah.num}-targum-1`,
        index: itemIndex++,
        aliyahNum: aliyah.num,
        startPerek: aliyah.start.perek,
        startPasuk: aliyah.start.pasuk,
        endPerek: aliyah.end.perek,
        endPasuk: aliyah.end.pasuk,
        verses: aliyah.verses,
        type: 'targum',
        iteration: 1,
        label: `${aliyahLabel}, תרגום`,
        labelEn: `${aliyahLabelEn}, Targum`
      })
    })

    return readingItems
  }

  /**
   * Find which aliyah a verse belongs to
   */
  function findAliyahForVerse(verse, aliyot) {
    for (const [aliyahNum, aliyah] of Object.entries(aliyot)) {
      const inRange = aliyah.verses.some(
        (v) => v.perekNum === verse.perekNum && v.pasukNum === verse.pasukNum
      )
      if (inRange) return parseInt(aliyahNum)
    }
    return 1 // Default to first aliyah
  }

  /**
   * Generate reading items based on approach
   * @param {string} parsha - Parsha name (e.g., 'bereshit')
   * @param {Array} verses - Array of verse objects from useData
   * @param {string} approach - 'pasuk' or 'aliyah'
   * @returns {Array} Reading items
   */
  async function generateItems(parsha, verses, approach = 'pasuk') {
    if (!verses || verses.length === 0) {
      console.warn('generateItems: No verses provided')
      return []
    }

    try {
      // Extract aliyot from verses
      const aliyot = extractAliyotFromVerses(verses)
      aliyotByParsha.value[parsha] = aliyot

      // Generate items based on approach
      let readingItems
      if (approach === 'aliyah') {
        readingItems = generateAliyahByAliyahItems(parsha, aliyot)
      } else {
        // Default to pasuk-by-pasuk
        readingItems = generatePasukByPasukItems(parsha, verses, aliyot)
      }

      items.value = readingItems
      return readingItems
    } catch (e) {
      console.error(`Error generating reading items for ${parsha}:`, e)
      return []
    }
  }

  /**
   * Get a reading item by ID
   */
  function getItemById(itemId) {
    return items.value.find((item) => item.id === itemId)
  }

  /**
   * Get all reading items for a specific aliyah
   */
  function getItemsByAliyah(aliyahNum) {
    return items.value.filter((item) => item.aliyahNum === aliyahNum)
  }

  /**
   * Get aliyot data for a parsha
   */
  function getAliyotData(parsha) {
    return aliyotByParsha.value[parsha] || {}
  }

  /**
   * Get next item after a given item
   */
  function getNextItem(currentItemId) {
    const currentIdx = items.value.findIndex((i) => i.id === currentItemId)
    if (currentIdx >= 0 && currentIdx < items.value.length - 1) {
      return items.value[currentIdx + 1]
    }
    return null
  }

  /**
   * Get previous item before a given item
   */
  function getPreviousItem(currentItemId) {
    const currentIdx = items.value.findIndex((i) => i.id === currentItemId)
    if (currentIdx > 0) {
      return items.value[currentIdx - 1]
    }
    return null
  }

  /**
   * Get item by index
   */
  function getItemByIndex(index) {
    return items.value[index] || null
  }

  /**
   * Get total number of items
   */
  function getTotalItems() {
    return items.value.length
  }

  /**
   * Get items for a specific aliyah and type (torah/targum)
   */
  function getItemsForAliyahType(aliyahNum, type) {
    return items.value.filter((item) => item.aliyahNum === aliyahNum && item.type === type)
  }

  return {
    items: computed(() => items.value),
    generateItems,
    getItemById,
    getItemsByAliyah,
    getAliyotData,
    getNextItem,
    getPreviousItem,
    getItemByIndex,
    getTotalItems,
    getItemsForAliyahType
  }
}
