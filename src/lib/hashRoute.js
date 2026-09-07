/**
 * The URL fragment is the app's only routing input, and it is user-supplied:
 * it can name a parsha that does not exist (a typo, a stale link, an
 * autocompleted fragment from an older build). Resolving it here — pure and
 * DOM-free, so tests/hash-route.test.js covers it in the node env — lets
 * App.vue fall back to the weekly default instead of mounting an unknown
 * route, which renders a bare "פרשת " title and a permanent error.
 *
 * @param {string} hash   window.location.hash ('#vayera', 'vayera' or '')
 * @param {object} table  the parshiyot map, keyed by route
 * @returns {string|null} the route, or null when there is no usable fragment
 */
export function hashRoute(hash, table) {
  if (typeof hash !== 'string' || !table || typeof table !== 'object') return null
  let route = hash.startsWith('#') ? hash.slice(1) : hash
  if (!route) return null
  try {
    route = decodeURIComponent(route)
  } catch (e) {
    // A malformed escape is not a route; keep the raw fragment and let the
    // lookup below reject it.
  }
  return Object.prototype.hasOwnProperty.call(table, route) ? route : null
}
