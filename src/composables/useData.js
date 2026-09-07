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

/** Optional layer: null on any failure instead of throwing. */
async function fetchOptional(url) {
  try {
    return await fetchJson(url)
  } catch (e) {
    console.warn(`Optional layer unavailable: ${e.message}`)
    return null
  }
}

// Module-level cache: keyed by chumash name, stores fetched JSON data
const chumashCache = new Map()

export function useData() {
  const loading = ref(false)
  const error = ref(null)
  const data = ref([])
  const chapterLengths = ref([]) // verse count per chapter of the loaded chumash
  const loadedChumash = ref(null) // which chumash `data`/`chapterLengths` belong to
  let loadToken = 0

  /**
   * @param {string} parshaName
   * @param {boolean|{showRashi?: boolean, targumType?: string}} options
   *   Legacy boolean = showRashi. Prefer the object form: Rashi is fetched when
   *   `showRashi` is on OR `targumType === 'rashi'` (the obligation layer must be
   *   present even when the display toggle is off). English is always fetched.
   */
  const loadParsha = async (parshaName, options = {}) => {
    const opts = (typeof options === 'boolean') ? { showRashi: options } : (options || {})
    const needRashi = !!opts.showRashi || opts.targumType === 'rashi'
    const token = ++loadToken
    loading.value = true
    error.value = null

    try {
      const parshaDef = parshiyot[parshaName]
      if (!parshaDef) {
        throw new Error(`Parsha ${parshaName} not found`)
      }

      const chumash = parshaDef.chumash
      let cached = chumashCache.get(chumash)

      // Torah + Targum are required (precached by the service worker, so
      // available offline from first install). English and Rashi are optional
      // layers: if they cannot be fetched (offline, never downloaded) the
      // parsha still loads without them and we retry on the next load.
      if (!cached) {
        const [torahData, targumData] = await Promise.all([
          fetchJson(`/data/torah/${chumash}.json`),
          fetchJson(`/data/targum/${chumash}.json`)
        ])
        cached = { torahData, targumData, englishData: null, rashiData: null }
        chumashCache.set(chumash, cached)
      }

      if (!cached.englishData) {
        cached.englishData = await fetchOptional(`/data/english/${chumash}.json`)
      }

      // Fetch rashi data only if needed and not already cached for this chumash
      if (needRashi && !cached.rashiData) {
        cached.rashiData = await fetchOptional(`/data/rashi/${chumash}.json`)
      }

      // A newer loadParsha() call superseded this one: drop the result
      if (token !== loadToken) return []

      const { torahData, targumData } = cached
      const englishData = cached.englishData || { text: [] }
      const rashiData = (needRashi && cached.rashiData) || { text: [] }

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

          // Add rashi if requested (display toggle or targumType === 'rashi')
          if (needRashi && rashiData.text[perek]?.[pasuk]) {
            verse.rashi = rashiData.text[perek][pasuk]
          }

          verses.push(verse)
        }
      }

      chapterLengths.value = torahData.text.map(ch => ch.length)
      loadedChumash.value = chumash
      data.value = verses
      return verses
    } catch (e) {
      if (token !== loadToken) return []
      error.value = e.message
      console.error('Error loading parsha:', e)
      return []
    } finally {
      if (token === loadToken) loading.value = false
    }
  }

  return {
    loading,
    error,
    data,
    chapterLengths,
    loadedChumash,
    loadParsha
  }
}
