# Tracking System Design

## User Requirement

User can choose **which type of "targum"** they want to track for their obligation:
1. **Targum Onkelos** (Aramaic translation)
2. **Rashi** (commentary)
3. **English** (translation)

**Key principle**: All three can be displayed/opened at once (reading mode), but only ONE is tracked for the "echad targum" part of the obligation.

## Current Implementation Analysis

### What Already Exists ✅

From `app/pages/[parasha].vue`:
- **Hebrew text** (Torah): Displayed twice already (lines 143-145)
  - Line 143: First display with verse number
  - Line 145: Second display (full text)
- **Targum Onkelos**: Always loaded and displayed (line 146)
- **Rashi**: Optionally loaded based on `settings.showRashi` (lines 147-149)
- **English**: NOT currently in the data - **NEEDS TO BE ADDED**

### Data Structure

Each verse (`item`) currently has:
```javascript
{
  torah: "בְּרֵאשִׁית...",    // Hebrew text
  targum: "...",              // Targum Onkelos (HTML)
  rashi: ["...", "..."],      // Rashi commentary (array)
  meforshim: ["ramban", ...], // Available additional commentaries
  pasuk: "א",                 // Verse number (Hebrew)
  perek: "א"                  // Chapter number (Hebrew, optional)
}
```

### Missing Pieces 🎯

1. **English translation** - Not in current data
2. **User preference** - Which targum type to track
3. **Progress tracking** - Mark readings as complete

## Proposed Tracking System

### 1. Data Structure for Progress

```typescript
// In useProgress composable
type ReadingState = {
  hebrew1: boolean        // First Hebrew reading ✓
  hebrew2: boolean        // Second Hebrew reading ✓
  targumRead: boolean     // Whichever targum user chose to track ✓
  timestamp: number       // When completed
}

// User settings (extend existing useSettings)
type Settings = {
  // ... existing settings

  // NEW: Which "targum" to track for obligation
  targumType: 'onkelos' | 'rashi' | 'english'  // Default: 'onkelos'

  // NEW: Study mode enabled
  studyMode: boolean  // Default: false
}
```

### 2. Display Logic

**Reading Mode** (current behavior, studyMode = false):
- Show all content based on existing settings
- Targum Onkelos: Always visible
- Rashi: Show if `settings.showRashi === true`
- English: Show if we add it (new setting: `showEnglish`)
- Meforshim: Lazy-loaded badges
- **No tracking UI shown**

**Study Mode** (studyMode = true):
- Show tracking checkboxes/indicators
- Hebrew 1: ☐ (checkbox or click-to-mark)
- Hebrew 2: ☐ (checkbox or click-to-mark)
- Targum: ☐ (checkbox for whichever type user selected)
- All three targum options still visible (user can read all)
- **Only the selected targumType gets tracked**

### 3. UI Mockup for Study Mode

```
┌─────────────────────────────────────────────────────┐
│ Settings: Tracking [ Onkelos ▼ ]  (dropdown)       │  ← User picks which to track
└─────────────────────────────────────────────────────┘

Verse Display:
┌─────────────────────────────────────────────────────┐
│ ☐ Hebrew 1   ☐ Hebrew 2   ☐ Targum                │  ← Tracking row
├─────────────────────────────────────────────────────┤
│ א:א בְּרֵאשִׁית בָּרָא אֱלֹהִים...                │  ← Hebrew (first)
│ בְּרֵאשִׁית בָּרָא אֱלֹהִים...                     │  ← Hebrew (second)
│                                                     │
│ בְּרֵאשִׁית בְּרָא... (Targum Onkelos) ★          │  ← Onkelos (tracked if selected)
│                                                     │
│ בְּרֵאשִׁית - Rashi: ...                           │  ← Rashi (tracked if selected)
│                                                     │
│ In the beginning God created... (English)          │  ← English (tracked if selected)
└─────────────────────────────────────────────────────┘

★ = Visual indicator of which targum is being tracked for obligation
```

### 4. Tracking Interaction Flow

**Scenario 1: User selects "Onkelos" as their targum**
1. User reads Hebrew text, clicks "Hebrew 1" checkbox → ☑
2. User reads Hebrew text again, clicks "Hebrew 2" checkbox → ☑
3. User reads Targum Onkelos, clicks "Targum" checkbox → ☑
4. Verse marked complete ✓ (all three boxes checked)
5. User can ALSO read Rashi/English (displayed), but they're not tracked

**Scenario 2: User selects "Rashi" as their targum**
1. User reads Hebrew text → Hebrew 1 ☑
2. User reads Hebrew text → Hebrew 2 ☑
3. User reads Rashi commentary → Targum ☑ (Rashi counts as the "targum")
4. Verse complete ✓
5. Onkelos and English still visible but not required for completion

**Scenario 3: User selects "English" as their targum**
1. Hebrew 1 ☑, Hebrew 2 ☑
2. English translation → Targum ☑
3. Complete ✓
4. Onkelos and Rashi still visible

### 5. Settings UI

Add to existing settings panel (Slideover component):

```
┌─────────────────────────────────────────────┐
│ Study Mode Settings                         │
├─────────────────────────────────────────────┤
│ □ Enable Study Mode                         │  ← Toggle
│                                             │
│ Track for obligation:                       │
│   ○ Targum Onkelos (default)               │  ← Radio buttons
│   ○ Rashi Commentary                        │
│   ○ English Translation                     │
│                                             │
│ Display options:                            │
│   ☑ Show Targum Onkelos                    │  ← Checkboxes
│   ☑ Show Rashi                              │  (can show all,
│   ☑ Show English                            │   track only one)
└─────────────────────────────────────────────┘
```

### 6. Implementation Plan

#### Phase 1: Add English Translation
- **Backend**: Add English translation to data files
  - Option A: Separate JSON files (like Targum)
  - Option B: Use existing translation API
  - Option C: Add to existing data structure
- **API**: Extend `/api/data/[parasha]` to include English
- **Frontend**: Display English alongside Targum/Rashi

#### Phase 2: Settings for Targum Type
- **Extend `useSettings`** composable:
  ```typescript
  type Settings = {
    // ... existing
    targumType: 'onkelos' | 'rashi' | 'english'  // NEW
    studyMode: boolean                            // NEW
    showEnglish: boolean                          // NEW
  }
  ```
- **Update Slideover**: Add radio buttons for targum selection

#### Phase 3: Progress Tracking Composable
- **Create `useProgress`**:
  ```typescript
  const updateVerseReading = (
    parsha: string,
    verseKey: string,
    readingType: 'hebrew1' | 'hebrew2' | 'targum'
  ) => {
    // Update localStorage
    // Note: 'targum' means whichever type user selected
  }
  ```

#### Phase 4: Study Mode UI
- **Add tracking row** to verse display (when studyMode enabled)
- **Checkboxes** for Hebrew1, Hebrew2, Targum
- **Visual indicator** (★ or highlight) showing which targum is tracked
- **Complete badge** when all three checked

## Data Requirements for English

### Option 1: Add to Existing API (RECOMMENDED)
Extend the existing data structure to include English:

```typescript
// server/api/data/[parasha].ts
type Psuk = {
  torah: string,
  targum: string,
  rashi?: string,
  english?: string,    // NEW
  meforshim?: string[],
  perek?: string
  pasuk: string
  aliya?: string | null
}
```

**Implementation:**
- Add English JSON files to `server/assets/english/` (like torah, targum, rashi)
- Load conditionally based on settings (like Rashi currently)

### Option 2: Use External Translation API
- Sefaria API: https://www.sefaria.org/api
- Chabad.org API (if available)
- **Downside**: Requires internet, slower, less control

### Option 3: Hardcode Popular Translation
- Use public domain translation (e.g., JPS 1917)
- Include in data files
- **Best for offline-first approach**

## Key Design Decisions

### ✅ All three targum types visible simultaneously
**Why**: User might want to read all for comprehension, even if only tracking one

### ✅ User explicitly chooses which to track
**Why**: Different halachic opinions, user preference, understanding level

### ✅ Tracking is separate from display settings
**Why**: "Show Rashi" means display it; "Track Rashi" means count it for obligation

### ✅ "Targum" checkbox adapts to user's choice
**Why**: Simplifies mental model (always 2×Hebrew + 1×Targum, just different targum types)

### ✅ Visual indicator (★) shows what's being tracked
**Why**: Prevents confusion when multiple options are visible

## Example User Flows

### Flow 1: Beginner (English only)
```
Settings:
- Track: English
- Display: Hebrew ✓, Targum ✓, Rashi ✗, English ✓

Study:
1. Read Hebrew (doesn't understand) → Hebrew 1 ✓
2. Read Hebrew again → Hebrew 2 ✓
3. Read English (understands!) → Targum ✓
4. Verse complete, can proceed

Display shows: Hebrew, Targum Onkelos, English
Tracked for obligation: English
```

### Flow 2: Advanced (Rashi + optional Onkelos)
```
Settings:
- Track: Rashi
- Display: All ✓

Study:
1. Read Hebrew → Hebrew 1 ✓
2. Read Hebrew → Hebrew 2 ✓
3. Read Rashi → Targum ✓ (obligation fulfilled)
4. Optionally also reads Onkelos (visible but not tracked)
5. Verse complete

Display shows: Hebrew, Targum, Rashi, English
Tracked for obligation: Rashi
```

### Flow 3: Traditional (Onkelos only)
```
Settings:
- Track: Onkelos
- Display: Hebrew ✓, Targum ✓, Rashi ✗, English ✗

Study:
1-2. Hebrew × 2 → ✓ ✓
3. Targum Onkelos → ✓
Complete

Display shows: Hebrew, Targum only
Tracked: Onkelos
```

## Implementation Summary

### Data Layer
```javascript
// Each verse
{
  torah: "...",
  targum: "...",     // Onkelos
  rashi: [...],      // Commentary
  english: "...",    // NEW - English translation
}
```

### Settings Layer
```javascript
{
  targumType: 'onkelos' | 'rashi' | 'english',  // Which to track
  studyMode: boolean,                            // Show tracking UI
  showEnglish: boolean,                          // Display English
  // existing settings...
}
```

### Progress Layer
```javascript
{
  "bereshit": {
    "1-1": {
      hebrew1: true,
      hebrew2: true,
      targumRead: true,  // Whatever targumType user selected
      timestamp: 123456
    }
  }
}
```

### UI Layer
- **Reading Mode**: Current display (no tracking)
- **Study Mode**: Add tracking row (☐ ☐ ☐) above each verse
- **Indicator**: Show which targum is being tracked (★ or highlight)

---

**Ready to implement** once we decide on English translation source (hardcoded files vs. API).
