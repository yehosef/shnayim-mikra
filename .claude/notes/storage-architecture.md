# Storage Architecture for Personal Progress Tracking

## Requirements

For tracking Shnayim Mikra progress, we need to store:
- **Per-verse progress**: Which verses have been read 2× Hebrew + 1× additional
- **Reading state**: hebrew1, hebrew2, targum/rashi/english completion status
- **Parsha completion**: Overall progress per parsha
- **User preferences**: Reading methodology, display settings
- **Timestamp tracking**: When readings were completed (for weekly reset)

### Data Size Estimate
- ~54 parshiyot per year
- Average ~100 verses per parsha
- ~5,400 verses total
- Per verse: `{ hebrew1: bool, hebrew2: bool, additional: bool, timestamp: number }`
- **~50KB per year** of progress data (very small)

## Storage Options Comparison

### Option 1: LocalStorage (Simplest) ⭐ RECOMMENDED

**Pros:**
- ✅ Zero dependencies, works everywhere
- ✅ Synchronous API (simple to use)
- ✅ Perfect for our small data size (<5-10MB limit)
- ✅ Already used in project (settings via useCookie)
- ✅ No setup required
- ✅ Extremely fast for small datasets

**Cons:**
- ❌ 5-10MB limit (not an issue for us)
- ❌ Synchronous (can block, but negligible for our size)
- ❌ String-only storage (must JSON.stringify/parse)

**Use Case Fit:** ✅ Excellent - Our data is tiny, simple key-value pairs

**Implementation:**
```javascript
// Store progress
localStorage.setItem('smvt-progress', JSON.stringify({
  'bereshit': {
    'verse-1-1': { hebrew1: true, hebrew2: true, targum: true, timestamp: 1234567890 },
    'verse-1-2': { hebrew1: true, hebrew2: false, targum: false }
  }
}))

// Retrieve progress
const progress = JSON.parse(localStorage.getItem('smvt-progress') || '{}')
```

---

### Option 2: IndexedDB (Overkill but Future-proof)

**Pros:**
- ✅ Large storage capacity (50% of disk space)
- ✅ Asynchronous (non-blocking)
- ✅ Supports complex queries and indexing
- ✅ Transactions for data integrity
- ✅ Can store files, blobs, complex objects

**Cons:**
- ❌ Complex API (requires wrapper like `idb` or `Dexie.js`)
- ❌ Overkill for our small dataset
- ❌ Safari auto-deletes when low on storage
- ❌ Firefox disables in private browsing
- ❌ More code to maintain

**Use Case Fit:** ⚠️ Over-engineered - We don't need this power

**When to Upgrade:**
- If we store audio pronunciations
- If we cache entire Torah text offline
- If we add complex querying (e.g., "show all incomplete verses")

---

### Option 3: Firebase Firestore (Free tier available)

**Pros:**
- ✅ Real-time sync across devices
- ✅ Works without login (anonymous auth)
- ✅ Generous free tier (1GB storage, 50K reads/day)
- ✅ Automatic backups
- ✅ Can add social features later (shared progress)

**Cons:**
- ❌ Requires internet connection (defeats offline PWA goal)
- ❌ Vendor lock-in (Google service)
- ❌ More complex setup (Firebase SDK ~100KB)
- ❌ Privacy concerns (data stored on Google servers)
- ❌ Free tier limits (could be exceeded with many users)
- ❌ Latency for every read/write

**Use Case Fit:** ❌ Wrong tool - We want offline-first, no login

**When to Consider:**
- Multi-device sync requirement emerges
- Social features (leaderboards, study groups)
- Backend analytics needed

---

### Option 4: Hybrid Approach (LocalStorage + Optional Sync)

**Pros:**
- ✅ Start with LocalStorage (simple, fast, offline)
- ✅ Add optional Firebase sync later if needed
- ✅ Best of both worlds: offline-first + optional cloud backup
- ✅ Progressive enhancement

**Implementation:**
```javascript
// Always write to localStorage (instant)
localStorage.setItem('smvt-progress', JSON.stringify(progress))

// Optionally sync to cloud (if user enables it)
if (settings.cloudSync && navigator.onLine) {
  await firebase.firestore().collection('progress').doc(userId).set(progress)
}
```

---

## Recommendation: Start with LocalStorage

### Why LocalStorage is Perfect for This Project

1. **Data size is tiny** - 50KB/year vs. 5-10MB limit (100× headroom)
2. **Simple mental model** - Just JSON in/out
3. **Zero dependencies** - No libraries, no setup
4. **Offline-first by default** - Works without internet
5. **Fast** - Synchronous is fine for small data
6. **Already in use** - Project uses `useCookie` for settings (similar API)
7. **Privacy-friendly** - Data stays on device
8. **No login required** - True anonymous usage

### Migration Path (If Needed Later)

If requirements change:
1. **Add IndexedDB** if storing audio/images
2. **Add Firebase** if multi-device sync becomes critical
3. **Hybrid** for optional cloud backup while keeping offline-first

### Nuxt 3 PWA Setup with LocalStorage

```bash
# Install PWA module
npm install @vite-pwa/nuxt -D
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@vite-pwa/nuxt'],
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Shnayim Mikra',
      short_name: 'SMVT',
      theme_color: '#000000',
      icons: [/* ... */]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: true
    }
  }
})
```

### Data Structure Proposal

```typescript
// Composable: useProgress.ts
type ReadingState = {
  hebrew1: boolean
  hebrew2: boolean
  targum: boolean
  rashi?: boolean
  english?: boolean
  timestamp: number
}

type ParshaProgress = {
  [verseKey: string]: ReadingState
}

type Progress = {
  [parshaName: string]: ParshaProgress
}

export const useProgress = () => {
  const STORAGE_KEY = 'smvt-progress'

  const getProgress = (): Progress => {
    if (process.client) {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    }
    return {}
  }

  const setProgress = (progress: Progress) => {
    if (process.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    }
  }

  const updateVerse = (parsha: string, verseKey: string, state: ReadingState) => {
    const progress = getProgress()
    if (!progress[parsha]) progress[parsha] = {}
    progress[parsha][verseKey] = { ...state, timestamp: Date.now() }
    setProgress(progress)
  }

  const resetParsha = (parsha: string) => {
    const progress = getProgress()
    delete progress[parsha]
    setProgress(progress)
  }

  const isVerseComplete = (state: ReadingState): boolean => {
    // 2× Hebrew + at least 1× additional (targum/rashi/english)
    return state.hebrew1 && state.hebrew2 &&
           (state.targum || state.rashi || state.english)
  }

  return {
    getProgress,
    setProgress,
    updateVerse,
    resetParsha,
    isVerseComplete
  }
}
```

### Weekly Auto-Reset Strategy

```typescript
// Check if parsha should reset (new week)
const shouldResetParsha = (parsha: string, weeklyParshaName: string): boolean => {
  // If viewing last week's parsha, offer to reset
  return parsha !== weeklyParshaName
}

// Or reset based on timestamp (Tuesday midnight deadline)
const isProgressExpired = (timestamp: number): boolean => {
  const deadline = getNextTuesday() // Calculate from Shabbat
  return Date.now() > deadline
}
```

## Implementation Plan

### Phase 1: Basic Progress Tracking ✅
- Add `useProgress` composable with localStorage
- Track hebrew1, hebrew2, targum per verse
- Visual indicators (checkboxes or color coding)
- Persist on every change

### Phase 2: Study Mode UI
- Toggle between "Reading Mode" and "Study Mode"
- In Study Mode: verse-by-verse with completion tracking
- Navigation: can't proceed until verse is complete
- Progress summary view (X/Y verses complete)

### Phase 3: PWA Enhancement
- Add `@vite-pwa/nuxt` module
- Enable offline caching
- Add "Install App" prompt
- Service worker for offline use

### Phase 4 (Future): Optional Enhancements
- Multi-device sync (Firebase anonymous auth)
- Export/import progress (JSON download)
- Weekly completion stats/graphs
- Aliyah-by-day reminders

## Cost Analysis

| Solution | Setup Cost | Runtime Cost | Maintenance |
|----------|-----------|--------------|-------------|
| LocalStorage | $0 | $0 | Minimal |
| IndexedDB | $0 | $0 | Medium (library updates) |
| Firebase Free | $0 | $0* | Medium (quotas, SDK updates) |
| Firebase Paid | $0 | ~$5-25/mo | Medium |

*Firebase free tier: 1GB storage, 50K reads/day, 20K writes/day (likely sufficient for small user base)

## Security & Privacy

### LocalStorage
- ✅ Data stays on device
- ✅ No network transmission
- ⚠️ Accessible via JavaScript (XSS risk)
- ⚠️ Cleared when clearing browser data

### Best Practices
1. Don't store sensitive data (no PII needed anyway)
2. Validate data on read (could be tampered)
3. Handle QuotaExceededError gracefully
4. Offer export/backup feature for user peace of mind

## Final Recommendation

**Use LocalStorage** for MVP with these features:
1. Progress tracking per verse
2. Auto-save on every interaction
3. Weekly auto-reset option
4. Export/import for backup
5. PWA for offline access

**Consider Firebase later only if:**
- Users explicitly request multi-device sync
- Social features become important
- Analytics/insights are needed

This keeps the project simple, fast, privacy-friendly, and truly offline-first.
