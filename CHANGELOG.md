# Changelog

Each entry says what changed for someone using the app, and where it was deployed.

## 1.3.0 — 2026-10-06

Deployed to Firebase Hosting (https://shnayim.web.app), tag `v1.3.0`. The old Vercel address
stays on 1.1.0.

- Settings is redesigned: grouped sections, labels and controls on one grid, buttons instead of
  dropdowns for two- and three-way choices, a live sample line for text size, plainer wording
  ("Counted translation" instead of "Targum Type for Tracking"), and clearing a parsha set
  apart as a red, lower section. On a phone it fills the screen.
- The page now follows the interface language's direction: left-to-right in English,
  right-to-left in Hebrew, so colons, periods and counts land where they belong. Torah, Targum
  and Rashi text stay right-to-left, and next is still on the left. In English the reading
  screens' headers run left-to-right (title on the left, settings and parsha picker on the
  right).
- Options that would have no effect are greyed out, for example "Also show Rashi" when Rashi is
  the counted translation.
- Keyboard: focus stays inside Settings while it is open; after closing, Space marks the next
  reading as before.

## 1.2.1 — 2026-10-05

Deployed to Firebase Hosting (https://shnayim.web.app), tag `v1.2.1`. The old Vercel address
stays on 1.1.0.

- The front page is no longer kept by browsers for an hour after a new release, so a first-time
  visitor right after an update cannot get a page that points at files that no longer exist.

## 1.2.0 — 2026-10-05

Deployed to Firebase Hosting at the app's new address, https://shnayim.web.app (project
Torah-io, site `shnayim`), from the branch `firebase-sync`, tag `v1.2.0`. Not yet on the old
Vercel address, which stays on 1.1.0 until sign-in has been tried on the new one.

- New address: https://shnayim.web.app.
- Optional sign-in with Google (Settings → Account). Signed in, reading marks are backed up and
  follow you to your other devices, including un-marks and "start this parsha over". Each
  reading year is kept separately.
- Nothing changes without sign-in: the app works fully offline and stores marks on the device
  as before.
- Two Google accounts on one device never see each other's marks; signing out keeps the marks
  on the device.
- Marks made on the old address do not move by themselves. Sign in once on the old address
  (after it is updated), then on the new one.

## 1.1.0 — 2026-10-05

Deployed to Vercel production (https://shnayim-mikra.vercel.app) from `master`, tag `v1.1.0`.

**One-phrase (focus) view and one-pasuk list mode**
- A fast second press or a held Space no longer marks a piece that was not on screen yet.
- Pressing an arrow, 1/2/3 or undo right after Space now wins over the pending move.
- Arrows agree everywhere: next is on the left, previous on the right — buttons, keys and help text.
- Moving on takes about half a second instead of about one second. Within a pasuk the card stays
  and the text crossfades; a new pasuk slides in from the left, going back from the right.
  Reduced-motion settings are respected.
- Arrow keys in one-pasuk mode open the new pasuk on its first unread piece.
- Changing a setting no longer jumps the card to a different pasuk.
- Space or Enter on a focused button presses that button instead of marking a reading.

**Look**
- Both reading views share one set of colours, sizes, borders and labels. The translation is the
  same size relative to the Hebrew in both.
- The one-phrase view shows the gold "you are here" and blue "in the selected aliyah" cues.
- Every label follows the interface-language setting (English or Hebrew); the one-phrase view was
  Hebrew-only before.
- Phone: the list header is compact, the previous/next row stays below it while scrolling, and
  the one-phrase card no longer sits under the side arrows.
- When Rashi or English is the counted translation, a read box is green on all four sides.

**Yearly cycle**
- Marks now belong to a reading year. After Simchat Torah, last year's marks move to an archive
  and every parsha starts clean; Vezot Haberachah keeps its marks through its catch-up days.
- On first load of this version, marks made before it move to the archive, except Bereshit and
  (until its catch-up days end) Vezot Haberachah. A notice offers Undo.
- Settings has "Start this parsha over" and "Restore archived marks" for the open parsha.

**Other**
- Reading a pasuk in a single parsha (for example Matot) also counts in the combined parsha
  (Matot-Masei), and the reverse.
- First run asks once whether to follow the Israel or the Diaspora schedule.
- The parsha picker shows ✓ for a finished parsha and ◐ for a partly read one.
