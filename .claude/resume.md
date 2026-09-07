# Resume — shnayim-mikra v1 restart

Last session: 2026-09-06/07. Branch `v1-restart`, fast-forwarded into `master` and pushed
(`d2a9090`). Vercel auto-deploys `master`; the deploy was not confirmed from here (no Vercel CLI).
The `twoplusone` prototype is archived at `/Volumes/code/geula/archive/twoplusone` (not a git repo).

## Completed

- **P0 safety net** — dead files removed, meforshim moved to `data-v2/`, session transcripts in
  `.claude/transcripts/` (requirements source, never delete), vitest, `tests/progress-compat.test.js`
  guarding `localStorage['shnayim-progress']` (keys `"perek:pasuk"`, 0-indexed).
- **P1 calendar** — `src/data/parshiyot.js` has `hebcalName` ×61 and no aliyah data;
  `src/composables/useParsha.js` `resolveWeek(date, il)` (next Shabbat, chag walk-forward, Vezot
  Haberachah window); `tests/parsha.test.js` sweeps 5786–5795.
- **P2 aliyot** — `scripts/generate-aliyot.js` from `@hebcal/leyning` → `public/data/aliyot.json`
  (never hand-edit; `prebuild` regenerates). Pinchas: corpus merges Num 25:19 into 26:1 (Sefaria
  versification); boundaries unaffected, verse-count check uses hebcal's own table.
  `tests/aliyot.test.js`.
- **P3 derived state** — `src/lib/progressMath.js` (pure), `useReadingState.js` (all computed),
  `useAliyot.js`, `useDailyGuide.js`, `AliyahBar.vue`, `DailyGuide.vue`. Pointer + Space advance
  follow `nextUnread` in both list view (`ParshaDisplay.vue` `advanceSelection`) and
  `FocusMode.vue` (`followPointer`). `settings.readingStyle` `'verse' | 'aliyah'`.
- **P4 offline** — SW precaches Torah + Targum + aliyot; english/rashi are optional layers
  (`useData.js` `fetchOptional`); VerseView/FocusMode fall back to Onkelos when the chosen layer is
  missing. Verified by killing the preview server and loading a never-visited parsha.
- **P5 data** — english (JPS 2006, CC-BY-NC) and rashi (Metsudah, CC-BY) refetched via
  `scripts/fetch-sefaria.mjs`; targum stamped CC-BY-NC. `scripts/validate-data.mjs` strict by
  default, 0 findings. From Israel use `SEFARIA_BASE=https://www.sefaria.org.il`.
- **P6 ship** — `CLAUDE.md` rewritten, `.github/workflows/ci.yml`, `scripts/check-styles.mjs`
  (no `!important`, no `line-through`, no text opacity), stale notes in `.claude/archive/`.

## 2026-09-07 session: deploy confirmed + pre-acceptance review

- Production is live at https://shnayim-mikra.vercel.app (GitHub deployment for `d024fa4`
  succeeded 09:18Z; `/data/aliyot.json` byte-identical to local; `/data/torah/nosuch.json` is a
  200 HTML SPA fallback, handled by the `useData.js` content-type guard which is in the bundle).
- Adversarial multi-agent review of the v1 diff: **38 confirmed findings** (1 CRITICAL, 10 HIGH,
  17 MEDIUM, 10 LOW), full report with file:line and fixes in
  `.claude/notes/v1-review-2026-09-07.md`. Nothing has been fixed yet — awaiting the user's
  decision on which batch to fix.

## 2026-09-07 (late): all accepted findings fixed on branch `v1-fixes`

- User decisions: numerals 15/16 -> טו/טז; Sun–Tue default view stays on last week's unfinished
  parsha (`resolveDefaultWeek` in `useParsha.js`); accessibility findings dropped (only
  Escape-closes-settings kept); PWA `registerType: 'prompt'`.
- 33 findings fixed in 8 commits, then a verification workflow (2 lenses per fix + 4 diff
  reviewers + 3 refuters each) confirmed 25 regressions, repaired in 5 more commits, plus one
  more found in the browser smoke pass (external write vs. selection). 177 tests, validate, build
  all green. Design notes: the default week writes NO URL fragment (a fragment always means a
  user choice, `src/lib/hashRoute.js`); rollover to the new week is held while the tab is visible;
  cross-tab merge is field-level dirty tracking (`useProgress.js` `mergeProgress`); focus-mode
  stepping is the pure `src/lib/focusStep.js`.
- Branch pushed; Vercel preview requires Vercel SSO login (per-deployment URLs 302 to sso-api).
  Smoke-tested locally via `npx vite preview` in Chrome: click-to-toggle, Space/pointer, focus
  mode header + aliyah-style traversal, aliyah display mode scoped pointer, targumType rashi,
  two-tab merge, coming-week link + reload.
- Known leftovers (not done): `App.vue` rollover key uses the civil day, not the Jewish day
  (only affects when a hidden tab rolls over); `.focus-content` still has `cursor: pointer`
  though only the text card advances; `public/logo.png` is unreferenced.

## In Progress

Nothing. `v1-fixes` is 14 commits ahead of `master`, pushed.

## Next Steps

1. User reviews the Vercel preview for `v1-fixes` (log in to Vercel) or runs it locally, then
   merges `v1-fixes` into `master` (auto-deploys production).
2. User acceptance pass in the real app (aliyah groupings vs a chumash, `readingStyle: 'aliyah'`
   in focus mode, the dismissible boundary notice in `src/components/DailyGuide.vue:54`).
3. Delete `v1-restart` on the remote (master is confirmed live; optional).
4. v2 candidates (out of scope, untouched): meforshim display from `data-v2/`
   (`meforshim-index` files lack `.text`); `displayMode: 'parasha'`; consolidate the two keyboard
   handlers (`ParshaDisplay.vue:handleKeydown`, `FocusMode.vue:handleKeydown`); `v-html`
   sanitising; progress schema version + combined↔single parsha credit.

## Commands to Continue

```
cd /Volumes/code/geula/shnayim-mikra
npm test                 # 70 tests
npm run validate         # data (strict) + style contract
npm run build            # prebuild regenerates aliyot.json and validates
npm run dev              # http://localhost:5173
SEFARIA_BASE=https://www.sefaria.org.il node scripts/report-versions.mjs   # licences (network)
```

Push over HTTPS (SSH port 22 was blocked on this network):
`git -c credential.helper='!gh auth git-credential' push https://github.com/yehosef/shnayim-mikra.git master`
