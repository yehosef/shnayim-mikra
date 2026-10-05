/**
 * Which parsha routes share verses.
 *
 * Verse keys in `shnayim-progress` are absolute "perek:pasuk" (0-indexed)
 * inside a chumash, so a combined route (e.g. `matot-masei`) and its two
 * singles (`matot`, `masei`) store the same verse under the same key. Reading
 * a verse under one of them counts for all of them: every mark or un-mark is
 * written to every route whose range contains that verse, and clearing a route
 * clears the same verses in the routes that overlap it.
 *
 * Everything here is derived from `start` / `end` in parshiyot.js. Pure: no Vue,
 * no localStorage.
 */
import parshiyot from '../data/parshiyot.js'

const FIELDS = ['hebrew1', 'hebrew2', 'targum']

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1]

/** "perek:pasuk" -> [perek, pasuk], or null for anything else. */
export function parseVerseKey(key) {
  const m = /^(\d+):(\d+)$/.exec(String(key))
  return m ? [Number(m[1]), Number(m[2])] : null
}

/** Is the verse key inside the route's range? */
export function routeContains(route, verseKey) {
  const def = parshiyot[route]
  const pos = parseVerseKey(verseKey)
  if (!def || !pos) return false
  return cmp(def.start, pos) <= 0 && cmp(pos, def.end) <= 0
}

/** Is `inner`'s whole range inside `outer`'s (same chumash)? */
export function rangeInside(inner, outer) {
  const a = parshiyot[inner]
  const b = parshiyot[outer]
  if (!a || !b || a.chumash !== b.chumash) return false
  return cmp(b.start, a.start) <= 0 && cmp(a.end, b.end) <= 0
}

const overlapMap = (() => {
  const out = {}
  const routes = Object.keys(parshiyot)
  for (const r of routes) out[r] = []
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const a = parshiyot[routes[i]]
      const b = parshiyot[routes[j]]
      if (a.chumash !== b.chumash) continue
      if (cmp(a.start, b.end) <= 0 && cmp(b.start, a.end) <= 0) {
        out[routes[i]].push(routes[j])
        out[routes[j]].push(routes[i])
      }
    }
  }
  return out
})()

/** Routes that share at least one verse with `route` (never `route` itself). */
export function overlappingRoutes(route) {
  return overlapMap[route] ? [...overlapMap[route]] : []
}

/**
 * Every route a write to (route, verseKey) must land in: `route` itself first
 * (always, so a key outside its range still behaves as it did before), then
 * every overlapping route whose range contains the verse.
 */
export function routesForVerse(route, verseKey) {
  const others = (overlapMap[route] || []).filter(r => routeContains(r, verseKey))
  return [route, ...others]
}

/**
 * The connected set of routes that share verses with `route`, including it,
 * in parshiyot.js order. A single route with no partner is its own group.
 * Overlapping routes carry one cycle label and are archived together.
 */
export function overlapGroup(route) {
  const seen = new Set([route])
  const stack = [route]
  while (stack.length) {
    for (const r of overlapMap[stack.pop()] || []) {
      if (!seen.has(r)) {
        seen.add(r)
        stack.push(r)
      }
    }
  }
  const order = Object.keys(parshiyot)
  return [...seen].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/**
 * How "start this parsha over" on `route` touches the other routes:
 *  - `whole`: `route` and every route lying entirely inside it (combined ->
 *    both singles). These are cleared as whole routes.
 *  - `partial`: routes that contain some of `route`'s verses but extend past
 *    it (single -> the combined route). Only the shared verses are cleared,
 *    as field writes, so the rest of that route survives.
 */
export function clearTargets(route) {
  const whole = [route]
  const partial = []
  for (const r of overlapMap[route] || []) {
    if (rangeInside(r, route)) whole.push(r)
    else partial.push(r)
  }
  return { whole, partial }
}

/**
 * Field writes (all false) that clear `route`'s verses inside the routes it
 * only partly overlaps. Only verse keys present in `progress` are listed —
 * an absent record already reads as unread.
 * @returns {Array<[string, string, string]>} [route, verseKey, field]
 */
export function partialClearWrites(progress, route) {
  const out = []
  for (const r of clearTargets(route).partial) {
    for (const verseKey of Object.keys(progress?.[r] || {})) {
      if (!routeContains(route, verseKey)) continue
      for (const field of FIELDS) out.push([r, verseKey, field])
    }
  }
  return out
}

/**
 * One-time fill-in: every `true` field that exists under one route but is
 * missing (or false) under an overlapping route that contains the same verse.
 * Union, never un-marks.
 * @returns {Array<[string, string, string]>} [route, verseKey, field] to set true
 */
export function fillInWrites(progress) {
  const out = []
  const seen = new Set()
  for (const [route, verses] of Object.entries(progress || {})) {
    if (!overlapMap[route]?.length || !verses || typeof verses !== 'object') continue
    for (const [verseKey, record] of Object.entries(verses)) {
      for (const field of FIELDS) {
        if (record?.[field] !== true) continue
        for (const r of routesForVerse(route, verseKey)) {
          if (r === route || progress[r]?.[verseKey]?.[field] === true) continue
          const id = `${r}|${verseKey}|${field}`
          if (seen.has(id)) continue
          seen.add(id)
          out.push([r, verseKey, field])
        }
      }
    }
  }
  return out
}
