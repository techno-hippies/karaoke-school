#!/usr/bin/env bun
/**
 * Align Lyrics Script
 *
 * Uses ElevenLabs Forced Alignment API for word-level karaoke timing.
 *
 * Prerequisites:
 *   - Song must exist in database
 *   - Vocals URL must be available (from demucs separation via process-audio.ts)
 *
 * Usage:
 *   bun src/scripts/align-lyrics.ts --iswc=T0718898588
 *   bun src/scripts/align-lyrics.ts --iswc=T0718898588 --force
 */

import { parseArgs } from 'util';
import { query } from '../db/connection';
import { getSongByISWC, getLyricsBySong, updateSongAlignment } from '../db/queries';
import { forcedAlignment, type ElevenLabsWord } from '../services/elevenlabs';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';
import type { Lyric } from '../types';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
  strict: true,
});

/**
 * Parse lines from ElevenLabs alignment using \n tokens as line delimiters.
 * This matches the old pipeline's parseLinesFromAlignment approach.
 */
interface ParsedLine {
  words: ElevenLabsWord[];
  start_ms: number;
  end_ms: number;
}

function parseLinesFromAlignment(words: ElevenLabsWord[]): ParsedLine[] {
  const lines: ParsedLine[] = [];
  let currentLineWords: ElevenLabsWord[] = [];

  for (const word of words) {
    // \n token marks end of line
    if (word.text === '\n') {
      if (currentLineWords.length > 0) {
        // Filter out whitespace-only words for timing calculation
        const contentWords = currentLineWords.filter((w) => w.text.trim().length > 0);
        if (contentWords.length > 0) {
          lines.push({
            words: currentLineWords,
            start_ms: Math.round(contentWords[0].start * 1000),
            end_ms: Math.round(contentWords[contentWords.length - 1].end * 1000),
          });
        }
        currentLineWords = [];
      }
      continue;
    }
    currentLineWords.push(word);
  }

  // Flush any remaining words as the final line
  if (currentLineWords.length > 0) {
    const contentWords = currentLineWords.filter((w) => w.text.trim().length > 0);
    if (contentWords.length > 0) {
      lines.push({
        words: currentLineWords,
        start_ms: Math.round(contentWords[0].start * 1000),
        end_ms: Math.round(contentWords[contentWords.length - 1].end * 1000),
      });
    }
  }

  return lines;
}

/**
 * Map word timings to lyric lines using \n tokens from ElevenLabs alignment.
 */
function mapTimingsToLines(
  words: ElevenLabsWord[],
  lines: Lyric[]
): Map<string, { timings: ElevenLabsWord[]; start_ms: number; end_ms: number }> {
  const result = new Map<string, { timings: ElevenLabsWord[]; start_ms: number; end_ms: number }>();

  // Parse lines from alignment data using \n tokens
  const parsedLines = parseLinesFromAlignment(words);

  console.log(`   Parsed ${parsedLines.length} lines from alignment (expecting ${lines.length} lyrics)`);

  // Match parsed lines to lyrics by index
  for (let i = 0; i < lines.length && i < parsedLines.length; i++) {
    const lyric = lines[i];
    const parsed = parsedLines[i];

    result.set(lyric.id, {
      timings: parsed.words,
      start_ms: parsed.start_ms,
      end_ms: parsed.end_ms,
    });
  }

  return result;
}

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL', 'ELEVENLABS_API_KEY']);

  // Validate required args
  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    console.log('\nUsage:');
    console.log('  bun src/scripts/align-lyrics.ts --iswc=T0718898588');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  console.log('\n🎤 Aligning Lyrics');
  console.log(`   ISWC: ${iswc}`);

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    process.exit(1);
  }

  console.log(`   Title: ${song.title}`);
  console.log(`   Stage: ${song.stage}`);

  // Check if already aligned
  if (song.alignment_data && !values.force) {
    console.log('\n⚠️  Song already has alignment data.');
    console.log('   Use --force to re-align.');
    process.exit(0);
  }

  // Get vocals URL from database (set by process-audio.ts)
  if (!song.vocals_url) {
    console.error('❌ Vocals URL not found.');
    console.log('   Run process-audio.ts first to separate vocals.');
    process.exit(1);
  }

  console.log(`   Vocals: ${song.vocals_url}`);

  // Get English lyrics (primary for alignment)
  const enLyrics = await getLyricsBySong(song.id, 'en');
  if (enLyrics.length === 0) {
    console.error('❌ No English lyrics found for this song.');
    process.exit(1);
  }

  console.log(`   EN Lines: ${enLyrics.length}`);

  // Prepare text for alignment (exclude section markers if any)
  const fullText = enLyrics.map((l) => l.text).join('\n');

  // Run alignment
  console.log('\n⏳ Running ElevenLabs forced alignment...');
  const alignment = await forcedAlignment(song.vocals_url, fullText);

  console.log(`   Words: ${alignment.totalWords}`);

  // Map timings to lines
  console.log('\n📝 Mapping timings to lines...');
  const lineTimings = mapTimingsToLines(alignment.words, enLyrics);

  // Update lyrics with timing
  let updatedCount = 0;
  for (const [lyricId, timing] of lineTimings) {
    await query(
      `UPDATE lyrics SET
        start_ms = $2,
        end_ms = $3,
        word_timings = $4
      WHERE id = $1`,
      [lyricId, timing.start_ms, timing.end_ms, JSON.stringify(timing.timings)]
    );
    updatedCount++;
  }

  console.log(`   Updated ${updatedCount} lyric lines`);

  // Update song alignment data
  await updateSongAlignment(iswc, {
    alignment_data: {
      words: alignment.words,
      characters: alignment.characters,
    },
    alignment_version: 'elevenlabs-forced-v1',
    alignment_loss: alignment.overallLoss,
  });

  console.log('\n✅ Alignment saved');
  console.log(`   Version: elevenlabs-forced-v1`);
  console.log(`   Loss: ${alignment.overallLoss.toFixed(4)}`);
  console.log(`   Duration: ${(alignment.alignmentDurationMs / 1000).toFixed(1)}s`);

  console.log('\n💡 Next steps:');
  console.log(`   • Generate video: bun src/scripts/generate-video.ts --iswc=${iswc}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
