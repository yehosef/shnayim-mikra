# Critical Bugs & UX Issues Found

## Bug #1: Aliyot Extraction Off-By-One Error
**File**: `src/composables/useReadingItems.js` (lines 17-63)

**Problem**:
```javascript
let currentAliyahNum = 1  // Starts at 1
verses.forEach((verse) => {
  if (verse.aliya) {
    // Save previous aliyah (but on FIRST aliyah, this is empty!)
    if (currentAliyahVerses.length > 0) {
      aliyot[currentAliyahNum] = { ... }  // Never executes for first aliyah
    }

    currentAliyahNum++  // Increments to 2 on first aliyah!
    currentAliyahStart = { ... }
    currentAliyahVerses = [verse]
  } else {
    currentAliyahVerses.push(verse)  // First verses go nowhere!
  }
})
```

**Result**:
- Aliyah 1 is labeled as Aliyah 2
- Aliyah 2 is labeled as Aliyah 3
- Aliyah 7 is labeled as Aliyah 8
- First verse(s) before aliyah marker are LOST

**Fix Needed**:
Start with `currentAliyahNum = 0` OR don't increment on first encounter

---

## Bug #2: Missing Verses Before First Aliyah Marker
**File**: `src/composables/useReadingItems.js`

**Problem**:
- useData.js only sets `verse.aliya` property for verses at aliyah START positions
- First verse of parsha (Bereishit 1:1) doesn't have `.aliya` unless it's an aliyah start
- These verses are added to `currentAliyahVerses` but never saved

**Result**:
- Verses before the first aliyah marker are missing from all aliyot

**Fix Needed**:
Initialize first aliyah outside the loop

---

## Bug #3: Missing Verse Text in UI
**File**: `src/components/ReadingListView.vue` (lines 61-70)

**Problem**:
```vue
<div v-if="isCurrent(item.id) || isUpcoming(item.id)" class="item-text">
  <div v-for="verse in item.verses.slice(0, 5)">
    <span class="verse-content">{{ getVersePreview(verse) }}</span>
  </div>
</div>
```

Where `getVersePreview` returns:
```javascript
return text.substring(0, 60) + '...'
```

**Result**:
- User sees only 60 characters of each verse (truncated preview)
- Cannot actually READ the full text
- For aliyah mode with 20+ verses, seeing 5 truncated verses is useless

**Fix Needed**:
- Show FULL text of all verses in current reading item
- Different display for torah vs targum
- Format properly for reading (not just preview)

---

## UX Issue #1: No Distinction Between Torah and Targum Display
**File**: `src/components/ReadingListView.vue`

**Problem**:
- Item shows `verse.torah` but type could be 'torah' or 'targum'
- No logic to show `verse.targum` when `item.type === 'targum'`

**Result**:
- User sees Torah text even when they should be reading Targum

**Fix Needed**:
```vue
<div v-if="item.type === 'torah'">{{ verse.torah }}</div>
<div v-else-if="item.type === 'targum'">{{ verse.targum }}</div>
```

---

## UX Issue #2: Visual Scaling Makes Text Unreadable
**File**: `src/components/ReadingListView.vue` (CSS lines 350-370)

**Problem**:
```css
.reading-item.is-completed {
  transform: scale(0.6);  /* 60% size */
}

.reading-item.is-upcoming {
  transform: scale(0.7);  /* 70% size */
}
```

**Result**:
- Upcoming items at 70% scale are hard to read
- User needs to see what's coming next clearly

**Fix Needed**:
- Don't scale down as aggressively (maybe 0.85-0.9)
- OR hide text completely for non-current items

---

## UX Issue #3: Missing Text Formatting
**Problem**:
- Hebrew text needs proper line-height and spacing
- No distinction between pasuk markers and text
- Trop/nekudot handling missing

**Fix Needed**:
- Apply `font-sbl` class
- Format with proper line-height (1.8)
- Use `formatHebrewText()` utility from existing code

---

## UX Issue #4: Progress Stats Wrong
**File**: `src/components/ReadingListView.vue` (line 26)

**Problem**:
```javascript
const yesterdayWarning = computed(() => {
  const incomplete = getIncompleteAliyot(
    progressStats.value?.completedItemIds || [],  // WRONG
    props.readingItems
  )
})
```

**Result**:
- `progressStats.value` doesn't have `completedItemIds` property
- That's in `progressState.value[parsha].completedItemIds`

**Fix Needed**:
Access correct data structure from useReadingProgress

---

## Summary of Fixes Needed

1. **Fix aliyot extraction logic** (critical - no data without this)
2. **Show full verse text** (critical - can't read without this)
3. **Display correct text type** (torah vs targum)
4. **Format Hebrew text properly** (readability)
5. **Fix progress stats access** (yesterday warning won't work)
6. **Adjust visual scaling** (UX improvement)
