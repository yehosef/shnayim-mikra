# Current Data Structure Analysis

## Data Source
All text files are from **Sefaria.org** API

## File Structure

### Location
`/server/assets/` contains subdirectories:
- `torah/` - Hebrew Torah text
- `targum/` - Targum Onkelos (Aramaic translation)
- `rashi/` - Rashi commentary
- `meforshim/` - Additional commentaries (7 meforshim)
- `meforshim-index/` - Index of which meforshim exist per verse

### File Format

Each chumash (book) has separate JSON files:
- `bereishit.json`
- `shmot.json`
- `vayikra.json`
- `bamidbar.json`
- `dvarim.json`

## Data Structure

### Torah Text (`torah/bereishit.json`)
```json
{
  "title": "Genesis",
  "language": "he",
  "versionTitle": "merged",
  "versionSource": "https://www.sefaria.org/Genesis",
  "text": [
    [  // Perek 1 (0-indexed)
      "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים...",  // Pasuk 1 (0-indexed)
      "וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙...",     // Pasuk 2
      // ...
    ],
    [  // Perek 2
      // ...
    ]
  ]
}
```

**Key Points:**
- `text` is a 2D array: `text[perek][pasuk]`
- Both perek and pasuk are 0-indexed
- Each string is a complete verse with cantillation marks and paragraph markers (פ/ס)

### Targum Onkelos (`targum/bereishit.json`)
```json
{
  "title": "Onkelos Genesis",
  "language": "he",  // Still Hebrew characters, but Aramaic language
  "versionTitle": "merged",
  "versionSource": "https://www.sefaria.org/Onkelos_Genesis",
  "text": [
    [
      "בְּקַדְמִין בְּרָא יְיָ יָת שְׁמַיָּא...",  // Aramaic translation
      "וְאַרְעָא הֲוַת צָדְיָא וְרֵיקַנְיָא...",
      // ...
    ],
    // ...
  ]
}
```

**Key Points:**
- Same structure as Torah
- Contains HTML tags (`<b>...</b>`) for emphasis
- Aramaic text, not Hebrew

### Rashi (`rashi/bereishit.json`)
```json
{
  "title": "Rashi on Genesis",
  "language": "he",
  "versionTitle": "Rashi Chumash, Metsudah Publications, 2009",
  "text": [
    [  // Perek 1
      [  // Pasuk 1 - ARRAY of commentary pieces
        "<b>בראשית.</b> אמר רבי יצחק, לא היה צריך...",
        "<b>בראשית ברא.</b> אין המקרא הזה אומר...",
        "<b>ברא אלהים.</b> ולא אמר ברא ה'..."
      ],
      [  // Pasuk 2 - Multiple commentary pieces
        "...",
        "..."
      ],
      // Note: Some verses have NO Rashi (empty array or missing)
    ]
  ]
}
```

**Key Points:**
- **3D array**: `text[perek][pasuk][commentary_index]`
- Each pasuk can have **multiple** Rashi comments (array of strings)
- NOT every verse has Rashi (some are empty arrays `[]` or missing)
- Contains HTML tags for formatting

## English Translation - NOT FOUND

**Status:** English translation **does NOT exist** in current shnayim-mikra project

**Found in:**
- `twoplusone/public/data/parshas.json` - Mock data only (3 sample verses)

**Options to add English:**
1. **Sefaria API** - Fetch from https://www.sefaria.org/api/texts/Genesis.1.1?lang=en
2. **Pre-downloaded files** - Download from Sefaria and save locally (like existing Torah/Targum/Rashi)
3. **Manual files** - Use public domain translations (JPS 1917, etc.)

## Current API Usage

### Server API: `/api/data/[parasha]`
File: `server/api/data/[parasha].ts`

**Loads 4 sources:**
1. Torah text - Always loaded
2. Targum Onkelos - Always loaded
3. Rashi - Loaded if `showRashi=true`
4. Meforshim-index - Loaded if `showRashi=true`

**Returns:**
```typescript
type Psuk = {
  torah: string,
  targum: string,
  rashi?: string[],      // Array of commentary pieces
  meforshim?: string[],  // List of available meforshim
  perek?: string,        // Hebrew numeral
  pasuk: string,         // Hebrew numeral
  aliya?: string | null  // e.g., "שני", "שלישי"
}
```

**Processing:**
- Converts 0-indexed arrays to verse-by-verse structure
- Adds Hebrew numerals (using `toHebrew()` function)
- Adds aliyah markers based on `parshiyot.ts` configuration
- Flattens 2D Torah/Targum arrays into 1D verse list
- Flattens 3D Rashi array into verse-level arrays

## What We Need to Add for English

### Option 1: Download from Sefaria (RECOMMENDED)

**API Endpoints:**
- Single verse: `https://www.sefaria.org/api/texts/Genesis.1.1?lang=en`
- Whole book: `https://www.sefaria.org/api/texts/Genesis?lang=en`

**Example Response:**
```json
{
  "text": [
    "When God began to create heaven and earth—",
    "the earth being unformed and void, with darkness over the surface of the deep...",
    // ...
  ],
  "language": "en",
  "versionTitle": "The Contemporary Torah, Jewish Publication Society, 2006"
}
```

**Implementation:**
1. Download English text for all 5 books
2. Save to `server/assets/english/bereishit.json` (same structure as Torah)
3. Update API to optionally load English
4. Add to verse data structure

### Option 2: Public Domain Translation

Use JPS 1917 (public domain):
- Download from https://www.sefaria.org/ (specify version)
- Same process as Option 1

### Data Structure After Adding English

```json
// server/assets/english/bereishit.json
{
  "title": "Genesis",
  "language": "en",
  "versionTitle": "The Contemporary Torah, JPS, 2006",
  "text": [
    [  // Perek 1
      "When God began to create heaven and earth—",
      "the earth being unformed and void...",
      // ...
    ],
    // ...
  ]
}
```

## Summary of Data Formats

| Source | Structure | Example |
|--------|-----------|---------|
| **Torah** | `text[perek][pasuk]` → `string` | `"בְּרֵאשִׁ֖ית..."` |
| **Targum** | `text[perek][pasuk]` → `string` (with HTML) | `"בְּקַדְמִין...<b>פָּרַשׂ</b>"` |
| **Rashi** | `text[perek][pasuk]` → `string[]` | `["<b>בראשית.</b> אמר...", "..."]` |
| **English** | `text[perek][pasuk]` → `string` (NEEDS TO BE ADDED) | `"In the beginning..."` |

## API Data Flow

```
User requests: /api/data/bereshit?showRashi=true

Server loads:
1. torah/bereishit.json → text[0][0] = "בְּרֵאשִׁ֖ית..."
2. targum/bereishit.json → text[0][0] = "בְּקַדְמִין..."
3. rashi/bereishit.json → text[0][0][0] = "<b>בראשית.</b>..."
4. meforshim-index/bereishit.json → text[0][0] = ["ramban", ...]

Server transforms to:
{
  torah: "בְּרֵאשִׁ֖ית...",
  targum: "בְּקַדְמִין...",
  rashi: ["<b>בראשית.</b>...", "..."],
  meforshim: ["ramban", ...],
  pasuk: "א",
  perek: "א"
}

Frontend receives flat array of verses
```

## Next Steps to Add English

1. **Download English text from Sefaria** for all 5 books
2. **Save to** `server/assets/english/{chumash}.json`
3. **Update API** (`server/api/data/[parasha].ts`):
   - Add English to promises array
   - Include in verse object as `english?: string`
4. **Update Settings** to include `showEnglish: boolean`
5. **Update Frontend** to display English
6. **Update Progress Tracking** to allow tracking English as "targum" option
