# Verse Progress Tracker Design

## Feature Overview
Interactive pasuk tracking system for traditional "Shnayim Mikra V'Echad Targum" (two readings + one Targum) study method.

**Core Interaction:**
- Visual pointer shows current pasuk
- Spacebar marks pasuk as done → visual confirmation → brief delay → auto-advance to next pasuk
- Persistent progress tracking

---

## Design Decisions

### 1. Visual Indicator Style
**Decision: Left border accent + subtle background highlight**
- Left: 3-4px accent border (color: primary/gold)
- Background: Very subtle highlight (5-10% opacity)
- Reasoning: Non-intrusive but clear, matches modern UI patterns

### 2. Completion Feedback
**Decision: Checkmark icon + light green background transition**
- Show green checkmark (✓) appearing at end of pasuk
- Fade to light green background briefly
- Then fade/collapse as it moves
- Reasoning: Clear, satisfying visual feedback that reinforces accomplishment

### 3. Delay Timing
**Decision: 600ms delay before auto-advance**
- Long enough to see the checkmark and color change
- Short enough to maintain reading flow
- Configurable via settings later if needed
- Reasoning: Natural reading pace without feeling rushed

### 4. Navigation & Scope
**Decision: Full feature parity across all modes**
- Works in pasuk, parasha, and aliya display modes
- Arrow keys (↑↓) for manual navigation between pasukim
- Click any pasuk to jump/set as current
- Auto-scroll to keep current pasuk in viewport
- Reasoning: Power users want control; casual users get auto-flow

### 5. Progress Persistence
**Decision: localStorage with session-based recovery**
- Saves progress per parsha per session day
- Survives page refresh
- Optional reset button in UI
- Reasoning: Users expect to resume where they left off; localStorage is reliable for this app

### 6. Starting Position
**Decision: Smart resumption with auto-start**
- If resuming same parsha today → resume at last position
- If new parsha → start at first pasuk
- Auto-focus first pasuk on load (ready for spacebar)
- Reasoning: Respects user workflows while providing sensible defaults

### 7. Scope of Implementation
**Decision: Phase 1 focus on core interaction loop**
- Build: progress state, visual indicator, spacebar handler, auto-advance
- Defer: Arrow key navigation, click-to-jump (Phase 2)
- Defer: Settings UI for customization (Phase 2)
- Reasoning: MVP gets core feature working; extensions come later

---

## Implementation Artifacts

### New Files
- `src/composables/useVerseProgress.ts` - State management
- `src/components/VerseProgressPointer.vue` - Visual indicator wrapper
- `src/types/progress.ts` - Type definitions

### Modified Files
- `src/components/VerseView.vue` - Add pointer + completion feedback
- `src/pages/[parsha].vue` or main display component - Wire up spacebar handler

### Storage Schema
```json
{
  "progress": {
    "parsha-name": {
      "date": "2025-10-16",
      "lastPosition": [3, 15],
      "completed": [[1, 0], [1, 1], [1, 2], ...]
    }
  }
}
```

---

## Visual Mockup (Text)
```
┌─ Pasuk 3, Verse 18 ────────────────────────┐
│                                             │
│ ◀ (current) Current pasuk reading content  │
│    with left border accent highlighting    │
│                                             │
└─────────────────────────────────────────────┘

After spacebar:
┌─ Pasuk 3, Verse 18 ────────────────────────┐
│                                             │
│ ✓ (completed) Fades green, then advances   │
│    [600ms pause]                            │
│                                             │
└─────────────────────────────────────────────┘

┌─ Pasuk 3, Verse 19 ────────────────────────┐
│                                             │
│ ◀ (current) Next pasuk ready for spacebar  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Notes for Later Review
- Consider keyboard combinations (Shift+Space to undo/go back?)
- Stats dashboard showing parsha % complete?
- Dark mode adaptation of colors?
- Mobile: gesture alternative to spacebar?
