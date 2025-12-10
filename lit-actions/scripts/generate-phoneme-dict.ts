#!/usr/bin/env bun

/**
 * Generate Phoneme Dictionary for Karaoke Line Grading
 *
 * Uses Google's top 10k English words + CMU dictionary:
 * 1. Read frequency list (google-10000-english.txt)
 * 2. Look up phonemes from CMU dict
 * 3. Output compact JS for embedding in Lit Action
 *
 * Usage:
 *   bun scripts/generate-phoneme-dict.ts
 *   bun scripts/generate-phoneme-dict.ts --dry-run
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DATA_DIR = join(ROOT_DIR, 'data');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// ============================================================================
// CMU Dictionary Parser
// ============================================================================

function parseCMUDict(filePath: string): Map<string, string[]> {
  console.log('📖 Reading CMU dictionary...');
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const dict = new Map<string, string[]>();

  for (const line of lines) {
    if (line.startsWith(';;;') || line.trim() === '') continue;

    // Remove inline comments (# ...)
    const cleanLine = line.split('#')[0].trim();
    if (!cleanLine) continue;

    const parts = cleanLine.split(/\s+/);
    if (parts.length < 2) continue;

    let word = parts[0].toLowerCase();

    // Remove alternate pronunciation markers like (2), (3)
    word = word.replace(/\(\d+\)$/, '');

    // Keep words with apostrophes (contractions), skip other special chars
    if (/[^a-z']/.test(word)) continue;

    const phonemes = parts.slice(1);

    // Only keep first pronunciation
    if (!dict.has(word)) {
      dict.set(word, phonemes);
    }
  }

  console.log(`   Loaded ${dict.size} words`);
  return dict;
}

// ============================================================================
// Frequency List Loader
// ============================================================================

function loadFrequencyList(filePath: string): Set<string> {
  console.log('📊 Reading frequency list...');
  const content = readFileSync(filePath, 'utf-8');
  const words = new Set<string>();

  for (const line of content.split('\n')) {
    const word = line.trim().toLowerCase();
    // Skip empty lines and single characters (except 'i' and 'a')
    if (!word) continue;
    if (word.length === 1 && word !== 'i' && word !== 'a') continue;
    words.add(word);
  }

  console.log(`   Loaded ${words.size} words`);
  return words;
}

// ============================================================================
// Output Generation
// ============================================================================

function generateOutput(cmuDict: Map<string, string[]>, frequencyList: Set<string>): string {
  const entries: string[] = [];
  let found = 0;
  let missing = 0;

  for (const word of frequencyList) {
    const phonemes = cmuDict.get(word);
    if (phonemes) {
      const clean = phonemes.map(p => p.replace(/[0-9]/g, ''));
      entries.push(`"${word}":[${clean.map(p => `"${p}"`).join(',')}]`);
      found++;
    } else {
      missing++;
    }
  }

  console.log(`   Found ${found} words in CMU dict, ${missing} missing`);

  // Sort alphabetically
  entries.sort();

  return `// Auto-generated phoneme dictionary
// Source: CMU Pronouncing Dictionary + Google 10k frequency list
// Generated: ${new Date().toISOString()}
// Words: ${entries.length}

export const PHONEMES={
${entries.join(',\n')}
};
`;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔧 Generate Phoneme Dictionary\n');

  const cmuPath = join(DATA_DIR, 'cmudict.txt');
  const freqPath = join(DATA_DIR, 'google-10000-english.txt');

  if (!existsSync(cmuPath)) {
    console.error(`❌ CMU dictionary not found at ${cmuPath}`);
    process.exit(1);
  }

  if (!existsSync(freqPath)) {
    console.error(`❌ Frequency list not found at ${freqPath}`);
    process.exit(1);
  }

  const cmuDict = parseCMUDict(cmuPath);
  const frequencyList = loadFrequencyList(freqPath);
  const output = generateOutput(cmuDict, frequencyList);

  console.log(`\n📊 Output size: ${(output.length / 1024).toFixed(1)} KB`);

  if (dryRun) {
    console.log('\n📄 DRY RUN - first 50 entries:\n');
    const lines = output.split('\n').slice(5, 55);
    console.log(lines.join('\n'));
  } else {
    const outputPath = join(DATA_DIR, 'phonemes.generated.js');
    writeFileSync(outputPath, output);
    console.log(`✅ Wrote to data/phonemes.generated.js`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
