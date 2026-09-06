import { ref } from 'vue'

/**
 * Aliyah boundaries, generated at build time by scripts/generate-aliyot.js
 * from @hebcal/leyning into public/data/aliyot.json. Never hand-edited.
 *
 * Shape: { [route]: { book, aliyot: [{ n, start:[p,v], end:[p,v], verseCount }], total } }
 * perek/pasuk are 0-indexed, ranges inclusive, maftir folded into aliyah 7.
 */

// Module-level singleton so every component shares one fetch.
const aliyotData = ref(null)
const aliyotError = ref(null)
let inflight = null

export async function loadAliyot() {
  if (aliyotData.value) return aliyotData.value
  if (!inflight) {
    inflight = fetch('/data/aliyot.json')
      .then(r => {
        const ct = r.headers.get('content-type') || ''
        if (!r.ok || !ct.includes('json')) throw new Error(`Failed to load /data/aliyot.json (${r.status})`)
        return r.json()
      })
      .then(json => {
        aliyotData.value = json
        return json
      })
      .catch(e => {
        aliyotError.value = e.message
        inflight = null
        throw e
      })
  }
  return inflight
}

/** -1 / 0 / 1 comparison of two [perek, pasuk] positions. */
export function comparePos(a, b) {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1
  return 0
}

/** True when [perek, pasuk] lies inside the aliyah's inclusive range. */
export function verseInAliyah(aliyah, perek, pasuk) {
  if (!aliyah) return false
  const pos = [perek, pasuk]
  return comparePos(pos, aliyah.start) >= 0 && comparePos(pos, aliyah.end) <= 0
}

/** The aliyah object containing the verse, or null. */
export function aliyahFor(entry, perek, pasuk) {
  if (!entry) return null
  return entry.aliyot.find(a => verseInAliyah(a, perek, pasuk)) || null
}

export function useAliyot() {
  if (!aliyotData.value && !inflight) {
    loadAliyot().catch(e => console.error('aliyot.json:', e))
  }

  const getAliyot = (route) => aliyotData.value?.[route] || null

  return {
    aliyotData,
    aliyotError,
    getAliyot,
    verseInAliyah,
    aliyahFor
  }
}
