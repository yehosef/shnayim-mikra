# Resume - Bug Fix Session

**Date**: 2026-02-09
**Dev Server**: `npm run dev` (port 5173)

---

## Completed This Session

### Comprehensive Code Review
A 3-agent team reviewed the entire codebase (code quality, browser UX, performance).
Full report: `.claude/review-report.md` (19 issues found, prioritized by severity).

### 9 Bugs Fixed

1. **Verse key collision** (CRITICAL) - FocusMode.vue:188, ParshaDisplay.vue:177+207, VerseView.vue:143
   Changed `${verse.perek || ''}:${verse.pasuk}` to `${verse.perekNum}:${verse.pasukNum}`
   Old progress data with Hebrew-letter keys is orphaned (was corrupt due to collisions anyway).

2. **SBL Hebrew font 404** - App.vue:52
   `SBLHebrew.woff2` → `SBL_Hbrw.ttf` with format('truetype')

3. **Rashi font missing @font-face** - App.vue (new block after SBL)
   Added @font-face for 'Rashi' → `/Mekorot-Rashi.ttf`

4. **Year cap = wrong parsha** - useParsha.js:9
   Removed `Math.min(new Date().getFullYear(), 2024)`. Now uses actual year.

5. **JSON.parse crash** - useProgress.js:3-6, useSettings.js:20-23
   Added try/catch around JSON.parse in both files.

6. **Memory leak** - App.vue:32-35
   Added `onUnmounted(() => window.removeEventListener('hashchange', updateParsha))`

7. **style.css scaffold cleanup** - style.css
   Replaced Vite dark theme defaults with minimal reset.

8. **RTL arrow keys** - FocusMode.vue:310-316, ParshaDisplay.vue:294-309
   Swapped ArrowRight/ArrowLeft so right=backward, left=forward (RTL convention).

9. **Deleted HelloWorld.vue** - removed unused Vite scaffold component.

---

## Remaining Issues (from review report)

### Medium Priority
- **Data re-fetch on Rashi toggle** (#9) - Toggling showRashi re-fetches ALL data. Should cache per-chumash.
- **Aliyah progress resets daily** (#13) - useAliyahNavigation.ts:128-134 resets on date change.
- **No debouncing on deep watch** (#14-15) - useSettings.js and useProgress.js write to localStorage on every nested change.

### Low Priority
- **XSS via v-html** (#7) - Multiple unsanitized v-html usages. Low risk (local JSON data).
- **No service worker** (#17) - Would benefit Shabbat-observant users who pre-load.
- **No error retry UI** (#18) - Network failures show error with no retry button.
- **AliyahReadingList hardcodes /21** - Some parshas have <7 aliyot.
- **Single 253KB JS bundle** - No code splitting in vite.config.js.

---

## Commands to Continue

```bash
cd /Volumes/code/personal/shnayim-mikra
npm run dev

# Verify fixes:
# Open http://localhost:5173/#bereshit
# Click through Hebrew 1 → Hebrew 2 → Targum to test progress tracking
# Check fonts load: document.fonts.forEach(f => console.log(f.family, f.status))

# Key files modified this session:
# src/App.vue - font fixes, memory leak fix
# src/components/FocusMode.vue - verse key fix, RTL arrows
# src/components/ParshaDisplay.vue - verse key fix (x2), RTL arrows
# src/components/VerseView.vue - verse key fix
# src/composables/useParsha.js - year cap removed
# src/composables/useProgress.js - JSON.parse try/catch
# src/composables/useSettings.js - JSON.parse try/catch
# src/style.css - cleaned up scaffold
# CLAUDE.md - completely rewritten (was describing old Nuxt architecture)
```
