import { ref } from 'vue'
import parshiyot from '../data/parshiyot'

// Hebrew number conversion
const hebrewNumerals = {
  1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
  10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ',
  100: 'ק', 200: 'ר', 300: 'ש', 400: 'ת'
}

function toHebrew(num) {
  if (num === 0) return ''

  const hundreds = Math.floor(num / 100) * 100
  const tens = Math.floor((num % 100) / 10) * 10
  const ones = num % 10

  let result = ''
  if (hundreds > 0) result += hebrewNumerals[hundreds]
  if (tens > 0) result += hebrewNumerals[tens]
  if (ones > 0) result += hebrewNumerals[ones]

  return result
}

// Module-level cache: keyed by chumash name, stores fetched JSON data
const chumashCache = new Map()

export function useData() {
  const loading = ref(false)
  const error = ref(null)
  const data = ref([])

  const loadParsha = async (parshaName, showRashi = false) => {
    loading.value = true
    error.value = null

    try {
      const parshaDef = parshiyot[parshaName]
      if (!parshaDef) {
        throw new Error(`Parsha ${parshaName} not found`)
      }

      const chumash = parshaDef.chumash
      let cached = chumashCache.get(chumash)

      // Fetch base data (torah, targum, english, meforshim-index) only if not cached
      if (!cached) {
        const [torahData, targumData, englishData, meforshimIndexData] = await Promise.all([
          fetch(`/data/torah/${chumash}.json`).then(r => r.json()),
          fetch(`/data/targum/${chumash}.json`).then(r => r.json()),
          fetch(`/data/english/${chumash}.json`).then(r => r.json()),
          fetch(`/data/meforshim-index/${chumash}.json`).then(r => r.json()).catch(() => ({ text: [] }))
        ])
        cached = { torahData, targumData, englishData, meforshimIndexData, rashiData: null }
        chumashCache.set(chumash, cached)
      }

      // Fetch rashi data only if needed and not already cached for this chumash
      if (showRashi && !cached.rashiData) {
        cached.rashiData = await fetch(`/data/rashi/${chumash}.json`).then(r => r.json())
      }

      const { torahData, targumData, englishData, meforshimIndexData } = cached
      const rashiData = showRashi ? cached.rashiData : { text: [] }

      // Extract verses for this parsha
      const verses = []
      const [startPerek, startPasuk] = parshaDef.start
      const [endPerek, endPasuk] = parshaDef.end

      let aliyaIndex = 0
      const aliyot = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי']

      for (let perek = startPerek; perek <= endPerek; perek++) {
        const startVerse = (perek === startPerek) ? startPasuk : 0
        const perekArray = torahData.text[perek]
        if (!perekArray) {
          console.warn(`No data for perek ${perek}`)
          continue
        }
        const endVerse = (perek === endPerek) ? endPasuk : perekArray.length - 1

        for (let pasuk = startVerse; pasuk <= endVerse; pasuk++) {
          const verse = {
            torah: torahData.text[perek]?.[pasuk] || '',
            targum: targumData.text[perek]?.[pasuk] || '',
            english: englishData.text[perek]?.[pasuk] || '',
            pasuk: toHebrew(pasuk + 1),
            perekNum: perek,        // Store numeric chapter index for tracking
            pasukNum: pasuk,        // Store numeric verse index for tracking
            perek: null,
            aliya: null,
            meforshim: meforshimIndexData.text?.[perek]?.[pasuk] || []
          }

          // Add perek marker for first verse of chapter
          if (pasuk === 0) {
            verse.perek = toHebrew(perek + 1)
          }

          // Add aliya markers
          if (aliyaIndex < parshaDef.aliyot.length) {
            const [aliyaPerek, aliyaPasuk] = parshaDef.aliyot[aliyaIndex]
            if (perek === aliyaPerek && pasuk === aliyaPasuk) {
              verse.aliya = aliyot[aliyaIndex]
              aliyaIndex++
            }
          }

          // Add rashi if requested
          if (showRashi && rashiData.text[perek]?.[pasuk]) {
            verse.rashi = rashiData.text[perek][pasuk]
          }

          verses.push(verse)
        }
      }

      data.value = verses
      return verses
    } catch (e) {
      error.value = e.message
      console.error('Error loading parsha:', e)
      return []
    } finally {
      loading.value = false
    }
  }

  const loadMeforesh = async (parshaName, meforeshName) => {
    try {
      const parshaDef = parshiyot[parshaName]
      const chumash = parshaDef.chumash
      const meforeshData = await fetch(`/data/meforshim/${chumash}/${meforeshName}.json`).then(r => r.json())

      const [startPerek, startPasuk] = parshaDef.start
      const [endPerek, endPasuk] = parshaDef.end

      const result = []
      for (let perek = startPerek; perek <= endPerek; perek++) {
        const startVerse = (perek === startPerek) ? startPasuk : 0
        const endVerse = (perek === endPerek) ? endPasuk : meforeshData.text[perek]?.length - 1 || 0

        for (let pasuk = startVerse; pasuk <= endVerse; pasuk++) {
          result.push(meforeshData.text[perek]?.[pasuk] || [])
        }
      }

      return result
    } catch (e) {
      console.error('Error loading meforesh:', e)
      return []
    }
  }

  return {
    loading,
    error,
    data,
    loadParsha,
    loadMeforesh
  }
}
