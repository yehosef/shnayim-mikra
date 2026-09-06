import { ref } from 'vue'
import parshiyot from '../data/parshiyot'
import { toHebrew } from '../utils/hebrewUtils'

/** Fetch a data JSON; vercel rewrites missing files to index.html with 200, so check content-type too. */
async function fetchJson(url) {
  const r = await fetch(url)
  const ct = r.headers.get('content-type') || ''
  if (!r.ok || !ct.includes('json')) {
    throw new Error(`Failed to load ${url} (${r.status} ${ct || 'no content-type'})`)
  }
  return r.json()
}

// Module-level cache: keyed by chumash name, stores fetched JSON data
const chumashCache = new Map()

export function useData() {
  const loading = ref(false)
  const error = ref(null)
  const data = ref([])
  const chapterLengths = ref([]) // verse count per chapter of the loaded chumash

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

      // Fetch base data (torah, targum, english) only if not cached
      if (!cached) {
        const [torahData, targumData, englishData] = await Promise.all([
          fetchJson(`/data/torah/${chumash}.json`),
          fetchJson(`/data/targum/${chumash}.json`),
          fetchJson(`/data/english/${chumash}.json`)
        ])
        cached = { torahData, targumData, englishData, rashiData: null }
        chumashCache.set(chumash, cached)
      }

      // Fetch rashi data only if needed and not already cached for this chumash
      if (showRashi && !cached.rashiData) {
        cached.rashiData = await fetchJson(`/data/rashi/${chumash}.json`)
      }

      const { torahData, targumData, englishData } = cached
      const rashiData = showRashi ? cached.rashiData : { text: [] }

      // Extract verses for this parsha
      const verses = []
      const [startPerek, startPasuk] = parshaDef.start
      const [endPerek, endPasuk] = parshaDef.end

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
            perek: null
          }

          // Add perek marker for first verse of chapter
          if (pasuk === 0) {
            verse.perek = toHebrew(perek + 1)
          }

          // Add rashi if requested
          if (showRashi && rashiData.text[perek]?.[pasuk]) {
            verse.rashi = rashiData.text[perek][pasuk]
          }

          verses.push(verse)
        }
      }

      chapterLengths.value = torahData.text.map(ch => ch.length)
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

  return {
    loading,
    error,
    data,
    chapterLengths,
    loadParsha
  }
}
