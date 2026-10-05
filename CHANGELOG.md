# Changelog

Each entry says what changed for someone using the app, and where it was deployed.

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
