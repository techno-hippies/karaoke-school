#!/usr/bin/env bun

/**
 * Test Line Parsing Fix
 *
 * Verifies that parseLinesFromAlignment() correctly groups words by newline markers
 * from the ElevenLabs word array, rather than incorrectly counting words from text.
 */

import { query } from './src/db/neon';
import { LyricsTranslator } from './src/services/lyrics-translator';
import type { ElevenLabsWord } from './src/services/elevenlabs';

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

console.log('🧪 Testing Line Parsing Fix...\n');

interface TrackData {
  spotify_track_id: string;
  title: string;
  normalized_lyrics: string;
  words: ElevenLabsWord[];
}

async function testLineParsing() {
  // Get a track with alignment data
  const tracks = await query<TrackData>(`
    SELECT
      sl.spotify_track_id,
      st.title,
      sl.normalized_lyrics,
      ewa.words
    FROM song_lyrics sl
    JOIN spotify_tracks st ON sl.spotify_track_id = st.spotify_track_id
    JOIN elevenlabs_word_alignments ewa ON sl.spotify_track_id = ewa.spotify_track_id
    LIMIT 1
  `);

  if (tracks.length === 0) {
    console.error('❌ No tracks with alignment found');
    process.exit(1);
  }

  const track = tracks[0];
  console.log(`📍 Testing track: ${track.title}`);
  console.log(`   Spotify ID: ${track.spotify_track_id}\n`);

  // Parse the normalized lyrics to count expected lines
  const expectedLines = track.normalized_lyrics
    .split('\n')
    .filter((line: string) => line.trim().length > 0);
  console.log(`📊 Expected lines from normalized_lyrics: ${expectedLines.length}`);

  // Count newlines in ElevenLabs word array
  const newlineCount = (track.words as ElevenLabsWord[]).filter(w => w.text === '\n').length;
  console.log(`📊 Newline markers in ElevenLabs words: ${newlineCount}\n`);

  // Parse lines using the fixed method
  const lines = LyricsTranslator.parseLinesFromAlignment(
    track.words as ElevenLabsWord[],
    track.normalized_lyrics
  );

  console.log(`✅ Parsed lines: ${lines.length}\n`);

  // Display first 3 lines to verify
  console.log('📝 First 3 parsed lines:\n');
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i];
    console.log(`Line ${i}:`);
    console.log(`  Text: "${line.originalText}"`);
    console.log(`  Timing: ${line.start.toFixed(2)}s → ${line.end.toFixed(2)}s`);
    console.log(`  Words: ${line.words.length}`);
    console.log(`  Word texts: ${line.words.map(w => w.text).join(', ')}`);
    console.log();
  }

  // Verify the fix
  let hasIssues = false;

  // Check if line count is reasonable (should match or be close to newline count)
  if (Math.abs(lines.length - newlineCount) > 2) {
    console.warn(`⚠️  Line count (${lines.length}) differs significantly from newline count (${newlineCount})`);
    hasIssues = true;
  }

  // Check if all lines have text and words
  for (const line of lines) {
    if (!line.originalText || line.originalText.trim().length === 0) {
      console.warn(`⚠️  Line ${line.lineIndex} has no text`);
      hasIssues = true;
    }
    if (line.words.length === 0) {
      console.warn(`⚠️  Line ${line.lineIndex} has no words`);
      hasIssues = true;
    }
  }

  // Check that expected lines match parsed lines (sample check)
  if (lines.length > 0 && expectedLines.length > 0) {
    const firstExpected = expectedLines[0].trim();
    const firstParsed = lines[0].originalText.trim();
    if (firstExpected === firstParsed) {
      console.log('✅ First line text matches expected!');
    } else {
      console.warn('⚠️  First line text mismatch:');
      console.warn(`   Expected: "${firstExpected}"`);
      console.warn(`   Parsed:   "${firstParsed}"`);
      hasIssues = true;
    }
  }

  if (!hasIssues) {
    console.log('\n✅ All checks passed! Line parsing is working correctly.');
  } else {
    console.log('\n⚠️  Some issues detected. Review the output above.');
  }
}

try {
  await testLineParsing();
} catch (error: any) {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
