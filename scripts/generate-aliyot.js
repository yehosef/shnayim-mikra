#!/usr/bin/env node

/**
 * Generate aliyot (Torah reading portions) data
 * Processes existing parshiyot.js data and enhances it with verse range information
 * Output: /server/assets/aliyot.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import existing parshiyot data
import parshiyot from '../src/data/parshiyot.js';

// Torah book structures: number of chapters and verses
const torahStructure = {
  bereishit: {
    chapters: [
      31, 25, 24, 26, 32, 22, 29, 34, 30, 23, 29, 50, 31, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 28, 37, 37, 6, 24, 33, 31, 36, 22, 30, 33
    ]
  },
  shmot: {
    chapters: [
      22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27, 25, 26, 36, 31, 33, 18, 40, 37, 21, 43, 20, 28, 39, 20, 58, 36, 39, 40
    ]
  },
  vayikra: {
    chapters: [
      17, 16, 17, 35, 19, 30, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37, 27, 24, 33, 44, 23, 55, 46, 34
    ]
  },
  bamidbar: {
    chapters: [
      54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 60, 30, 52, 29, 12, 13, 58, 30, 55, 24, 28, 11, 45, 25, 35, 37, 38, 42, 26, 22, 40, 23
    ]
  },
  dvarim: {
    chapters: [
      46, 37, 29, 30, 33, 34, 24, 46, 37, 42, 29, 40, 52, 39, 56, 27, 34, 44, 37, 45, 50, 42, 41, 3, 43, 33, 23, 26, 40, 40, 34, 52, 34
    ]
  }
};

/**
 * Calculate verse count between two positions
 * Both [perek, pasuk] are 0-indexed
 */
function calculateVerseCount(start, end, chumashKey) {
  const [startPerek, startPasuk] = start;
  const [endPerek, endPasuk] = end;

  if (startPerek === endPerek) {
    return endPasuk - startPasuk + 1;
  }

  let count = 0;

  // Add remaining verses in start chapter
  const chapters = torahStructure[chumashKey]?.chapters || [];
  if (chapters[startPerek]) {
    count += chapters[startPerek] - startPasuk;
  }

  // Add all verses in middle chapters
  for (let i = startPerek + 1; i < endPerek; i++) {
    if (chapters[i]) {
      count += chapters[i];
    }
  }

  // Add verses in end chapter
  count += endPasuk + 1;

  return count;
}

/**
 * Generate aliyot data for all parshiyot
 */
function generateAliyot() {
  console.log('Generating aliyot data from parshiyot definitions...\n');

  const aliyotData = {};
  let successCount = 0;
  let failCount = 0;

  // Map each parsha to its aliyot
  for (const [parshaKey, parshaDef] of Object.entries(parshiyot)) {
    try {
      const aliyot = [];
      const chumashKey = parshaDef.chumash;

      if (!parshaDef.aliyot || parshaDef.aliyot.length === 0) {
        console.log(`⚠ ${parshaKey}: No aliyot defined`);
        failCount++;
        continue;
      }

      // Process each aliyah
      for (let i = 0; i < parshaDef.aliyot.length; i++) {
        const aliyahStart = parshaDef.aliyot[i];

        // Determine aliyah end: either the next aliyah start or the parsha end
        let aliyahEnd;
        if (i < parshaDef.aliyot.length - 1) {
          // Next aliyah starts at the next aliyah's first verse
          // Go back one verse from that
          const nextStart = parshaDef.aliyot[i + 1];
          const [nextPerek, nextPasuk] = nextStart;

          if (nextPasuk === 0) {
            // Previous chapter, last verse
            if (nextPerek > 0) {
              const prevChapter = nextPerek - 1;
              const chapters = torahStructure[chumashKey]?.chapters || [];
              aliyahEnd = [prevChapter, (chapters[prevChapter] || 0) - 1];
            } else {
              aliyahEnd = nextStart;
            }
          } else {
            // Same chapter, previous verse
            aliyahEnd = [nextPerek, nextPasuk - 1];
          }
        } else {
          // Last aliyah goes to parsha end
          aliyahEnd = parshaDef.end;
        }

        const verseCount = calculateVerseCount(aliyahStart, aliyahEnd, chumashKey);

        aliyot.push({
          aliya: i + 1,
          start: aliyahStart,
          end: aliyahEnd,
          verseCount: Math.max(1, verseCount)
        });
      }

      if (aliyot.length > 0) {
        aliyotData[parshaKey] = aliyot;
        successCount++;
        console.log(`✓ ${parshaKey}: ${aliyot.length} aliyot`);
      } else {
        failCount++;
      }
    } catch (err) {
      console.error(`✗ ${parshaKey}: ${err.message}`);
      failCount++;
    }
  }

  // Write output file
  const outputDir = path.join(__dirname, '..', 'server', 'assets');
  const outputFile = path.join(outputDir, 'aliyot.json');

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(aliyotData, null, 2));

  console.log(`\n✓ Generated aliyot data`);
  console.log(`  Success: ${successCount}/${Object.keys(parshiyot).length}`);
  console.log(`  Failed: ${failCount}/${Object.keys(parshiyot).length}`);
  console.log(`  Output: ${outputFile}`);

  return aliyotData;
}

// Run the generator
try {
  const result = generateAliyot();
  process.exit(0);
} catch (err) {
  console.error('Fatal error:', err);
  process.exit(1);
}
