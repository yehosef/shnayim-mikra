# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Hebrew Torah study web app - "שניים מקרא ואחד תרגום" (Shnayim Mikra V'Echad Targum). Displays weekly Torah portions with Hebrew text (read twice), Aramaic Targum, English translation, and commentaries (Rashi, Ramban, Ibn Ezra, etc.).

**Stack**: Vue 3 (Composition API with `<script setup>`) + Vite. No backend - all data is static JSON.

## Development Commands

```bash
npm install
npm run dev      # Dev server (usually port 5173 or 5174)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Architecture

### Data Files (static JSON in `public/data/`)

| Directory | Content | Size |
|-----------|---------|------|
| `torah/` | Hebrew Torah text by chumash | 1.4 MB |
| `targum/` | Targum Onkelos by chumash | 1.4 MB |
| `rashi/` | Rashi commentary by chumash | 2.2 MB |
| `english/` | English translation by chumash | 988 KB |
| `meforshim/` | Other commentaries (35 files) | ~13 MB |
| `parshas.json` | Parsha list for selector | small |
| `aliyot.json` | Aliyah boundaries | 64 KB |

Data is indexed as `text[perek][pasuk]` where both are **0-indexed**.

### Parsha Configuration

`src/data/parshiyot.js` defines all 54+ Torah portions with:
- Chumash mapping (bereishit, shmot, vayikra, bamidbar, dvarim)
- Start/end positions as `[perek, pasuk]` (0-indexed)
- Aliyah boundaries (note: some parshas have <7 aliyot: eikev=6, nitzavim=6, vzot-haberachah=5)
- Combined parsha definitions for doubled weeks

### Key Composables (`src/composables/`)

- **useData.js** - Loads entire chumash JSON per parsha. 5 parallel fetches (Torah, Targum, Rashi, English, Meforshim-index). Builds verse objects with `perekNum`/`pasukNum` (numeric) and `perek`/`pasuk` (Hebrew display).
- **useParsha.js** - Uses `@hebcal/core` to detect weekly parsha. Returns parsha name for hash routing.
- **useProgress.js** - Module-level singleton. Progress stored in localStorage key `shnayim-progress`. Structure: `{ [parshaName]: { [chapterNum:verseNum]: { hebrew1, hebrew2, targum } } }`
- **useSettings.js** - Module-level singleton. Settings in localStorage key `shnayim-settings`. Includes: interfaceLanguage, displayMode, currentAliyah, showRashi, showTrop, location, fontSize, fontRashi, targumType, showEnglish.
- **useAliyahNavigation.ts** - Only TypeScript file. Manages aliyah-level progress with daily reset.
- **useDailyAliyah.js** - Daily study schedule (Mon: aliyot 1-2, Tue: 3, etc.)

### Components (`src/components/`)

- **ParshaDisplay.vue** - Main view. Header, aliyah selector, progress bar, verse list. Keyboard nav (arrows, Space, Enter).
- **VerseView.vue** - Individual verse card. Shows Hebrew x2, Targum, English, Rashi. Click phases to mark read.
- **FocusMode.vue** - Immersive 3-step study mode. Keyboard: Space/Enter advance, arrows navigate (RTL-aware), 1/2/3 jump step, M mark, U undo, ? help, Esc exit.
- **SettingsModal.vue** - All settings controls.
- **ParshaSelector.vue** - Parsha picker dropdown.

### Routing

Hash-based: `#bereshit`, `#noach`, etc. App.vue listens to `hashchange`. Falls back to weekly parsha detection.

### Fonts

- `public/SBL_Hbrw.ttf` - SBL Hebrew for biblical text (315 KB)
- `public/Mekorot-Rashi.ttf` - Rashi script for Rashi commentary (17 KB)
- Both declared as `@font-face` in App.vue

### Progress Tracking

Verse keys use numeric format: `${perekNum}:${pasukNum}` (0-indexed chapter:verse). Each verse tracks 3 boolean phases: hebrew1, hebrew2, targum. All stored in localStorage.

## Important Notes

- App is RTL (`dir="rtl"` on root div in App.vue)
- Arrow keys are RTL-aware: ArrowRight = backward, ArrowLeft = forward
- Data uses 0-indexed `[chapter, verse]` arrays
- `toHebrew()` in `src/utils/hebrewUtils.js` converts numbers to Hebrew numerals for display
- `removeTrop()` strips cantillation marks (Unicode U+0591-U+05AF range)
- Multiple `v-html` usages with Sefaria-sourced data (low XSS risk since data is local JSON)
- No service worker or offline caching currently
- Single JS bundle (~253 KB), no code splitting configured
