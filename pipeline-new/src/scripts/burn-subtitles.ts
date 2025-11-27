#!/usr/bin/env bun
/**
 * Burn subtitles onto existing video clip.
 *
 * Usage:
 *   bun src/scripts/burn-subtitles.ts --iswc=T0112199333 --video=clip-1.mp4 --start=93548 --end=103548
 */

import { parseArgs } from 'util';
import { $ } from 'bun';
import path from 'path';
import { getSongByISWC, getLyricsBySong } from '../db/queries';
import { generateKaraokeAss } from '../lib/ass-generator';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    video: { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    output: { type: 'string' },
    'songs-dir': { type: 'string', default: './songs' },
  },
  strict: true,
});

async function main() {
  validateEnv(['DATABASE_URL']);

  if (!values.iswc || !values.video || !values.start || !values.end) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  bun src/scripts/burn-subtitles.ts --iswc=T0112199333 --video=clip-1.mp4 --start=93548 --end=103548');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const startMs = parseInt(values.start);
  const endMs = parseInt(values.end);
  const songDir = path.join(values['songs-dir']!, iswc);
  const videoPath = path.resolve(songDir, values.video);

  console.log('\n🎬 Burning Subtitles');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Video: ${videoPath}`);
  console.log(`   Range: ${startMs}ms - ${endMs}ms`);

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
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

  console.log(`   EN lines in range: ${snippetEnLyrics.length}`);
  console.log(`   ZH lines in range: ${snippetZhLyrics.length}`);

  if (snippetEnLyrics.length === 0) {
    console.error('❌ No EN lyrics found in range. Check alignment.');
    process.exit(1);
  }

  // Adjust timing relative to clip start (video starts at 0)
  const adjustedEnLyrics = snippetEnLyrics.map((l) => ({
    ...l,
    start_ms: l.start_ms! - startMs,
    end_ms: l.end_ms! - startMs,
    word_timings: l.word_timings?.map((w) => ({
      ...w,
      start: w.start - startMs / 1000,
      end: w.end - startMs / 1000,
    })) || null,
  }));

  const adjustedZhLyrics = snippetZhLyrics.map((l) => ({
    ...l,
    start_ms: l.start_ms ? l.start_ms - startMs : null,
    end_ms: l.end_ms ? l.end_ms - startMs : null,
  }));

  // Get video dimensions
  const probeResult = await $`ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${videoPath}`.text();
  const [width, height] = probeResult.trim().split(',').map(Number);
  console.log(`   Video size: ${width}x${height}`);

  // Generate ASS
  console.log('\n📄 Generating subtitles...');
  const assContent = generateKaraokeAss(adjustedEnLyrics, adjustedZhLyrics, width, height);
  const assPath = path.join(songDir, `clip-subtitles.ass`);
  await Bun.write(assPath, assContent);
  console.log(`   ASS: ${assPath}`);

  // Burn subtitles
  const outputPath = values.output || path.join(songDir, 'clip-1-subtitled.mp4');
  console.log('\n🔧 Running ffmpeg...');

  await $`ffmpeg -y -i ${videoPath} -vf ass=${assPath} -c:v libx264 -preset medium -crf 23 -c:a copy ${outputPath}`.quiet();

  console.log('\n✅ Done');
  console.log(`   Output: ${outputPath}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
