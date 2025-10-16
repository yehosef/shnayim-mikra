# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hebrew Torah study web application called "שניים מקרא ואחד תרגום" (Shnayim Mikra V'Echad Targum). It displays weekly Torah portions (parshiyot) with the original Hebrew text, Aramaic translation (Targum), and various commentaries (meforshim) including Rashi, Ramban, Ibn Ezra, Rashbam, and others.

The application is built with Nuxt 3 and Vue 3, using RTL (right-to-left) layout for Hebrew text.

## Development Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Generate static site
npm run generate
```

## Architecture

### Data Structure

The core data is organized by Chumash (Torah book) and stored in `/server/assets/`:
- `torah/` - Hebrew text of the Torah
- `targum/` - Aramaic translation (Targum Onkelos)
- `rashi/` - Rashi commentary
- `meforshim/` - Additional commentaries (Ramban, Ibn Ezra, Rashbam, Daat Zekenim, Chizkuni, Sforno, Or HaChaim)
- `meforshim-index/` - Index mapping which commentaries exist for each verse

### Parsha Configuration

`/server/parshiyot.ts` contains the canonical definition of all Torah portions with:
- Chumash name (bereishit, shmot, vayikra, bamidbar, dvarim)
- Start/end positions as `[perek, pasuk]` (chapter, verse)
- Aliyot positions (seven divisions for Torah reading)
- Combined parsha definitions (e.g., "vayakhel-pekudei" for years when portions are combined)

### API Endpoints

- `GET /api/data/[parasha]?showRashi=true|false` - Returns all verses for a parsha with optional Rashi/meforshim
- `GET /api/meforshim/[pirush]?parasha=<name>` - Lazy-loads a specific commentary for a parsha

Both endpoints use `defineCachedEventHandler` with 1-year cache (`maxAge: 60 * 60 * 24 * 365`)

### Composables

- `useParsha()` - Uses `@hebcal/core` to determine current week's Torah portion based on Israeli/Diaspora calendar, filters parshiyot list by current year's cycle
- `useSettings()` - Cookie-based settings (display order, location, font size, etc.) with 10-year expiration

### Display Modes

Three viewing modes controlled by `settings.order`:
- `pasuk` - Verse-by-verse (default)
- `parasha` - Grouped by paragraph breaks (פ/ס)
- `aliya` - Grouped by the seven Torah reading divisions

### Client-Side Features

- Automatic scroll to today's aliya (controlled by `settings.aliyaByDay`)
- Navigation between aliyot with sticky header
- Lazy-loading of commentaries (click badge to load/toggle)
- Print-friendly styling (font size override, hide controls)
- Dark mode support via Nuxt UI
- Weekly parsha detection and redirect via global middleware

## Important Notes

- The app is RTL by default (`htmlAttrs: { dir: 'rtl', lang: 'he' }` in nuxt.config.ts)
- Uses custom Hebrew fonts: `font-sbl` for biblical text, optional `font-rashi` for Rashi script
- Sitemap is auto-generated for all parshiyot defined in nuxt.config.ts
- Google Analytics is enabled only in production (`gtag` module)
- Uses `@hebcal/core` for Jewish calendar calculations - location setting affects which parsha is current (Israel vs. Diaspora)

## Data Format

Verses are indexed as `[perek, pasuk]` where both are 0-indexed integers:
- Perek (chapter) starts at 0
- Pasuk (verse) starts at 0
- The `toHebrew()` function converts these to Hebrew numerals for display

Commentary data is stored as arrays where `text[perek][pasuk]` returns the commentary for that verse, or an empty array if none exists.
