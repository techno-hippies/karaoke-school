#!/usr/bin/env bun
/**
 * Add Lyrics Script
 *
 * Adds additional language lyrics to an existing song.
 * Used to add ZH translations after initial EN-only add-song.ts
 *
 * Usage:
 *   bun src/scripts/add-lyrics.ts --iswc=T0112199333 --language=zh
 */

import { parseArgs } from 'util';
import path from 'path';
import { query } from '../db/connection';
import { getSongByISWC, createLyrics, type CreateLyricData } from '../db/queries';
import {
  parseLyrics,
  normalizeISWC,
  validateLyricsForCensorship,
  formatCensorshipErrors,
} from '../lib/lyrics-parser';
import { validateEnv } from '../config';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    language: { type: 'string', default: 'zh' },
    'songs-dir': { type: 'string', default: './songs' },
    force: { type: 'boolean', default: false },
  },
  strict: true,
});

async function main() {
  validateEnv(['DATABASE_URL']);

  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    console.log('\nUsage:');
    console.log('  bun src/scripts/add-lyrics.ts --iswc=T0112199333 --language=zh');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const language = values.language!;

  console.log(`\n📝 Adding ${language.toUpperCase()} Lyrics`);
  console.log(`   ISWC: ${iswc}`);

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    console.log('   Run add-song.ts first.');
    process.exit(1);
  }

  console.log(`   Title: ${song.title}`);

  // Check if lyrics already exist
  const existing = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM lyrics WHERE song_id = $1 AND language = $2`,
    [song.id, language]
  );

  if (parseInt(existing[0].count) > 0 && !values.force) {
    console.log(`\n⚠️  ${language.toUpperCase()} lyrics already exist (${existing[0].count} lines)`);
    console.log('   Use --force to replace.');
    process.exit(0);
  }

  // Read lyrics file
  const lyricsPath = path.join(values['songs-dir']!, iswc, `${language}-lyrics.txt`);
  const file = Bun.file(lyricsPath);

  if (!(await file.exists())) {
    console.error(`❌ Lyrics file not found: ${lyricsPath}`);
    process.exit(1);
  }

  const content = await file.text();
  const parsed = parseLyrics(content);

  console.log(`   Lines: ${parsed.lines.length}`);

  // Check for censored profanity (only for English lyrics - breaks karaoke grading)
  if (language === 'en') {
    const lineTexts = parsed.lines.map((l) => l.text);
    const censorshipIssues = validateLyricsForCensorship(lineTexts);
    if (censorshipIssues.length > 0) {
      console.error('\n' + formatCensorshipErrors(censorshipIssues));
      console.error('\nFix the lyrics file and try again.');
      process.exit(1);
    }
  }

  // Delete existing if force
  if (values.force && parseInt(existing[0].count) > 0) {
    await query(`DELETE FROM lyrics WHERE song_id = $1 AND language = $2`, [song.id, language]);
    console.log(`   Deleted existing ${language.toUpperCase()} lyrics`);
  }

  // Insert new lyrics
  const lyricsData: CreateLyricData[] = parsed.lines.map((line) => ({
    song_id: song.id,
    line_index: line.index,
    language: language as 'en' | 'zh' | 'vi' | 'id' | 'ja' | 'ko',
    text: line.text,
    section_marker: line.sectionMarker || undefined,
  }));

  await createLyrics(lyricsData);

  console.log(`\n✅ Added ${lyricsData.length} ${language.toUpperCase()} lyric lines`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
