#!/usr/bin/env bun
/**
 * Select Clip Boundary
 *
 * Finds the end of the first major section (Intro/Chorus) based on:
 * 1. Section markers in en-lyrics.txt ([Intro], [Chorus], [Verse 1], etc.)
 * 2. Alignment data for exact ms timestamps
 * 3. Natural break points (gaps between lines)
 *
 * Target: ~60 seconds, ending at a logical section break
 *
 * Usage:
 *   bun src/scripts/select-clip.ts --iswc=T0101545054
 *   bun src/scripts/select-clip.ts --iswc=T0101545054 --dry-run
 */

import { parseArgs } from 'util';
import { getSongByISWC, getLyricsBySong, updateSongClipEnd } from '../db/queries';
import type { Lyric, AlignmentData } from '../types';

// Section markers that indicate "end of free preview"
// Priority order: first match wins
const FREE_SECTION_ENDS = [
  '[Verse 1]',   // End after intro, before verse 1
  '[Verse]',    // End after intro/chorus
  '[Chorus]',   // End after intro, at chorus start (if no verse before)
  '[Pre-Chorus]',
  '[Bridge]',
  '[Guitar Solo]',
  '[Instrumental]',
];

// Sections that are considered "intro/hook" material for free preview
const INTRO_SECTIONS = ['[Intro]', '[Hook]', '[Chorus]'];

interface ClipBoundary {
  endMs: number;
  reason: string;
  lastLineIndex: number;
  lastLineText: string;
}

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'target-duration': { type: 'string', default: '60000' }, // 60s default
  },
  strict: true,
});

/**
 * Find the best clip boundary based on section markers and timing
 */
function findClipBoundary(
  lyrics: Lyric[],
  alignmentData: AlignmentData,
  targetDurationMs: number
): ClipBoundary {
  // Get lyrics sorted by line index
  const sortedLyrics = [...lyrics].sort((a, b) => a.line_index - b.line_index);

  // Find section markers in lyrics
  const sections: { marker: string; lineIndex: number; startMs: number }[] = [];
  for (const lyric of sortedLyrics) {
    if (lyric.section_marker) {
      sections.push({
        marker: lyric.section_marker,
        lineIndex: lyric.line_index,
        startMs: lyric.start_ms || 0,
      });
    }
  }

  console.log(`\n📋 Found ${sections.length} section markers:`);
  sections.forEach(s => console.log(`   ${s.marker} at line ${s.lineIndex} (${s.startMs}ms)`));

  // Strategy 1: Find first "end" section after intro material
  let clipEndSection: { marker: string; lineIndex: number; startMs: number } | null = null;

  for (const endMarker of FREE_SECTION_ENDS) {
    const found = sections.find(s => s.marker === endMarker);
    if (found && found.startMs > 0) {
      clipEndSection = found;
      break;
    }
  }

  if (clipEndSection) {
    // End at the start of this section (i.e., after the previous section)
    const endMs = clipEndSection.startMs;

    // Find the last line before this section
    const lastLine = sortedLyrics
      .filter(l => l.line_index < clipEndSection!.lineIndex && l.end_ms)
      .pop();

    if (lastLine && lastLine.end_ms) {
      // Use the end of the last line before the new section
      // Add a small buffer for natural fade
      const naturalEndMs = lastLine.end_ms + 500;

      return {
        endMs: naturalEndMs,
        reason: `End of section before ${clipEndSection.marker}`,
        lastLineIndex: lastLine.line_index,
        lastLineText: lastLine.text.substring(0, 50) + (lastLine.text.length > 50 ? '...' : ''),
      };
    }

    return {
      endMs,
      reason: `Start of ${clipEndSection.marker}`,
      lastLineIndex: clipEndSection.lineIndex - 1,
      lastLineText: '(section boundary)',
    };
  }

  // Strategy 2: If no clear section break, find a line ending near target duration
  console.log(`\n⚠️  No clear section break found, using duration target: ${targetDurationMs}ms`);

  const candidateLines = sortedLyrics
    .filter(l => l.end_ms && l.end_ms <= targetDurationMs + 10000) // Allow 10s overshoot
    .sort((a, b) => Math.abs((a.end_ms || 0) - targetDurationMs) - Math.abs((b.end_ms || 0) - targetDurationMs));

  if (candidateLines.length > 0) {
    const bestLine = candidateLines[0];
    return {
      endMs: (bestLine.end_ms || 0) + 500,
      reason: `Nearest line end to ${targetDurationMs}ms target`,
      lastLineIndex: bestLine.line_index,
      lastLineText: bestLine.text.substring(0, 50) + (bestLine.text.length > 50 ? '...' : ''),
    };
  }

  // Strategy 3: Fallback to target duration
  return {
    endMs: targetDurationMs,
    reason: 'Fallback to target duration (no suitable line found)',
    lastLineIndex: -1,
    lastLineText: '(no line)',
  };
}

/**
 * Find a natural gap point near the target end time
 */
function findNaturalGap(
  lyrics: Lyric[],
  targetEndMs: number,
  searchWindowMs: number = 3000
): number {
  // Look for the largest gap between lines within the search window
  const sortedLyrics = [...lyrics]
    .filter(l => l.end_ms && l.start_ms)
    .sort((a, b) => a.line_index - b.line_index);

  let bestGap = { endMs: targetEndMs, gapSize: 0 };

  for (let i = 0; i < sortedLyrics.length - 1; i++) {
    const currentEnd = sortedLyrics[i].end_ms!;
    const nextStart = sortedLyrics[i + 1].start_ms!;
    const gap = nextStart - currentEnd;

    // Check if this gap is within our search window around target
    if (
      currentEnd >= targetEndMs - searchWindowMs &&
      currentEnd <= targetEndMs + searchWindowMs &&
      gap > bestGap.gapSize
    ) {
      bestGap = { endMs: currentEnd + 200, gapSize: gap }; // Small buffer after line end
    }
  }

  if (bestGap.gapSize > 300) {
    console.log(`   Found ${bestGap.gapSize}ms gap at ${bestGap.endMs}ms`);
    return bestGap.endMs;
  }

  return targetEndMs;
}

async function main() {
  const iswc = values.iswc;
  const dryRun = values['dry-run'];
  const targetDuration = parseInt(values['target-duration'] || '60000');

  if (!iswc) {
    console.error('❌ Must specify --iswc');
    process.exit(1);
  }

  console.log('\n🎯 Select Clip Boundary');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Target: ~${targetDuration / 1000}s`);
  if (dryRun) console.log('   Mode: DRY RUN');

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error('❌ Song not found');
    process.exit(1);
  }

  console.log(`\n🎵 ${song.title}`);
  console.log(`   Duration: ${song.duration_ms ? (song.duration_ms / 1000).toFixed(1) + 's' : 'unknown'}`);

  // Check alignment data
  if (!song.alignment_data) {
    console.error('❌ No alignment data - run align-lyrics.ts first');
    process.exit(1);
  }

  // Get English lyrics with timing
  const lyrics = await getLyricsBySong(song.id, 'en');
  if (lyrics.length === 0) {
    console.error('❌ No English lyrics found');
    process.exit(1);
  }

  const lyricsWithTiming = lyrics.filter(l => l.start_ms && l.end_ms);
  console.log(`   Lyrics: ${lyrics.length} lines (${lyricsWithTiming.length} with timing)`);

  if (lyricsWithTiming.length === 0) {
    console.error('❌ No lyrics with timing - alignment may have failed');
    process.exit(1);
  }

  // Find clip boundary
  const boundary = findClipBoundary(lyrics, song.alignment_data, targetDuration);

  // Refine to natural gap
  const finalEndMs = findNaturalGap(lyrics, boundary.endMs);

  console.log(`\n✅ Clip Boundary Selected:`);
  console.log(`   End: ${finalEndMs}ms (${(finalEndMs / 1000).toFixed(1)}s)`);
  console.log(`   Reason: ${boundary.reason}`);
  console.log(`   Last line [${boundary.lastLineIndex}]: "${boundary.lastLineText}"`);

  // Calculate percentage of song
  if (song.duration_ms) {
    const pct = ((finalEndMs / song.duration_ms) * 100).toFixed(1);
    console.log(`   Coverage: ${pct}% of full song`);
  }

  if (dryRun) {
    console.log('\n✅ Dry run complete');
    process.exit(0);
  }

  // Update database
  console.log('\n💾 Updating database...');
  await updateSongClipEnd(iswc, finalEndMs);

  console.log('\n✅ Done!');
  console.log(`   clip_end_ms = ${finalEndMs}`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
