/**
 * The notice shown on the old Vercel address while readers move to the
 * Firebase Hosting address. localStorage is per address, so a signed-out
 * reader's marks do not follow them; signing in once on each address does.
 * Set SHOW_MOVED_NOTICE to false to switch the notice off everywhere.
 */
export const SHOW_MOVED_NOTICE = true

export const OLD_HOST = 'shnayim-mikra.vercel.app'
export const NEW_URL = 'https://shnayim.web.app'

// Set once the reader dismisses the notice on this device.
export const MOVED_DISMISSED_KEY = 'shnayim-moved-notice-dismissed'

/** Should the notice show on `hostname`? */
export function showMovedNotice(hostname, dismissed, enabled = SHOW_MOVED_NOTICE) {
  return enabled === true && hostname === OLD_HOST && !dismissed
}
