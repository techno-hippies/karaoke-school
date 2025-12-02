#!/usr/bin/env bun
/**
 * Translate Lyrics Script
 *
 * Translates existing EN lyrics in DB to target language via Gemini.
 *
 * Usage:
 *   bun src/scripts/translate-lyrics.ts --iswc=T0702486267
 *   bun src/scripts/translate-lyrics.ts --iswc=T0702486267 --language=vi
 */

import { parseArgs } from 'util';
import { query } from '../db/connection';
import { createLyrics, getSongByISWC, type CreateLyricData } from '../db/queries';
import { translateLyrics, LANGUAGES, type LanguageCode } from '../services/openrouter';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    language: { type: 'string', default: 'zh' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

async function main() {
  validateEnv(['DATABASE_URL', 'OPENROUTER_API_KEY']);

  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    console.log('\nUsage:');
    console.log('  bun src/scripts/translate-lyrics.ts --iswc=T0702486267');
    console.log('  bun src/scripts/translate-lyrics.ts --iswc=T0702486267 --language=vi');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const targetLang = values.language as LanguageCode;

  if (!LANGUAGES[targetLang]) {
    console.error(`❌ Unsupported language: ${targetLang}`);
    console.log(`   Supported: ${Object.keys(LANGUAGES).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🌐 Translate Lyrics`);
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Target: ${LANGUAGES[targetLang].name} (${targetLang})`);

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    process.exit(1);
  }
  console.log(`   Title: ${song.title}`);

  // Check if target language already exists
  const existingCount = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM lyrics WHERE song_id = $1 AND language = $2`,
    [song.id, targetLang]
  );

  if (parseInt(existingCount[0].count) > 0) {
    console.error(`\n❌ ${targetLang.toUpperCase()} lyrics already exist (${existingCount[0].count} lines)`);
    console.log(`   Delete first: DELETE FROM lyrics WHERE song_id = '${song.id}' AND language = '${targetLang}'`);
    process.exit(1);
  }

  // Get EN lyrics
  const enLyrics = await query<{ line_index: number; text: string }>(
    `SELECT line_index, text FROM lyrics WHERE song_id = $1 AND language = 'en' ORDER BY line_index`,
    [song.id]
  );

  if (enLyrics.length === 0) {
    console.error(`\n❌ No EN lyrics found for this song`);
    process.exit(1);
  }

  console.log(`   EN lines: ${enLyrics.length}`);

  // Translate
  console.log(`\n🔄 Translating via Gemini...`);
  const enLines = enLyrics.map((l) => l.text);
  const translatedLines = await translateLyrics(enLines, targetLang, LANGUAGES[targetLang].name);

  console.log(`   ✅ Translated ${translatedLines.length} lines`);

  if (translatedLines.length !== enLines.length) {
    console.log(`   ⚠️  Line count mismatch: EN=${enLines.length}, ${targetLang.toUpperCase()}=${translatedLines.length}`);
  }

  // Preview
  console.log(`\n📋 Preview (first 5 lines):`);
  for (let i = 0; i < Math.min(5, translatedLines.length); i++) {
    console.log(`   ${i + 1}. ${enLines[i]}`);
    console.log(`      → ${translatedLines[i]}`);
  }

  if (values['dry-run']) {
    console.log('\n⏭️  Dry run - not saving to database');
    return;
  }

  // Save to DB
  console.log(`\n💾 Saving to database...`);
  const lyricsData: CreateLyricData[] = translatedLines.map((text, index) => ({
    song_id: song.id,
    line_index: index,
    language: targetLang,
    text,
  }));

  const created = await createLyrics(lyricsData);
  console.log(`   ✅ Created ${created.length} ${targetLang.toUpperCase()} lyric entries`);

  console.log('\n✅ Translation complete');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
