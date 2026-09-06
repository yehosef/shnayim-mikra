# Vite Conversion Strategy

## Decision: Start Fresh (Not Convert)

**Reasoning:**
- Current app is relatively simple (~240 lines main component)
- Most Nuxt features aren't being heavily used
- Starting fresh = **~6-8 hours** vs converting = **~10-15 hours**
- Cleaner architecture without Nuxt baggage
- Easier to add progress tracking from the start

## What We're Building

A simple, offline-first Torah study app with:
1. Display Torah verses with Targum, Rashi, and English
2. Progress tracking: 2× Hebrew reading + 1× Targum/Rashi/English
3. Weekly parsha detection using @hebcal/core
4. Three display modes: verse, paragraph, aliya
5. Settings stored in localStorage
6. Works completely offline (PWA later)

## Architecture Overview

```
shnayim-vite/
├── public/
│   ├── data/              # All JSON files (Torah, Targum, Rashi, English, meforshim)
│   └── fonts/             # Hebrew fonts
├── src/
│   ├── components/
│   │   ├── ParshaDisplay.vue    # Main display component
│   │   ├── VerseView.vue        # Single verse with tracking checkboxes
│   │   ├── Settings.vue         # Settings panel
│   │   └── Navigation.vue       # Parsha selector
│   ├── composables/
│   │   ├── useSettings.js       # localStorage-based settings
│   │   ├── useProgress.js       # Progress tracking
│   │   ├── useParsha.js         # Parsha detection (@hebcal/core)
│   │   └── useData.js           # Data loading from public/
│   ├── data/
│   │   └── parshiyot.js         # Parsha definitions (copied from server/)
│   ├── App.vue
│   └── main.js
└── index.html
```

## Key Changes from Nuxt

| Nuxt Feature | Vite Replacement |
|--------------|------------------|
| File-based routing | Hash routing (`#parasha-name`) |
| `useFetch('/api/data')` | `fetch('/data/torah/bereishit.json')` |
| `useCookie('settings')` | `localStorage.getItem('settings')` |
| Auto-imports | Explicit imports |
| Nuxt UI components | Simple HTML + CSS |
| API routes | Direct JSON file access |

## Implementation Plan

### Phase 1: Project Setup (~30 min)
- [x] Create Vite + Vue project
- [ ] Install dependencies: @hebcal/core, @hebcal/rest-api
- [ ] Configure vite.config.js for RTL
- [ ] Copy fonts from existing project

### Phase 2: Data Migration (~15 min)
- [ ] Copy server/assets/* → public/data/
- [ ] Copy server/parshiyot.ts → src/data/parshiyot.js
- [ ] Verify JSON structure

### Phase 3: Core Utilities (~2 hours)
- [ ] `useSettings.js` - localStorage wrapper
- [ ] `useParsha.js` - weekly parsha detection
- [ ] `useData.js` - load Torah/Targum/Rashi/English
- [ ] Hash routing logic

### Phase 4: Components (~2-3 hours)
- [ ] Navigation component (parsha selector)
- [ ] Settings panel component
- [ ] VerseView component (single verse with tracking)
- [ ] ParshaDisplay component (main display logic)

### Phase 5: Progress Tracking (~1-2 hours)
- [ ] `useProgress.js` - track 2×Hebrew + 1×Targum
- [ ] Add checkboxes to verse display
- [ ] Progress summary view
- [ ] Reset/clear progress

### Phase 6: Polish (~1 hour)
- [ ] Dark mode toggle
- [ ] Print styles
- [ ] Responsive design
- [ ] Loading states

## Data Loading Strategy

**Instead of Nuxt API routes:**
```javascript
// Old Nuxt way
const { data } = await useFetch(`/api/data/${parasha}`)

// New Vite way
const loadParsha = async (parasha) => {
  const parshaDef = parshiyot[parasha]
  const chumash = parshaDef.chumash

  const [torah, targum, rashi, english] = await Promise.all([
    fetch(`/data/torah/${chumash}.json`).then(r => r.json()),
    fetch(`/data/targum/${chumash}.json`).then(r => r.json()),
    fetch(`/data/rashi/${chumash}.json`).then(r => r.json()),
    fetch(`/data/english/${chumash}.json`).then(r => r.json()),
  ])

  // Extract verses for this parsha
  return extractVersesForParsha(parshaDef, torah, targum, rashi, english)
}
```

## Settings Storage

**Instead of useCookie:**
```javascript
// composables/useSettings.js
import { ref, watch } from 'vue'

const defaults = {
  order: 'pasuk',
  showRashi: false,
  location: 'israel',
  fontSize: 20,
  aliyaByDay: false,
  fontRashi: true,
  disableMeforshim: false,
  studyMode: false,          // NEW: enable progress tracking
  targumType: 'onkelos',     // NEW: onkelos | rashi | english
  showEnglish: false,        // NEW: display English alongside
}

export function useSettings() {
  const settings = ref(loadSettings())

  watch(settings, (val) => {
    localStorage.setItem('shnayim-settings', JSON.stringify(val))
  }, { deep: true })

  return { settings }
}

function loadSettings() {
  const stored = localStorage.getItem('shnayim-settings')
  return stored ? { ...defaults, ...JSON.parse(stored) } : defaults
}
```

## Progress Tracking Structure

```javascript
// composables/useProgress.js
const progressStructure = {
  "bereshit": {
    "1:1": { hebrew1: true, hebrew2: true, targum: true },
    "1:2": { hebrew1: true, hebrew2: false, targum: false },
    // ... all verses
  },
  "noach": { ... }
}

// Stored in localStorage as 'shnayim-progress'
```

## Routing Strategy

**Simple hash-based routing:**
- `/#bereshit` → Parsha Bereshit
- `/#` or `/` → Redirect to weekly parsha

```javascript
// Simple router
const currentParsha = ref(getCurrentParsha())

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1)
  currentParsha.value = hash || getWeeklyParsha()
})

// Set initial parsha
if (!window.location.hash) {
  window.location.hash = getWeeklyParsha()
}
```

## Dependencies

**Minimal:**
```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "@hebcal/core": "^5.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-vue": "^5.0.0"
  }
}
```

**No longer needed:**
- nuxt (50+ packages!)
- @nuxt/ui
- @nuxtjs/color-mode
- sitemap
- robots
- gtag

## Estimated Timeline

| Phase | Time |
|-------|------|
| Setup | 30 min |
| Data migration | 15 min |
| Core utilities | 2 hours |
| Components | 2-3 hours |
| Progress tracking | 1-2 hours |
| Polish | 1 hour |
| **Total** | **~6-8 hours** |

## Success Criteria

- [ ] Can view any parsha
- [ ] Automatically shows weekly parsha
- [ ] Three display modes work (pasuk, parasha, aliya)
- [ ] Can toggle Rashi display
- [ ] Can lazy-load meforshim
- [ ] Study mode tracks 2×Hebrew + 1×Targum
- [ ] Can choose targum type (Onkelos/Rashi/English)
- [ ] Settings persist across sessions
- [ ] Progress persists across sessions
- [ ] Works completely offline
- [ ] Dark mode works
- [ ] Print-friendly
- [ ] Responsive on mobile

## Next Steps

1. Create new Vite project: `npm create vite@latest shnayim-vite -- --template vue`
2. Install @hebcal/core
3. Start with Phase 2 (data migration)
4. Build incrementally, testing as we go
