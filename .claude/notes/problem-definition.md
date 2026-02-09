# Problem Definition: Shnayim Mikra V'Echad Targum

## The Religious Practice

**Shnayim Mikra V'Echad Targum** (שניים מקרא ואחד תרגום) is a Jewish obligation where one must:
- Read the weekly Torah portion **2 times in Hebrew**
- Read it **1 time with Targum Onkelos** (Aramaic translation)
- Complete this before/during Shabbat (with makeup options through Tuesday)

### Valid Reading Methods
1. **Pasuk-by-pasuk** (verse by verse): Hebrew × 2, Targum × 1, repeat for each verse
2. **Paragraph-based**: Section Hebrew × 2, then section Targum × 1
3. **Whole parsha**: Entire portion Hebrew × 2, then entire Targum × 1

### Additional Practices
- Rashi commentary can substitute for Targum
- Should read with proper cantillation (trop)
- Applies to all Jewish men (women exempt but can participate)
- Even scholars fully immersed in Torah must fulfill this

## Target Users

1. **Observant Jewish men** fulfilling the weekly obligation
2. **Hebrew learners** wanting deeper Torah engagement
3. **Study groups** completing parsha together
4. **People who prefer digital** over printed Chumash
5. **Those seeking progress tracking** to ensure completion
6. **Israeli vs. Diaspora Jews** (different parshas on combined weeks)

## Existing Solutions Analysis

### Mobile Apps
**Shnayim (iOS)**
- ✅ Progress tracking
- ✅ Notes and bookmarks
- ✅ User-friendly interface
- ❌ iOS only
- ❌ Requires app download

**Shnayim Mikra Ve-echad Targum (Android)**
- ✅ Rashi and Onkelos
- ✅ Mobile-friendly
- ❌ Android only
- ❌ Unknown UX quality

### Websites
**Shnayim.com**
- ✅ Web-based (accessible anywhere)
- ✅ Multiple display modes (combined, Rashi, separate)
- ✅ Zoom functionality
- ✅ Israel/Diaspora settings
- ❌ No progress tracking
- ❌ No bookmarking/notes
- ❌ No "2×2×1" reading mode guidance

**ShnayimYomi.org**
- ✅ Daily incremental approach (2-min videos)
- ✅ Community engagement via WhatsApp
- ✅ Breaks parsha into manageable aliyot
- ❌ Video-based (requires watching, not reading)
- ❌ Not self-paced
- ❌ Requires community participation

**OU Torah**
- ✅ Email delivery option
- ✅ Verse-by-verse breakdown
- ❌ Passive consumption (email/audio)
- ❌ No interactive reading

## Problem Gaps in Existing Solutions

### Critical Missing Features
1. **No "reading practice mode"** that enforces/guides the 2×Hebrew + 1×Targum pattern
2. **No verse-level progress tracking** for completion validation
3. **No flexible methodology support** (pasuk-by-pasuk vs. paragraph vs. whole)
4. **Limited accessibility** (platform-locked apps)
5. **No offline capability** for Shabbat use (when devices may be limited)
6. **No aliyah-by-day breakdown** for spreading throughout the week

### UX Pain Points
- Users must manually track which verses they've completed
- No visual feedback on "2 Hebrew readings + 1 additional" completion
- No clear navigation between reading modes
- No print-friendly format for those who prefer paper
- No responsive design optimized for mobile reading during commute

## Core Problem Statement

**Jewish men need a flexible, accessible way to complete their weekly Shnayim Mikra obligation that:**
1. Supports multiple reading methodologies (pasuk/paragraph/whole)
2. Tracks progress per verse to ensure proper completion (2×Hebrew + 1×Targum/Rashi)
3. Works on any device (responsive web)
4. Supports both Israeli and Diaspora calendars
5. Offers aliyah-based breakdown for daily reading
6. Provides clear visual feedback on completion status
7. Works offline (PWA) for Shabbat use cases
8. Includes full commentaries (Rashi + meforshim) as valid Targum alternatives
9. Adapts to user preferences (font size, display order, commentaries)
10. Offers print-friendly format for traditional learners

## Competitive Advantages of Our Solution

### Already Implemented ✅
- **Full Torah text** with Targum, Rashi, and 7 additional meforshim
- **Three display modes** (pasuk, parasha, aliya)
- **Responsive design** with dark mode
- **Israeli/Diaspora support** via @hebcal/core
- **Auto-detect weekly parsha** with navigation
- **Print-friendly** with font size controls
- **RTL support** with Hebrew fonts
- **Lazy-loading commentaries** for performance
- **Aliyah navigation** with scroll tracking

### To Be Added (from twoplusone) 🎯
- **Progress tracking system**: Track 2×Hebrew + 1×additional per verse
- **Study Mode**: Step-by-step navigation with completion validation
- **LocalStorage persistence**: Resume where you left off
- **Visual completion indicators**: Clear feedback on reading status
- **PWA capabilities**: Offline support via service worker

## Success Metrics

A successful solution will:
1. Allow users to complete their weekly obligation faster (less manual tracking)
2. Provide confidence they've properly fulfilled the mitzvah (2×2×1 validation)
3. Accommodate different reading styles (pasuk/paragraph/whole)
4. Work across devices without app installation
5. Support offline use for Shabbat adherence
6. Enable progress tracking throughout the week
7. Offer flexibility in Targum alternatives (Onkelos, Rashi, English)

## Next Steps

1. Implement **Study Mode** with progress tracking (from twoplusone concept)
2. Add **reading validation** to ensure 2×Hebrew + 1×additional per verse
3. Implement **PWA features** for offline capability
4. Add **daily aliyah reminders** option
5. Create **reset/resume** functionality for new parsha weeexk
6. Build **completion summary** view (which verses/aliyot completed)
7. Add **methodology selector** (pasuk-by-pasuk, paragraph, whole)
