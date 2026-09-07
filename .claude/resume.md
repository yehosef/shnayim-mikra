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

## In Progress

Nothing. Tree clean on `master` == `v1-restart`.

## Next Steps

1. User acceptance pass in the real app (aliyah groupings vs a chumash, `readingStyle: 'aliyah'`
   in focus mode, the dismissible boundary notice in `src/components/DailyGuide.vue:54`).
2. Confirm the Vercel production deploy went out; `curl -I <prod>/data/torah/nosuch.json` should
   not be a 200 HTML page (the `useData.js:9` content-type guard handles it either way).
3. Delete `v1-restart` on the remote once master is confirmed live (optional).
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
