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

// Thresholds for detecting intro-stretched words
const MAX_REASONABLE_WORD_DURATION_S = 3; // No single word should be >3 seconds
const TYPICAL_SHORT_WORD_DURATION_S = 0.4; // "I", "a", "the" etc typically ~0.3-0.5s
const GAP_BEFORE_WORD_S = 0.15; // Small gap before adjusted word start

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
 * Fix intro-stretched words in alignment data.
 *
 * ElevenLabs anchors the first word at 0s even when there's an instrumental intro,
 * stretching short words like "I" to 10+ seconds. This detects and corrects that.
 *
 * Strategy: For each line, if the first content word has abnormal duration,
 * use the next content word's start time as an anchor and adjust.
 */
function fixIntroStretchedWords(words: ElevenLabsWord[]): { words: ElevenLabsWord[]; fixes: number } {
  const fixed = [...words];
  let fixes = 0;
  let currentLineStart = 0;

  for (let i = 0; i < fixed.length; i++) {
    const word = fixed[i];

    // Track line boundaries
    if (word.text === '\n') {
      currentLineStart = i + 1;
      continue;
    }

    // Only check first content word of each line
    if (i !== currentLineStart) continue;

    // Skip whitespace to find first content word
    let firstContentIdx = i;
    while (firstContentIdx < fixed.length && fixed[firstContentIdx].text.trim() === '') {
      firstContentIdx++;
    }
    if (firstContentIdx >= fixed.length || fixed[firstContentIdx].text === '\n') continue;

    const firstWord = fixed[firstContentIdx];
    const duration = firstWord.end - firstWord.start;

    // Check if this word has abnormal duration
    if (duration <= MAX_REASONABLE_WORD_DURATION_S) continue;

    // Find next content word (skip whitespace)
    let nextContentIdx = firstContentIdx + 1;
    while (nextContentIdx < fixed.length &&
           fixed[nextContentIdx].text.trim() === '' &&
           fixed[nextContentIdx].text !== '\n') {
      nextContentIdx++;
    }

    // Calculate adjusted start time
    let adjustedStart: number;

    if (nextContentIdx < fixed.length && fixed[nextContentIdx].text !== '\n') {
      // Use next word's start as anchor
      const nextWord = fixed[nextContentIdx];
      // Estimate: first word should start shortly before the next word
      // Account for typical word duration + small gap
      adjustedStart = Math.max(0, nextWord.start - TYPICAL_SHORT_WORD_DURATION_S - GAP_BEFORE_WORD_S);
    } else {
      // No next word - use end time minus typical duration
      adjustedStart = Math.max(0, firstWord.end - TYPICAL_SHORT_WORD_DURATION_S);
    }

    // Only fix if the adjustment is significant (>1s change)
    if (firstWord.start < adjustedStart - 1) {
      const oldStart = firstWord.start;
      fixed[firstContentIdx] = { ...firstWord, start: adjustedStart };

      // Also adjust any leading whitespace to fill the gap properly
      for (let j = i; j < firstContentIdx; j++) {
        if (fixed[j].text.trim() === '') {
          const wsWord = fixed[j];
          // Compress whitespace to just before the first word
          const wsStart = Math.max(0, adjustedStart - 0.05 * (firstContentIdx - j));
          const wsEnd = j === firstContentIdx - 1 ? adjustedStart : wsStart + 0.01;
          fixed[j] = { ...wsWord, start: wsStart, end: wsEnd };
        }
      }

      console.log(`   🔧 Fixed intro stretch: "${firstWord.text}" ${oldStart.toFixed(2)}s → ${adjustedStart.toFixed(2)}s (was ${duration.toFixed(1)}s long)`);
      fixes++;
    }
  }

  return { words: fixed, fixes };
}

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

  // Fix intro-stretched words (ElevenLabs anchors at 0 even with instrumental intros)
  console.log('\n🔍 Checking for intro-stretched words...');
  const { words: fixedWords, fixes: introFixes } = fixIntroStretchedWords(alignment.words);
  if (introFixes === 0) {
    console.log('   No fixes needed');
  } else {
    console.log(`   Applied ${introFixes} fix(es)`);
  }

  // Map timings to lines
  console.log('\n📝 Mapping timings to lines...');
  const lineTimings = mapTimingsToLines(fixedWords, enLyrics);

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

  // Update song alignment data (use fixed words)
  await updateSongAlignment(iswc, {
    alignment_data: {
      words: fixedWords,
      characters: alignment.characters,
    },
    alignment_version: 'elevenlabs-forced-v2', // v2 = with intro-stretch fix
    alignment_loss: alignment.overallLoss,
  });

  console.log('\n✅ Alignment saved');
  console.log(`   Version: elevenlabs-forced-v2`);
  console.log(`   Loss: ${alignment.overallLoss.toFixed(4)}`);
  console.log(`   Duration: ${(alignment.alignmentDurationMs / 1000).toFixed(1)}s`);

  console.log('\n💡 Next steps:');
  console.log(`   • Generate video: bun src/scripts/generate-video.ts --iswc=${iswc}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
