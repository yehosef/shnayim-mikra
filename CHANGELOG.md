# Changelog

Each entry says what changed for someone using the app, and where it was deployed.

## 1.5.1 — 2026-10-08

Deployed to Firebase Hosting (https://shnayim.web.app), tag `v1.5.1`.

- New icon: an open scroll with two full lines (the two readings) and one shorter gold line (the
  translation) on a dark slate square. It is the browser-tab favicon (crisp SVG, plus a 16/32/48
  .ico), the iPhone home-screen icon, and the installed-app icon. Source and build script under
  `scripts/icons/`.

## 1.5.0 — 2026-10-08

Deployed to Firebase Hosting (https://shnayim.web.app), tag `v1.5.0`.

- Settings → Appearance has a Theme choice: Light, Dark or Auto (Auto follows the device's
  setting, which is what every existing reader gets until they choose). The browser bar colour
  follows the chosen theme, and the page opens in the right theme without a flash.

## 1.4.1 — 2026-10-08

Deployed to Firebase Hosting (https://shnayim.web.app), tag `v1.4.1`.

- In the English interface, parsha names are in English everywhere: the title and picker
  ("Parashat Shelach", grouped by book), "Coming week: Bereshit", the completion card, the
  "start this parsha over" section and the cycle notice. Hebrew is unchanged.
- Updating: a new version that finished downloading on an earlier visit now takes over when the
  app is next opened, instead of waiting behind the old one until "Reload" is pressed. During a
  session the "New version ready" bar still asks first. (This fix itself only takes effect from
  the version after 1.4.1: a device still on 1.4.0 needs one "Reload" from the bar, or all tabs
  of the app closed and reopened.)

## 1.4.0 — 2026-10-07

Deployed to Firebase Hosting (https://shnayim.web.app), tag `v1.4.0`. Follows the UI/UX review of
2026-10-06 (`.claude/notes/ux-review-2026-10-06.md`). The old Vercel address stays on 1.1.0.

**Focus mode (one phrase at a time)**
- A long pasuk, or one with Rashi or English shown, now opens at its first word. Before, the top of
  the text sat above the screen where no scrolling could reach it.
- The header no longer grows with the text size, so the ✕, gear and ? stay on a phone screen at
  every size; on narrow phones the reference reads "א:יג".
- On tablets the side buttons no longer cover the card. The buttons are grey, like the list arrows.
- Phones read "Tap the text to continue" instead of a Space hint. The ? opens a "How it works"
  sheet: touch first, a colour key, then the keyboard table.
- The three reading dots are tappable buttons (current = gold, read = green, unread = ring).
- The pasuk is the same size as in the list view (phones no longer shrink it); larger on wide
  screens. Each Rashi comment is its own paragraph.
- After each mark a short "Marked · Undo" bar appears. When Rashi or English is missing on a pasuk
  a line says Onkelos is shown instead. Finishing the parsha shows a completion card.
- Android Back closes the help sheet; Tab no longer reaches the hidden list behind focus mode.

**Header and list view**
- The parsha title is the parsha picker: tap "פרשת בראשית ▾" to choose another. The separate
  dropdown and the second "Aliyah:" dropdown are gone; the gear and a sync icon sit on the title
  row at every width, and tablet aliyah chips fit on one row.
- The "Suggested today" line and the status pills are gone; today's aliyah has a small "today"
  tag on its chip, and a pill appears only on Shabbat and after Shabbat.
- "Last week: …" is small and grey, and shows only while last week's parsha is started but
  unfinished. A brand-new visitor on Sunday–Tuesday opens on the coming week.
- The phone header is about 120px instead of 170–220px. In phone landscape it scrolls away so
  the text is visible on first load. After advancing, the pasuk number is never hidden under
  the arrow row.
- The gold "you are here" ▶ sits inside the card and is darker; the next piece to read has a gold
  outline. The purple keyboard highlight appears only after a key is pressed.
- Tapping an aliyah chip in one-pasuk mode keeps that mode and jumps to the aliyah's first unread
  pasuk. Chips scroll into view and the row fades at the edge where more chips are hidden.
- The sof pasuk (׃) and paseq stay when trop is hidden. Navigation arrows are grey, so green only
  means "read". Clearing a whole pasuk with the corner dot offers Undo.
- Loading failures show a plain sentence with Retry.

**First visit, sign-in and Settings**
- First-time visitors see one inline welcome card: language, Israel/Diaspora, "tap each text",
  and "marks are saved on this device only — sign in with Google to keep them", with a colour key.
  Hebrew browsers start in Hebrew.
- A cloud icon beside the gear shows sign-in / sync state and opens Settings at Account, which is
  now the second section with plainer wording.
- Android Back closes Settings instead of changing the parsha. The "New version ready" bar also
  shows on the main screen. Credits are shown inline as "Sources and licences".
- Settings tidy-up: reading order and view sit together with helper lines; Rashi-script row only
  when Rashi is on screen; one confirmation pattern; offline status says when the browser cannot
  save for offline.

**Appearance and copy**
- Dark theme follows the system setting. The installed app no longer flashes navy on launch.
- Hebrew interface text addresses the reader in the plural throughout; "עלייה" spelled consistently.

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
