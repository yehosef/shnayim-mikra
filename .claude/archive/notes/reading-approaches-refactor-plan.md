# Reading Approaches Refactor Plan

**Date:** 2025-10-21
**Status:** Planning Phase
**Goal:** Restructure tracking from "aliyah phases" to "flexible reading approaches" with enhanced list UX

---

## Background

The current implementation (just built) uses a three-phase aliyah tracking system:
- Rishon (1st Torah reading of aliyah)
- Sheni (2nd Torah reading of aliyah)
- Shlishi (Targum reading of aliyah)

**Problem:** This doesn't match how people actually study Shnayim Mikra V'Echad Targum. There are two common approaches:

### Approach A: Pasuk-by-Pasuk
1. Read Pasuk 1 Torah (1st time)
2. Read Pasuk 1 Torah (2nd time)
3. Read Pasuk 1 Targum (once)
4. Move to Pasuk 2, repeat

### Approach B: Aliyah-by-Aliyah
1. Read ALL pasukim in Aliyah 1 Torah (1st time)
2. Read ALL pasukim in Aliyah 1 Torah (2nd time)
3. Read ALL pasukim in Aliyah 1 Targum (once)
4. Move to Aliyah 2, repeat

---

## Requirements

### User Experience
- **Enhanced List View:** Scrollable list where current item is large/centered, completed items above (small/dim), upcoming items below (small/lighter)
- **Single Focus:** User sees what they need to read RIGHT NOW prominently
- **Spacebar to Complete:** Mark current reading done → brief animation (100-200ms) → pan to next item
- **Smart Daily Navigation:**
  - Show indicator if yesterday's aliyah incomplete
  - "Jump to Today's Aliyah" button
  - Allow reading ahead or catching up

### Settings
- **Reading Approach:** Pasuk-by-Pasuk or Aliyah-by-Aliyah
- **Auto-Advance Aliyah:** Optional daily progression
- **Location:** Israel or Diaspora (already exists, affects Hebcal calendar)
- **Targum Type:** Onkelos, Rashi, or English (already exists)

### Auto-Redirect
- On home page load, use Hebcal to detect current week's parsha
- Redirect to `/#/{parsha-name}` based on Israel/Diaspora setting
- Allow manual navigation to any parsha

### Daily Aliyah Mapping
Traditional weekly study schedule:
- **Monday:** Aliyah 1-2
- **Tuesday:** Aliyah 3
- **Wednesday:** Aliyah 4
- **Thursday:** Aliyah 5
- **Friday:** Aliyah 6-7
- **Shabbat/Sunday:** Review

---

## Architecture Design

### 1. Reading Items Generator (`useReadingItems.js`)

**Purpose:** Convert parsha data + approach → linear list of reading items

**Pasuk-by-Pasuk Output:**
```js
[
  {
    id: 'bereshit-1-0-torah-1',
    aliyahNum: 1,
    perek: 1,
    pasuk: 0,
    verses: [verseObject],
    type: 'torah',
    iteration: 1,
    label: 'Bereishit 1:1, Torah (1st)'
  },
  {
    id: 'bereshit-1-0-torah-2',
    aliyahNum: 1,
    perek: 1,
    pasuk: 0,
    verses: [verseObject],
    type: 'torah',
    iteration: 2,
    label: 'Bereishit 1:1, Torah (2nd)'
  },
  {
    id: 'bereshit-1-0-targum-1',
    aliyahNum: 1,
    perek: 1,
    pasuk: 0,
    verses: [verseObject],
    type: 'targum',
    iteration: 1,
    label: 'Bereishit 1:1, Targum'
  },
  // ... continues for every pasuk in parsha
]
```

**Aliyah-by-Aliyah Output:**
```js
[
  {
    id: 'bereshit-a1-torah-1',
    aliyahNum: 1,
    verses: [array of all aliyah 1 verse objects],
    type: 'torah',
    iteration: 1,
    label: 'Aliyah 1, Torah (1st)'
  },
  {
    id: 'bereshit-a1-torah-2',
    aliyahNum: 1,
    verses: [array of all aliyah 1 verse objects],
    type: 'torah',
    iteration: 2,
    label: 'Aliyah 1, Torah (2nd)'
  },
  {
    id: 'bereshit-a1-targum-1',
    aliyahNum: 1,
    verses: [array of all aliyah 1 verse objects],
    type: 'targum',
    iteration: 1,
    label: 'Aliyah 1, Targum'
  },
  // ... continues for all 7 aliyot (21 total items)
]
```

**Data Source:**
- Load aliyot boundaries from `/public/data/aliyot.json` (already exists)
- Use verse data from `useData` composable

**Key Methods:**
```js
function generateReadingItems(parsha, verses, aliyotData, approach)
function getReadingItemById(id)
function getItemsByAliyah(aliyahNum)
```

---

### 2. Reading Progress Tracker (`useReadingProgress.js`)

**Purpose:** Track which reading items are completed

**localStorage Schema:**
```js
{
  version: 2,
  state: {
    "bereshit": {
      date: "2025-10-21",
      approach: "pasuk",  // or "aliyah"
      currentItemId: "bereshit-1-5-torah-1",
      completedItems: [
        "bereshit-1-0-torah-1",
        "bereshit-1-0-torah-2",
        "bereshit-1-0-targum-1",
        // ...
      ]
    }
  }
}
```

**Key Methods:**
```js
function initializeParsha(parsha, readingItems)
function getCurrentItem()
function completeCurrentItem() // Mark done, show animation, advance
function jumpToItem(itemId)
function resetProgress()
function getProgressStats() // { completed: 15, total: 200, percentComplete: 7.5 }
```

**Animation Logic:**
- On spacebar press → mark item complete
- Show checkmark on item (150ms fade)
- Scroll/pan to next item (100-150ms smooth transition)

---

### 3. Daily Aliyah Helper (`useDailyAliyah.js`)

**Purpose:** Map Jewish calendar date → recommended aliyah

**Uses `@hebcal/core` for:**
- Get current day of Jewish week
- Detect if it's Shabbat/holiday
- Calculate days until Shabbat

**Logic:**
```js
function getTodaysAliyah() {
  const hebrewDate = new HDate()
  const dayOfWeek = hebrewDate.getDay() // 0=Sunday, 6=Shabbat

  switch(dayOfWeek) {
    case 1: return [1, 2]  // Monday
    case 2: return [3]     // Tuesday
    case 3: return [4]     // Wednesday
    case 4: return [5]     // Thursday
    case 5: return [6, 7]  // Friday
    default: return null   // Shabbat/Sunday (review)
  }
}

function getIncompleteAliyot(completedItems, readingItems) {
  // Return array of aliyah numbers not fully completed
}

function showYesterdayWarning() {
  // Compare yesterday's expected aliyot vs completed
}
```

---

### 4. Enhanced List View Component (`ReadingListView.vue`)

**Visual Design:**

```
┌─────────────────────────────────────┐
│  [Completed items - small, dim]     │
│    ✓ Torah 1st - opacity: 0.5      │
│    ✓ Torah 2nd - opacity: 0.5      │
│    ✓ Targum    - opacity: 0.5      │
├─────────────────────────────────────┤
│                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃ CURRENT ITEM - LARGE       ┃   │ ← Centered
│  ┃ Bereishit 1:5, Torah (1st) ┃   │
│  ┃ [Hebrew text here...]      ┃   │
│  ┃                            ┃   │
│  ┃ Press SPACE to mark done   ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
├─────────────────────────────────────┤
│  [Upcoming items - smaller]         │
│    Torah 2nd - opacity: 0.7        │
│    Targum - opacity: 0.7           │
│    [more items...]                 │
└─────────────────────────────────────┘
```

**CSS Transforms:**
```css
.reading-item.completed {
  transform: scale(0.6);
  opacity: 0.5;
  filter: grayscale(0.3);
}

.reading-item.current {
  transform: scale(1.0);
  opacity: 1.0;
  border: 3px solid #3b82f6;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
}

.reading-item.upcoming {
  transform: scale(0.7);
  opacity: 0.7;
}
```

**Scroll Behavior:**
```js
function scrollToCurrentItem() {
  const currentEl = document.querySelector('.reading-item.current')
  currentEl?.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  })
}
```

**Completion Animation:**
```js
function completeCurrentReading() {
  showCheckmark() // 150ms fade-in
  setTimeout(() => {
    advanceToNext() // Update current item ID
    scrollToCurrentItem() // 100-150ms pan
  }, 150)
}
```

---

### 5. Settings Enhancement

**Modify `useSettings.js`:**

Add new settings:
```js
{
  // Existing
  targumType: 'onkelos',  // 'onkelos' | 'rashi' | 'english'
  location: 'israel',     // 'israel' | 'chul'
  showTrop: true,
  showRashi: false,
  fontSize: 18,

  // NEW
  readingApproach: 'pasuk',    // 'pasuk' | 'aliyah'
  autoAdvanceAliyah: false,    // Auto-jump to today's aliyah
  completionDelay: 150         // Milliseconds for animation
}
```

---

### 6. Auto-Redirect Logic

**Modify `App.vue` or router:**

```js
import { useParsha } from '@/composables/useParsha'
import { useSettings } from '@/composables/useSettings'

const { getWeeklyParsha } = useParsha()
const { settings } = useSettings()

// On app mount or route guard
if (window.location.hash === '' || window.location.hash === '#/') {
  const currentParsha = getWeeklyParsha(settings.location)
  window.location.hash = currentParsha
}
```

---

## Files to Create

### New Files
1. **`src/composables/useReadingItems.js`** (~200 lines)
   - Generate linear reading list based on approach
   - Load aliyot from `/public/data/aliyot.json`

2. **`src/composables/useReadingProgress.js`** (~250 lines)
   - Replace `useAliyahNavigation.ts`
   - Track completion by item ID
   - Handle animations and advancement

3. **`src/components/ReadingListView.vue`** (~400 lines)
   - Enhanced scrolling list UI
   - Visual scaling and animations
   - Spacebar and click handlers

4. **`src/composables/useDailyAliyah.js`** (~150 lines)
   - Jewish calendar integration
   - Day-to-aliyah mapping
   - Incomplete aliyah detection

### Files to Modify
1. **`src/composables/useSettings.js`**
   - Add `readingApproach`, `autoAdvanceAliyah`, `completionDelay`

2. **`src/components/ParshaDisplay.vue`**
   - Import and render `ReadingListView`
   - Pass reading items and settings

3. **`src/App.vue`** or router
   - Add auto-redirect to current parsha

### Files to Delete
1. **`src/composables/useAliyahNavigation.ts`** - Replaced by `useReadingProgress.js`
2. **`.claude/notes/verse-progress-design.md`** - Outdated approach
3. **`.claude/notes/verse-progress-implementation.md`** - Outdated approach

### Files to Keep
- `/public/data/aliyot.json` - Already has aliyah boundaries
- `src/composables/useParsha.js` - Already has Hebcal integration
- `src/composables/useData.js` - Loads verse data (no changes needed)
- `src/composables/useProgress.js` - Old per-verse tracking (keep for compatibility)

---

## Implementation Sequence

1. **Phase 1: Data Layer** (~2 hours)
   - Create `useReadingItems.js`
   - Test both approaches generate correct item lists
   - Verify aliyot boundaries load correctly

2. **Phase 2: Progress Tracking** (~2 hours)
   - Create `useReadingProgress.js`
   - Implement localStorage schema
   - Test completion tracking

3. **Phase 3: Daily Logic** (~1 hour)
   - Create `useDailyAliyah.js`
   - Test day-to-aliyah mapping
   - Verify Hebrew calendar integration

4. **Phase 4: UI Component** (~3 hours)
   - Create `ReadingListView.vue`
   - Implement visual scaling
   - Add animations and transitions
   - Test spacebar and click handlers

5. **Phase 5: Integration** (~1 hour)
   - Update settings
   - Wire up ParshaDisplay
   - Add auto-redirect
   - Clean up old files

6. **Phase 6: Testing** (~1 hour)
   - Test both approaches end-to-end
   - Verify animations smooth
   - Test daily aliyah logic
   - Check auto-redirect

**Total Estimate:** ~10 hours

---

## Migration Strategy

**localStorage Migration:**
```js
// Detect old format (useAliyahNavigation)
if (stored.key === 'shnayim-aliyah-progress') {
  // Migrate to new format
  // Map old aliyah phases → new reading items
}
```

**Backward Compatibility:**
- Keep old verse-level progress (`useProgress.js`) for now
- Can remove after new system stable

---

## Open Questions for User

1. **Animation Duration:** 150ms total OK? (100ms pan + 50ms buffer)
2. **Completion Visual:** Checkmark on item or separate overlay?
3. **Item Labeling:** Prefer Hebrew or English labels? ("ראשון" vs "1st reading")
4. **Mobile UX:** Same panning list or different approach for small screens?
5. **Progress Reset:** Should daily reset be automatic or manual?

---

## Success Metrics

✅ User can choose between pasuk/aliyah approaches in settings
✅ Reading list displays with proper visual scaling
✅ Spacebar completes current item and pans smoothly to next
✅ Daily aliyah helper shows what to read today
✅ Warning shows if yesterday's aliyah incomplete
✅ Auto-redirects to current week's parsha
✅ Progress persists across sessions
✅ Animations feel smooth (100-200ms range)

---

## Notes

- The enhanced list view is the key UX innovation here
- Keep it simple: one clear action (spacebar), one visual focus (current item)
- Don't overthink daily scheduling - make it helpful but not restrictive
- Hebrew calendar integration already exists via `@hebcal/core`
