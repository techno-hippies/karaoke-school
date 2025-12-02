#!/usr/bin/env bun
/**
 * Generate Video Script
 *
 * Creates karaoke video with dual-language subtitles.
 *
 * Input:
 *   - background.mp4 (from song folder)
 *   - enhanced instrumental audio
 *   - aligned lyrics from database
 *
 * Output:
 *   - {iswc}-output.mp4 with embedded subtitles
 *
 * Usage:
 *   bun src/scripts/generate-video.ts --iswc=T0704563291 --start=30000 --end=40000
 *   bun src/scripts/generate-video.ts --iswc=T0704563291 --start=30000 --end=40000 --output=./output/video.mp4
 */

import { parseArgs } from 'util';
import { $ } from 'bun';
import path from 'path';
import { getSongByISWC, getLyricsBySong, createVideo } from '../db/queries';
import { generateKaraokeAss } from '../lib/ass-generator';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv, DEFAULT_VIDEO_WIDTH, DEFAULT_VIDEO_HEIGHT } from '../config';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    output: { type: 'string' },
    'songs-dir': { type: 'string', default: './songs' },
    'background': { type: 'string' },
    'instrumental': { type: 'string' },
    width: { type: 'string', default: String(DEFAULT_VIDEO_WIDTH) },
    height: { type: 'string', default: String(DEFAULT_VIDEO_HEIGHT) },
    'skip-upload': { type: 'boolean', default: false },
    'pretrimmed': { type: 'boolean', default: false }, // Use --start/--end for lyrics only, don't seek into media files
    language: { type: 'string', default: 'zh' }, // 'zh' or 'en' - karaoke subtitle language
  },
  strict: true,
});

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL']);

  // Validate required args
  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    console.log('\nUsage:');
    console.log('  bun src/scripts/generate-video.ts --iswc=T0704563291 --start=30000 --end=40000');
    process.exit(1);
  }

  if (!values.start || !values.end) {
    console.error('❌ Missing required arguments: --start and --end (milliseconds)');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const startMs = parseInt(values.start);
  const endMs = parseInt(values.end);
  const width = parseInt(values.width!);
  const height = parseInt(values.height!);

  if (isNaN(startMs) || isNaN(endMs)) {
    console.error('❌ --start and --end must be numbers (milliseconds)');
    process.exit(1);
  }

  console.log('\n🎬 Generating Video');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Lyrics range: ${startMs}ms - ${endMs}ms (${(endMs - startMs) / 1000}s)`);
  console.log(`   Size: ${width}x${height}`);
  if (values['pretrimmed']) {
    console.log(`   Mode: PRETRIMMED (lyrics offset only, no media seeking)`);
  }

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    process.exit(1);
  }

  console.log(`   Title: ${song.title}`);

  // Find background video
  const songDir = path.join(values['songs-dir']!, iswc);
  let bgPath = values.background;
  if (!bgPath) {
    bgPath = path.join(songDir, 'background.mp4');
  }

  const bgExists = await Bun.file(bgPath).exists();
  if (!bgExists) {
    console.error(`❌ Background video not found: ${bgPath}`);
    console.log('   Place background.mp4 in the song folder or use --background');
    process.exit(1);
  }

  console.log(`   Background: ${bgPath}`);

  // Find instrumental audio
  let instrumentalPath = values.instrumental;
  if (!instrumentalPath) {
    // Try enhanced first, then regular
    const enhancedPath = path.join(songDir, 'enhanced-instrumental.mp3');
    const regularPath = path.join(songDir, 'instrumental.mp3');

    if (await Bun.file(enhancedPath).exists()) {
      instrumentalPath = enhancedPath;
    } else if (await Bun.file(regularPath).exists()) {
      instrumentalPath = regularPath;
    }
  }

  if (!instrumentalPath || !(await Bun.file(instrumentalPath).exists())) {
    console.error('❌ Instrumental audio not found.');
    console.log('   Run process-audio.ts first or use --instrumental');
    process.exit(1);
  }

  console.log(`   Instrumental: ${instrumentalPath}`);

  // Get lyrics
  console.log('\n📝 Loading lyrics...');
  const enLyrics = await getLyricsBySong(song.id, 'en');
  const zhLyrics = await getLyricsBySong(song.id, 'zh');

  console.log(`   EN lines: ${enLyrics.length}`);
  console.log(`   ZH lines: ${zhLyrics.length}`);

  // Filter lyrics to snippet range
  const snippetEnLyrics = enLyrics.filter(
    (l) => l.start_ms != null && l.start_ms >= startMs && l.start_ms < endMs
  );
  const snippetZhLyrics = zhLyrics.filter((l) =>
    snippetEnLyrics.some((en) => en.line_index === l.line_index)
  );

  console.log(`   Snippet EN lines: ${snippetEnLyrics.length}`);

  if (snippetEnLyrics.length === 0) {
    console.error('❌ No lyrics found in the specified time range.');
    console.log('   Make sure lyrics are aligned and --start/--end are correct.');
    process.exit(1);
  }

  // Adjust timing relative to snippet start
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

  // Generate ASS subtitles
  const validLanguages = ['zh', 'en', 'en-zh'];
  const karaokeLanguage = (validLanguages.includes(values.language!) ? values.language : 'zh') as 'zh' | 'en' | 'en-zh';
  const langLabel = karaokeLanguage === 'en-zh' ? 'EN + ZH' : karaokeLanguage.toUpperCase();
  console.log(`\n📄 Generating subtitles (${langLabel})...`);
  const assContent = generateKaraokeAss(adjustedEnLyrics, adjustedZhLyrics, width, height, karaokeLanguage);

  // Write ASS file
  const assPath = path.join(songDir, `${iswc}-${startMs}-${endMs}.ass`);
  await Bun.write(assPath, assContent);
  console.log(`   ASS file: ${assPath}`);

  // Generate output video with ffmpeg
  const outputPath = values.output || path.join(songDir, `${iswc}-${startMs}-${endMs}-output.mp4`);
  const durationSec = (endMs - startMs) / 1000;
  const startSec = startMs / 1000;

  console.log('\n🔧 Running ffmpeg...');
  console.log(`   Output: ${outputPath}`);

  // FFmpeg command:
  // 1. Trim background video to snippet duration (unless --pretrimmed)
  // 2. Trim instrumental audio to snippet duration (unless --pretrimmed)
  // 3. Burn in ASS subtitles
  // 4. Scale to target resolution
  const pretrimmed = values['pretrimmed'];
  const ffmpegCmd = [
    'ffmpeg', '-y',
    // Input: background video
    ...(pretrimmed ? [] : ['-ss', String(startSec)]),
    ...(pretrimmed ? [] : ['-t', String(durationSec)]),
    '-i', bgPath,
    // Input: instrumental/cover audio
    ...(pretrimmed ? [] : ['-ss', String(startSec)]),
    ...(pretrimmed ? [] : ['-t', String(durationSec)]),
    '-i', instrumentalPath,
    // Video filter: scale + subtitles
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,ass=${assPath}`,
    // Audio: copy from instrumental
    '-map', '0:v:0',
    '-map', '1:a:0',
    // Encoding
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest', // Use shortest stream duration (important for pretrimmed)
    // Output
    outputPath,
  ];

  try {
    const result = await $`${ffmpegCmd}`.quiet();
    console.log('   ✅ Video generated successfully');
  } catch (error: any) {
    console.error('❌ FFmpeg failed:', error.message);
    process.exit(1);
  }

  // Verify output
  const outputExists = await Bun.file(outputPath).exists();
  if (!outputExists) {
    console.error('❌ Output video was not created');
    process.exit(1);
  }

  const outputStat = await Bun.file(outputPath).stat();
  console.log(`   Size: ${((outputStat?.size || 0) / 1024 / 1024).toFixed(2)} MB`);

  // Save to database
  console.log('\n💾 Saving to database...');
  const video = await createVideo({
    song_id: song.id,
    snippet_start_ms: startMs,
    snippet_end_ms: endMs,
    background_video_url: bgPath,
    subtitles_ass: assContent,
    width,
    height,
  });

  console.log(`   Video ID: ${video.id}`);

  // Summary
  console.log('\n✅ Video generation complete');
  console.log(`   Output: ${outputPath}`);
  console.log(`   Duration: ${durationSec}s`);

  console.log('\n💡 Next steps:');
  console.log(`   • Post to Lens: bun src/scripts/post-clip.ts --video-id=${video.id} --account=scarlett --visual-tags="..."`);
  console.log(`   (post-clip.ts handles Grove upload automatically)`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
