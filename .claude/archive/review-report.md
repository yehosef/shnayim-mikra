# Shnayim-Mikra Comprehensive Review Report
**Date:** 2026-02-09
**Reviewers:** Team of 3 agents + browser UX testing

---

## CRITICAL BUGS

### 1. Verse Key Collision - Progress Data Corruption
**File:** `src/components/FocusMode.vue:186-189`, `src/components/ParshaDisplay.vue:177,207`, `src/components/VerseView.vue:143`

The verse key for progress tracking is `${verse.perek || ''}:${verse.pasuk}` where `verse.perek` is a Hebrew letter set ONLY for the first verse of each chapter (null for all others), and `verse.pasuk` is the Hebrew verse number.

**Result:** Verse 2 of chapter 1 → key `:ב`. Verse 2 of chapter 2 → ALSO key `:ב`. Any parsha spanning multiple chapters has colliding progress keys. Marking one verse as read marks ALL same-numbered verses across chapters as read.

**Fix:** Use `${verse.perekNum}:${verse.pasukNum}` (numeric indices stored on each verse object).

---

### 2. Hardcoded Year Cap = Wrong Weekly Parsha
**File:** `src/composables/useParsha.js:9`
```js
const year = Math.min(new Date().getFullYear(), 2024)
```
Since it's 2026, `getSedra()` always gets year 2024. The auto-detected weekly parsha is **wrong for any date after 2024**.

**Fix:** Remove `Math.min` cap, or properly convert to Hebrew year.

---

### 3. JSON.parse Crash on Corrupt localStorage
**Files:** `src/composables/useProgress.js:4-6`, `src/composables/useSettings.js:21-23`

No try/catch around `JSON.parse(stored)`. Corrupt localStorage data crashes the entire app on load with no recovery. `useAliyahNavigation.ts` already does this correctly.

**Fix:** Wrap in try/catch, return defaults on parse failure.

---

### 4. SBL Hebrew Font Never Loads (404)
**File:** `src/App.vue:52`
```css
src: url('/SBLHebrew.woff2') format('woff2');
```
The actual file is `/SBL_Hbrw.ttf` (not woff2). Font declaration causes a 404. Hebrew text falls back to generic serif.

**Fix:** Change to `src: url('/SBL_Hbrw.ttf') format('truetype');`

---

### 5. Memory Leak: hashchange Listener Not Cleaned Up
**File:** `src/App.vue:33-35`
```js
onMounted(() => {
  updateParsha()
  window.addEventListener('hashchange', updateParsha)
})
```
No `onUnmounted` to remove the listener. Causes memory leak on hot-reload during dev.

**Fix:** Add `onUnmounted(() => window.removeEventListener('hashchange', updateParsha))`

---

## HIGH SEVERITY

### 6. Arrow Keys Reversed for RTL Users
**File:** `src/components/FocusMode.vue:310-316`
App is `dir="rtl"` but ArrowRight = next verse, ArrowLeft = previous verse. In RTL, right-arrow conventionally means "backward". Counter-intuitive for Hebrew readers.

### 7. XSS Risk via v-html
**Files:** `src/components/VerseView.vue:67,76,85,92,100`, `src/components/FocusMode.vue:83,90,111,116`
Multiple unsanitized `v-html` usages with Sefaria data containing HTML (`<b>`, footnotes). Low risk since data is local JSON, but should be sanitized.

### 8. Rashi Font Missing @font-face
CSS references `font-family: 'Rashi', serif` but no `@font-face` exists for `Mekorot-Rashi.ttf`. Rashi text falls back to serif everywhere.

**Fix:** Add @font-face for Rashi font in App.vue or style.css.

### 9. Full Data Re-fetch on Rashi Toggle
**File:** `src/components/ParshaDisplay.vue:198-200`
Toggling `showRashi` re-fetches ALL data (Torah, Targum, English, Rashi). Should cache per-file to avoid redundant requests.

### 10. style.css is Default Vite Scaffold
**File:** `src/style.css`
Still contains dark theme defaults (`background-color: #242424`, `color: rgba(255,255,255,0.87)`) and `display: flex; place-items: center` on body. These conflict with the app's actual light theme set in App.vue. The scaffold styles should be cleaned up.

---

## MEDIUM SEVERITY

### 11. Empty Rashi Section in Focus Mode
Empty "רש״י" label and box shown when verse has no Rashi. Visual clutter.

### 12. Settings Labels RTL/English Mismatch
Colons appear on LEFT of labels (":Interface Language") - RTL convention applied to English text.

### 13. useAliyahNavigation Resets Progress Daily
**File:** `src/composables/useAliyahNavigation.ts:128-134`
Aliyah-level progress resets on date change with no warning.

### 14. No Debouncing on Settings Watch
**File:** `src/composables/useSettings.js:27-29`
Deep watch on settings triggers localStorage write on every nested property change. Should debounce for performance.

### 15. No localStorage Write on useProgress Deep Watch
**File:** `src/composables/useProgress.js:10-12`
Same issue - deep watch without debounce.

---

## LOW SEVERITY

### 16. Unused HelloWorld.vue Component
Default Vite scaffold file at `src/components/HelloWorld.vue`.

### 17. No Service Worker / Offline Support
Torah study app with no offline capability. Shabbat-observant users who pre-load would benefit from a service worker.

### 18. No Error Recovery / Retry UI
Network failures show "שגיאה:" with no retry button.

### 19. No PWA Manifest Icon Sizes
`manifest.json` exists but may lack proper icon sizes for installability.

---

## DATA & PERFORMANCE

### Data Sizes
| Directory | Size |
|-----------|------|
| torah/ | 1.4 MB (5 chumash files) |
| targum/ | 1.4 MB |
| rashi/ | 2.2 MB |
| english/ | 988 KB |
| **Total** | **~20 MB** (including meforshim) |

### Loading Strategy
- **Per-chumash lazy loading** - loads entire chumash when a parsha is selected
- **5 parallel fetch requests** per parsha load (Torah, Targum, Rashi, English, Meforshim-index)
- Rashi conditionally loaded only when `showRashi` is true
- **No client-side caching** - relies on browser HTTP cache
- No service worker for offline caching

### Build
- Vite config is bare (`plugins: [vue()]`) - no optimizations, no code splitting, no chunk limits
- No tree-shaking configuration
- @hebcal/core adds calendar computation overhead

---

## UX OBSERVATIONS (Browser Testing)

### What Works Well
- Reading toggle flow: Hebrew 1 → green, Hebrew 2 → green, Targum → green. Intuitive and satisfying.
- Focus mode is excellent - clean, immersive, with great keyboard shortcuts
- Progress persists across sessions via localStorage
- Parsha switching via URL hash (`#bereshit`, `#noach`) works correctly
- Aliyah selector updates verse list and progress counter dynamically
- Cantillation marks toggle is reactive and immediate
- Settings panel is comprehensive (9 options)
- Keyboard navigation (Space, arrows, 1/2/3, M, U, ?) is well designed
- Verse completion celebration animation (scale + green checkmark) is satisfying
- Help overlay in focus mode documents all keyboard shortcuts

### What Needs Work
- Progress counter may show incorrect values due to verse key collision (Bug #1)
- Focus mode shows empty Rashi box for verses without commentary
- Hebrew text may not render in correct font (Bug #4)
- Rashi text definitely not rendering in Rashi script (Bug #8)
- No onboarding in main view (help only in focus mode)
- "Show Cantillation Marks" checkbox had inconsistent style
- Auto-detected parsha is wrong due to year cap (Bug #2)

---

## PRIORITY FIX ORDER

| Priority | Bug # | Issue | Effort | Status |
|----------|-------|-------|--------|--------|
| 1 | #1 | Verse key collision (data corruption) | Low | FIXED |
| 2 | #4 | SBL Hebrew font 404 | Trivial | FIXED |
| 3 | #8 | Rashi font @font-face | Trivial | FIXED |
| 4 | #2 | Year cap = wrong parsha | Trivial | FIXED |
| 5 | #3 | JSON.parse crash protection | Low | FIXED |
| 6 | #5 | Memory leak (hashchange) | Trivial | FIXED |
| 7 | #10 | Clean up style.css scaffold | Low | FIXED |
| 8 | #6 | RTL arrow keys | Low | FIXED |
| 9 | #16 | Delete unused HelloWorld.vue | Trivial | FIXED |
| 10 | #9 | Cache data to avoid re-fetch | Medium | TODO |
| 11 | #11 | Hide empty Rashi in focus mode | Trivial | N/A (already guarded) |

## FIXES APPLIED (2026-02-09)

1. **Bug #1 - Verse key collision**: Changed `${verse.perek || ''}:${verse.pasuk}` to `${verse.perekNum}:${verse.pasukNum}` in FocusMode.vue, ParshaDisplay.vue (2 locations), and VerseView.vue. Old progress data with Hebrew-letter keys is orphaned but harmless.
2. **Bug #4 - SBL Hebrew font 404**: Changed `url('/SBLHebrew.woff2') format('woff2')` to `url('/SBL_Hbrw.ttf') format('truetype')` in App.vue.
3. **Bug #8 - Rashi font**: Added `@font-face` declaration for `'Rashi'` font pointing to `/Mekorot-Rashi.ttf` in App.vue.
4. **Bug #2 - Year cap**: Removed `Math.min(new Date().getFullYear(), 2024)` cap in useParsha.js. Now uses actual current year.
5. **Bug #3 - JSON.parse crash**: Added try/catch in both useProgress.js and useSettings.js `loadProgress()`/`loadSettings()` functions.
6. **Bug #5 - Memory leak**: Added `onUnmounted` cleanup for hashchange listener in App.vue.
7. **Bug #10 - style.css**: Replaced Vite scaffold dark theme defaults with minimal reset (font smoothing + body margin/min-height only).
8. **Bug #6 - RTL arrows**: Swapped ArrowRight/ArrowLeft handlers in both FocusMode.vue and ParshaDisplay.vue so right=backward and left=forward (RTL convention).
9. **Bug #16 - HelloWorld.vue**: Deleted unused Vite scaffold component.
