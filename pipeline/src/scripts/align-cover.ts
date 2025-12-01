#!/usr/bin/env bun
/**
 * Align Cover Audio with Chinese Lyrics
 *
 * Uses ElevenLabs Forced Alignment to get character-level timing
 * for Chinese cover versions of songs.
 *
 * Usage:
 *   bun src/scripts/align-cover.ts --iswc=T0721262607
 *   bun src/scripts/align-cover.ts --iswc=T0721262607 --start=35700 --end=45700
 *
 * Expected files in songs/{ISWC}/:
 *   - cover.mp3     (Chinese cover audio)
 *   - zh-lyrics.txt (Chinese cover lyrics - NOT translations)
 *
 * Outputs:
 *   - cover-alignment.json (full alignment)
 *   - alignment.json (trimmed to --start/--end if provided, offset to 0)
 */

import { parseArgs } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { forcedAlignment } from '../services/elevenlabs';
import { uploadAudioToGrove } from '../services/grove';
import { normalizeISWC, parseLyrics } from '../lib/lyrics-parser';
import { validateEnv } from '../config';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'songs-dir': { type: 'string', default: './songs' },
    start: { type: 'string' },
    end: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
  strict: true,
});

async function main() {
  validateEnv(['ELEVENLABS_API_KEY']);

  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    console.log('\nUsage:');
    console.log('  bun src/scripts/align-cover.ts --iswc=T0721262607');
    console.log('  bun src/scripts/align-cover.ts --iswc=T0721262607 --start=35700 --end=45700');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const songDir = path.join(values['songs-dir']!, iswc);
  const coverPath = path.join(songDir, 'cover.mp3');
  const zhLyricsPath = path.join(songDir, 'zh-lyrics.txt');
  const fullAlignmentPath = path.join(songDir, 'cover-alignment.json');
  const trimmedAlignmentPath = path.join(songDir, 'alignment.json');

  console.log('\n🎤 Aligning Cover Audio');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Directory: ${songDir}`);

  // Check required files
  if (!fs.existsSync(coverPath)) {
    console.error(`❌ Cover audio not found: ${coverPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(zhLyricsPath)) {
    console.error(`❌ Chinese lyrics not found: ${zhLyricsPath}`);
    process.exit(1);
  }

  // Check if already aligned
  if (fs.existsSync(fullAlignmentPath) && !values.force) {
    console.log('\n⚠️  Cover already aligned. Use --force to re-align.');

    // Still need to trim if start/end provided
    if (values.start && values.end) {
      console.log('   Trimming existing alignment...');
      const fullAlignment = JSON.parse(fs.readFileSync(fullAlignmentPath, 'utf-8'));
      trimAlignment(fullAlignment, parseInt(values.start), parseInt(values.end), trimmedAlignmentPath);
    }
    process.exit(0);
  }

  // Parse Chinese lyrics
  const { lines: zhLines } = parseLyrics(fs.readFileSync(zhLyricsPath, 'utf-8'));
  console.log(`   ZH Lines: ${zhLines.length}`);

  // Upload cover to Grove for ElevenLabs
  console.log('\n☁️  Uploading cover to Grove...');
  const coverBuffer = Buffer.from(await Bun.file(coverPath).arrayBuffer());
  const uploadResult = await uploadAudioToGrove(coverBuffer, `${iswc}-cover.mp3`);
  console.log(`   URL: ${uploadResult.url}`);

  // Prepare text for alignment
  const fullText = zhLines.map(l => l.text).join('\n');

  // Run alignment
  console.log('\n⏳ Running ElevenLabs forced alignment...');
  const alignment = await forcedAlignment(uploadResult.url, fullText);

  console.log(`   Words: ${alignment.totalWords}`);
  console.log(`   Characters: ${alignment.characters.length}`);
  console.log(`   Duration: ${(alignment.alignmentDurationMs / 1000).toFixed(1)}s`);
  console.log(`   Loss: ${alignment.overallLoss.toFixed(4)}`);

  // Save full alignment
  const fullAlignmentData = {
    iswc,
    language: 'zh',
    type: 'cover',
    words: alignment.words,
    characters: alignment.characters,
    overallLoss: alignment.overallLoss,
    alignmentDurationMs: alignment.alignmentDurationMs,
  };
  fs.writeFileSync(fullAlignmentPath, JSON.stringify(fullAlignmentData, null, 2));
  console.log(`\n✅ Full alignment saved: ${fullAlignmentPath}`);

  // Trim if start/end provided
  if (values.start && values.end) {
    trimAlignment(fullAlignmentData, parseInt(values.start), parseInt(values.end), trimmedAlignmentPath);
  } else {
    // Copy full alignment as the working alignment
    fs.writeFileSync(trimmedAlignmentPath, JSON.stringify(fullAlignmentData, null, 2));
    console.log(`   Copied to: ${trimmedAlignmentPath}`);
  }

  console.log('\n💡 Next steps:');
  console.log(`   • Generate video: bun src/scripts/generate-karaoke-video.ts --song-dir=${songDir}`);
}

interface CharTiming {
  text: string;
  start: number;
  end: number;
  preSung?: boolean; // Character was sung before video starts (clamped from negative timing)
}

function trimAlignment(
  fullAlignment: { characters: CharTiming[] },
  startMs: number,
  endMs: number,
  outputPath: string
) {
  const startSec = startMs / 1000;
  const endSec = endMs / 1000;

  console.log(`\n✂️  Trimming alignment: ${startMs}ms - ${endMs}ms`);

  // First, split characters into lines by \n
  const lines: CharTiming[][] = [];
  let currentLine: CharTiming[] = [];

  for (const char of fullAlignment.characters) {
    if (char.text === '\n') {
      if (currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
      }
    } else {
      currentLine.push(char);
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  console.log(`   Total lines in alignment: ${lines.length}`);

  // Find lines that overlap with our time range (include complete lines only)
  const selectedLines: CharTiming[][] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    const lineStart = line[0].start;
    const lineEnd = line[line.length - 1].end;

    // Include line if it overlaps with our range
    if (lineEnd >= startSec && lineStart <= endSec) {
      selectedLines.push(line);
    }
  }

  console.log(`   Lines overlapping range: ${selectedLines.length}`);

  // Flatten selected lines back to characters, with \n between lines
  // Clamp negative times to 0 (for characters that start before our trim window)
  // Mark pre-sung characters so they can be shown as already highlighted
  const trimmedChars: CharTiming[] = [];
  for (let i = 0; i < selectedLines.length; i++) {
    const line = selectedLines[i];
    for (const char of line) {
      const originalStart = char.start - startSec;
      const originalEnd = char.end - startSec;
      const start = Math.max(0, originalStart);
      const end = Math.max(0, originalEnd);
      // Mark as pre-sung if the character ended before or at video start
      const preSung = originalEnd <= 0;
      trimmedChars.push({
        text: char.text,
        start,
        end,
        ...(preSung && { preSung: true }),
      });
    }
    // Add newline between lines (but not after the last line)
    if (i < selectedLines.length - 1) {
      const lastChar = line[line.length - 1];
      const nlTime = Math.max(0, lastChar.end - startSec);
      trimmedChars.push({
        text: '\n',
        start: nlTime,
        end: nlTime,
      });
    }
  }

  console.log(`   Characters in range: ${trimmedChars.length}`);

  const trimmedData = {
    characters: trimmedChars,
    startMs,
    endMs,
    durationMs: endMs - startMs,
  };

  fs.writeFileSync(outputPath, JSON.stringify(trimmedData, null, 2));
  console.log(`   Saved: ${outputPath}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
