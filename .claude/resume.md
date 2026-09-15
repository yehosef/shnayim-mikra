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

## 2026-09-14 session: v1-fixes shipped, follow-up PR opened

- Plan reviewed by a 16-agent workflow, then Codex gpt-5.6-sol and Claude Fable 5.1 CLI
  reviews; decisions: ship first, keyboard Space never un-marks, persistence banner now.
- **Production is `v1-fixes`** (master 49601fb, PR #1 merged 20:09Z, served bundle
  `index-v3TWxNP4.js`). Acceptance on `vite preview`: reload persistence, drag/chrome guards,
  Space x6, two-tab merge, targumType switching — all pass. `origin/v1-restart` deleted.
- Branch `v1-followup` (PR #2, merged 2026-09-15, production 60d8c09):
  - Calendar: Vezot Haberachah window runs through Simchat Torah itself
    (`useParsha.js` `simchatTorah = il ? 22 : 23`); before this, Simchat Torah resolved to
    Bereshit in every year. Tests extended; vite-node dry-run 2026-10-03 il -> vzot, not late.
  - List view: `src/lib/listStep.js` (pure, tested) — Space never writes false, parks at
    phase 0 at the end of a scope (was a toggle loop that un-marked the last targum).
  - `tests/data-load.test.js`: useData keys == parshiyot start/end for 61 routes, counts, HTML
    fallback rejected, Rashi gating.
  - Persistence: `persistFailed` ref + banner (`.error`, role=alert) when setItem throws.
  - AGENTS.md -> symlink to CLAUDE.md; ci.yml push trigger master only; `.claude/worktrees/`
    ignored.
- Service-worker registration cannot be verified in the embedded browser pane (script fetch
  error); offline/PWA-update items remain on the user's real-browser/phone checklist.
- The plan with the full acceptance checklist: ~/.claude/plans/review-the-recent-work-clever-haven.md

## In Progress

Nothing. PR #2 merged 2026-09-15; production is master 60d8c09 (served bundle `index-DF0rDPC3.js`).

## Next Steps (v1.1 candidates, none urgent)

- User acceptance on the phone/installed PWA: checklist in
  `~/.claude/plans/review-the-recent-work-clever-haven.md` Phase 3 (offline, PWA update prompt,
  swipe-away flush, aliyah boundaries vs a chumash). SW registration cannot be checked from the
  embedded browser pane.
- `useSettings.js` persister has no `persistFailed` equivalent (reviewer MEDIUM).
- `createPersister` skips `onWrite` when the merged string equals disk, so a stale
  `persistFailed` can linger until the next real write (reviewer LOW).
- Export/import of progress JSON; precache-size test in `tests/pwa-config.test.js`;
  hash-pinning scope decision; leftovers (`App.vue` civil-day rollover key,
  `FocusMode.vue` `.focus-content` cursor, unreferenced `public/logo.*`).

## Previous next steps (2026-09-07)

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
npm test                 # 200 tests
npm run validate         # data (strict) + style contract
npm run build            # prebuild regenerates aliyot.json and validates
npm run dev              # http://localhost:5173
SEFARIA_BASE=https://www.sefaria.org.il node scripts/report-versions.mjs   # licences (network)
```

Push over HTTPS (SSH port 22 was blocked on this network):
`git -c credential.helper='!gh auth git-credential' push https://github.com/yehosef/shnayim-mikra.git master`
