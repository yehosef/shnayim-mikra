# Resume — shnayim-mikra

## Where things stand (2026-10-07)

The UI/UX plan from the review of 2026-10-06 is fully implemented on branch `firebase-sync`
(8 commits after version 1.3.0) and bumped to **1.4.0** with a changelog entry. Tests (437),
`npm run validate` and `npm run build` pass; a 100-screenshot matrix (6 screen sizes × Hebrew/
English × list, focus, Settings, help, plus state variants) shows no horizontal overflow and no
off-screen controls. **Deployed** to Firebase Hosting (https://shnayim.web.app) on 2026-10-07, served bundle
`index-BFk7T1pf.js`, tag `v1.4.0` pushed. Next action: try the welcome card, Google sign-in and
dark mode on a real phone; nothing else is pending.

## Completed (all on `firebase-sync`, uncommitted nothing)

- **Focus mode never hides the pasuk**: tall content starts at the top instead of overflowing
  above the scroll start; header in rem so ✕/gear/? stay on screen at any text size; side
  buttons clear of the card on tablets; touch wording; "How it works" sheet; Undo bar;
  completion card; Onkelos-fallback line; Rashi comments as paragraphs; grey side buttons;
  Back closes the help sheet. `src/components/FocusMode.vue`.
- **Header**: "Suggested today" and pills removed (pill only on/after Shabbat; "today" tag in the
  chip); small conditional "Last week" link; new visitor Sunday–Tuesday lands on the coming week
  (`catchUpPending` in `src/lib/progressMath.js`, tests in `tests/default-week.test.js`); the
  boundary notice moved to the App notice row; chips 40px with scroll-into-view and edge fade;
  title is the parsha picker (native select over the h1); gear + sync icon on the title row; no
  "Aliyah:" dropdown; chip tap in one-pasuk mode jumps within that mode. `ParshaDisplay.vue`,
  `AliyahBar.vue`, `DailyGuide.vue`, `App.vue`.
- **Verse card**: pointer ▶ inside the card in `--c-pointer-strong`; purple keyboard selection
  only after a key press (`src/composables/useInputMethod.js`, pure `nextInputMethod` tested);
  sof pasuk and paseq kept when trop is off (`src/utils/hebrewUtils.js`); corner-dot Undo;
  capped line widths on desktop; darker read border. `VerseView.vue`, `src/style.css`.
- **First visit / Settings**: inline welcome card (setting `welcomeDismissed`, seeded true for
  existing readers via `src/lib/settingsDefaults.js`); Hebrew default for Hebrew browsers;
  Account second in Settings with `initialSection` prop; Android Back closes Settings (history
  entry); update bar on the main screen; credits inline (`src/lib/creditsText.js`); Settings
  tidy-ups. `SettingsModal.vue`, `App.vue`, `useSettings.js`, `index.html`.
- **Dark theme** follows `prefers-color-scheme`; all colours are `--c-*` tokens
  (`tests/theme-colors.test.js` guards); gear/magnifier are inline SVG; manifest/theme-color
  no longer flash navy. `src/style.css`, `vite.config.js`.
- **Hebrew copy** in plural address; close buttons "סגירה".

## Decisions (2026-10-07, all recorded in `.claude/notes/ux-review-2026-10-06.md`)

Remove "Suggested today"; "Last week" only when started-and-unfinished; title as picker; welcome
card + sync icon + Hebrew default; purple only after keyboard; drop the "Aliyah:" dropdown; keep
arrows at the top (bottom bar declined); keep sof pasuk; grey navigation; dark theme follows the
system; keep "Whole parsha"; defer reminders. Deviations accepted during implementation: the
"today" tag is not shown on last week's parsha during catch-up; a chip tap jumps to the aliyah's
next unread pasuk rather than its top; the ▶ sits after the pasuk number; the Account privacy
line mentions that Google sign-in stores name and email.

## Open questions

- Sign-in from the welcome card has not been tried with a real Google account.
- Offline "Saved" state in Settings only shows in a production build (dev has no service worker).

## Next steps

1. Try the welcome card + sign-in on a real phone (Hebrew and English), and dark mode at night.
2. Leftovers from the review marked "Not planned": WOFF2 font (licence check first), the
   "(פ)/(ס)" markers, text-size slider direction in Hebrew (check on iPhone), reminders.

## Commands to continue

```
npm run dev                 # dev server (the screenshot harness expects port 5199: npm run dev -- --port 5199)
npm test && npm run validate && npm run build
node scripts/screenshot-matrix.mjs '<spec>'
                            # screenshot harness (needs global Playwright + cached Chromium; writes scripts/shots/)
firebase deploy --only hosting   # production deploy; the owner allows deploying this app without asking (2026-10-07)
```
