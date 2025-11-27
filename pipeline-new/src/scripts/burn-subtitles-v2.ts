#!/usr/bin/env bun
/**
 * Burn subtitles onto video with audio replacement.
 * Uses character-by-character color highlighting like the working Eminem version.
 */

import { parseArgs } from 'util';
import { $ } from 'bun';
import path from 'path';
import { getSongByISWC, getLyricsBySong } from '../db/queries';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';
import type { Lyric } from '../types';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    video: { type: 'string' },
    audio: { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    output: { type: 'string' },
    'songs-dir': { type: 'string', default: './songs' },
  },
  strict: true,
});

interface CharTiming {
  char: string;
  start: number; // seconds
  end: number;
}

/**
 * Generate character timings from word timings
 */
function getCharTimings(zhText: string, wordTimings: any[]): CharTiming[] {
  if (!wordTimings || wordTimings.length === 0) {
    return [];
  }

  const chars: CharTiming[] = [];

  // Filter to actual content words (not newlines/spaces)
  const contentWords = wordTimings.filter((w: any) => w.text && w.text.trim().length > 0);

  for (const word of contentWords) {
    const wordChars = word.text.split('');
    const wordDuration = word.end - word.start;
    const charDuration = wordDuration / wordChars.length;

    for (let i = 0; i < wordChars.length; i++) {
      chars.push({
        char: wordChars[i],
        start: word.start + (i * charDuration),
        end: word.start + ((i + 1) * charDuration),
      });
    }
  }

  return chars;
}

/**
 * Format time to ASS format (H:MM:SS.cc)
 */
function toAss(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/**
 * Generate ASS with character-by-character highlighting
 */
function generateCharHighlightAss(
  enLyrics: Lyric[],
  zhLyrics: Lyric[],
  width: number,
  height: number,
  offsetMs: number
): string {
  const lines: string[] = [];

  // Script Info
  lines.push('[Script Info]');
  lines.push('Title: Karaoke - Character Highlight');
  lines.push('ScriptType: v4.00+');
  lines.push(`PlayResX: ${width}`);
  lines.push(`PlayResY: ${height}`);
  lines.push('WrapStyle: 0');
  lines.push('ScaledBorderAndShadow: yes');
  lines.push('');

  // Styles - both at bottom, ZH higher than EN
  lines.push('[V4+ Styles]');
  lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  lines.push('Style: Chinese,Noto Sans SC,70,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,20,20,220,1');
  lines.push('Style: English,Arial,42,&H00CCCCCC,&H00CCCCCC,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,20,20,120,1');
  lines.push('');

  // Events
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  // Create ZH index map
  const zhByIndex = new Map<number, Lyric>();
  for (const zh of zhLyrics) {
    zhByIndex.set(zh.line_index, zh);
  }

  // Process each EN line with its paired ZH
  for (const en of enLyrics) {
    if (en.start_ms == null || en.end_ms == null) continue;

    const zh = zhByIndex.get(en.line_index);
    if (!zh || !zh.text) continue;

    // Adjust timing relative to clip start
    const lineStartSec = (en.start_ms - offsetMs) / 1000;
    const lineEndSec = (en.end_ms - offsetMs) / 1000;

    // Get character timings from ZH word_timings
    const charTimings = getCharTimings(zh.text, zh.word_timings || []);

    if (charTimings.length > 0) {
      // Generate one dialogue per character highlight step
      let builtText = '';
      for (let i = 0; i < charTimings.length; i++) {
        const ct = charTimings[i];
        const startSec = ct.start; // Already relative from alignment
        const endSec = ct.end;

        // Build text with current char highlighted
        let text = '';
        for (let j = 0; j < charTimings.length; j++) {
          if (j === i) {
            text += `{\\c&H00FFFF&}${charTimings[j].char}{\\c&HFFFFFF&}`;
          } else {
            text += charTimings[j].char;
          }
        }

        lines.push(`Dialogue: 0,${toAss(startSec)},${toAss(endSec)},Chinese,,0,0,0,,${text}`);
      }
    } else {
      // No char timings, show static
      lines.push(`Dialogue: 0,${toAss(lineStartSec)},${toAss(lineEndSec)},Chinese,,0,0,0,,${zh.text}`);
    }

    // English line spans the whole duration
    lines.push(`Dialogue: 0,${toAss(lineStartSec)},${toAss(lineEndSec)},English,,0,0,0,,${en.text}`);
  }

  return lines.join('\n');
}

async function main() {
  validateEnv(['DATABASE_URL']);

  if (!values.iswc || !values.video || !values.audio || !values.start || !values.end) {
    console.error('Usage:');
    console.log('  bun src/scripts/burn-subtitles-v2.ts --iswc=T0112199333 --video=clip-1.mp4 --audio=1.33.548-1.43.548.mp3 --start=93548 --end=103548');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const startMs = parseInt(values.start);
  const endMs = parseInt(values.end);
  const songDir = path.join(values['songs-dir']!, iswc);
  const videoPath = path.resolve(songDir, values.video);
  const audioPath = path.resolve(songDir, values.audio);

  console.log('\n🎬 Burning Subtitles v2');
  console.log(`   Video: ${videoPath}`);
  console.log(`   Audio: ${audioPath}`);

  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`Song not found: ${iswc}`);
    process.exit(1);
  }

  // Get lyrics in range
  const enLyrics = await getLyricsBySong(song.id, 'en');
  const zhLyrics = await getLyricsBySong(song.id, 'zh');

  const snippetEnLyrics = enLyrics.filter(
    (l) => l.start_ms != null && l.start_ms >= startMs && l.start_ms < endMs
  );
  const snippetZhLyrics = zhLyrics.filter((l) =>
    snippetEnLyrics.some((en) => en.line_index === l.line_index)
  );

  console.log(`   EN lines: ${snippetEnLyrics.length}`);
  console.log(`   ZH lines: ${snippetZhLyrics.length}`);

  // Get video dimensions
  const probeResult = await $`ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${videoPath}`.text();
  const [width, height] = probeResult.trim().split(',').map(Number);
  console.log(`   Size: ${width}x${height}`);

  // Generate ASS
  const assContent = generateCharHighlightAss(snippetEnLyrics, snippetZhLyrics, width, height, startMs);
  const assPath = path.join(songDir, 'clip-v2.ass');
  await Bun.write(assPath, assContent);
  console.log(`   ASS: ${assPath}`);

  // Burn subtitles + replace audio
  const outputPath = values.output || path.join(songDir, 'clip-final.mp4');
  console.log('\n🔧 Running ffmpeg...');

  await $`ffmpeg -y -i ${videoPath} -i ${audioPath} -vf ass=${assPath} -map 0:v:0 -map 1:a:0 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k -shortest ${outputPath}`.quiet();

  console.log('\n✅ Done');
  console.log(`   Output: ${outputPath}`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
