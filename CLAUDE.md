# Shnayim Mikra — project notes for Claude

Vue 3 + Vite 7 + vite-plugin-pwa. Deployed on Vercel (auto-deploys `master`).
Static Sefaria JSON under `public/data/`. No backend. All state in `localStorage`.

## Commands

```
npm run dev        # vite dev server
npm test           # vitest (node env, no jsdom)
npm run validate   # scripts/validate-data.mjs + scripts/check-styles.mjs
npm run build      # prebuild: generate aliyot.json + validate, then vite build
```

CI (`.github/workflows/ci.yml`) runs `npm ci && npm run validate && npm test && npm run build` on Node 22.

## The one source of truth

`localStorage['shnayim-progress']` is the only stored progress:

```
{ [parshaRoute]: { "perekNum:pasukNum": { hebrew1, hebrew2, targum } } }
```

Keys are 0-indexed (`"0:0"` = Genesis 1:1). `tests/progress-compat.test.js` guards this
contract; changing it requires a migration and an explicit decision from the user.

Everything else is **derived**, never stored:

- **Aliyah completion, the reading pointer, per-aliyah stats** — `src/lib/progressMath.js`
  (pure, zero Vue, zero localStorage) wrapped by `src/composables/useReadingState.js`
  (all `computed`, no position ref — a stored position is what froze the old pointer).
- **Reading style** (`settings.readingStyle`: `'verse'` | `'aliyah'`) is only a traversal-order
  parameter for `nextUnread`. Both styles read the same booleans.
- **Daily guide / urgency** (`useDailyGuide.js`) is advisory only. Nothing it returns may hide,
  disable, or gate content. `tests/daily-guide.test.js` asserts that.

## Aliyah boundaries

`public/data/aliyot.json` is **generated** by `scripts/generate-aliyot.js` from `@hebcal/leyning`
(`getLeyningForParsha`, never the date-overlay API). Never hand-edit it. `prebuild` regenerates it;
the generator hard-fails if the boundaries disagree with `src/data/parshiyot.js` start/end.
Maftir is folded into aliyah 7. `parshiyot.js` carries `chumash`, `hebcalName`, `start`, `end`
only; it has no aliyah data.

History: the old `aliyot` arrays in `parshiyot.js` were the starts of aliyot 2–7 plus maftir but
were read as 1–7, so every label was off by one and aliyah 1 was unreachable. If a boundary looks
"shifted" compared with the previous release, the new data is the correct one.

## Weekly parsha

`src/composables/useParsha.js` → `resolveWeek(date, il)`. Target is the next Shabbat; chag
Shabbatot walk forward; Yom Kippur → Hoshana Rabbah resolves to Vezot Haberachah; hebcal names
are matched via `hebcalName` in `parshiyot.js` after stripping apostrophes on both sides.
`tests/parsha.test.js` sweeps 5786–5795 in Israel and diaspora.

## Data layers (`public/data/`)

| layer | shape | notes |
|---|---|---|
| `torah/*.json` | `text[ch][v]` string | plain Hebrew with trop, no HTML |
| `targum/*.json` | `text[ch][v]` string | verse-aligned with torah |
| `english/*.json` | `text[ch][v]` string (HTML) | refetch via `scripts/fetch-sefaria.mjs` |
| `rashi/*.json` | `text[ch][v]` string[] (HTML) | short chapter arrays are legal (trailing truncation) |
| `aliyot.json` | generated, see above | |

Meforshim (7 commentators + index) live in `data-v2/` — versioned, out of deploy and PWA. v2 work.

`scripts/validate-data.mjs` checks alignment, provenance, and the aliyot rules. `STRICT=1` makes
findings fatal. `scripts/report-versions.mjs` lists Sefaria versions/licences (network).

## Style contract (enforced by `scripts/check-styles.mjs`)

- No `!important`. No `line-through`. No `opacity` on text
  (escape: `/* allow-opacity: reason */` on the same or previous line, for non-text UI only).
- Read state, pointer, and in-scope aliyah are three orthogonal channels expressed with borders,
  backgrounds, and markers. Never dim or strike completed text.
- Do not restyle components unasked. Keep existing CSS classes; change triggers, not looks.

## Binding UX requirements (from the user, Oct 2025)

- Each pasuk is shown twice; the text itself is the click target to toggle read state.
- Pasuk font larger than targum.
- Focus mode: one pasuk, side buttons in the middle of the page edges, header shows
  aliyah / perek / pasuk. Keyboard works: Space/Enter advance, arrows navigate, 1/2/3 jump.
- English above Rashi, HTML rendered.
- Space marks the next thing to read as read and advances; a visible pointer shows where you are.
- Only ONE of Onkelos / Rashi / English counts for the obligation (`settings.targumType`).

## Browser verification

Full-parsha DOM overflows snapshot tools. Verify through focus mode, a single aliyah
(`displayMode: 'aliyah'`), or `page.evaluate` strings.

## Scope kept out of v1

Meforshim display, `displayMode: 'parasha'`, keyboard-handler consolidation (two non-conflicting
handlers exist), `v-html` sanitising (local data only), progress schema versioning, combined ↔
single parsha progress credit.
