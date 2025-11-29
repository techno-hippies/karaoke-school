#!/usr/bin/env bun
/**
 * Create Free Clip
 *
 * Creates the free clip portion for non-subscribers:
 * 1. Crops enhanced instrumental to clip_end_ms
 * 2. Generates clip lyrics JSON (lyrics within clip window)
 * 3. Uploads both to Grove
 *
 * Usage:
 *   bun src/scripts/create-clip.ts --iswc=T0101545054
 *   bun src/scripts/create-clip.ts --iswc=T0101545054 --dry-run
 */

import { parseArgs } from 'util';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getSongByISWC, getLyricsBySong, updateSongClipAudio } from '../db/queries';
import { uploadToGrove } from '../services/grove';
import type { Lyric } from '../types';

const SONGS_DIR = join(import.meta.dir, '../../songs');

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

/**
 * Download audio file from URL to local path
 */
async function downloadAudio(url: string, outputPath: string): Promise<void> {
  console.log(`   Downloading from: ${url.substring(0, 60)}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  await Bun.write(outputPath, buffer);
  console.log(`   Downloaded: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * Crop audio file using FFmpeg
 */
async function cropAudio(
  inputPath: string,
  outputPath: string,
  endMs: number
): Promise<void> {
  const endSeconds = endMs / 1000;

  console.log(`   Cropping to ${endSeconds.toFixed(2)}s...`);

  const proc = Bun.spawn([
    'ffmpeg',
    '-y',
    '-i', inputPath,
    '-t', endSeconds.toString(),
    '-c:a', 'libmp3lame',
    '-q:a', '2', // High quality VBR
    outputPath,
  ], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`FFmpeg failed: ${stderr}`);
  }

  const stat = await Bun.file(outputPath).stat();
  console.log(`   Output: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * Generate clip lyrics JSON
 */
function generateClipLyrics(
  lyrics: Lyric[],
  clipEndMs: number
): {
  lines: Array<{
    line_index: number;
    text: string;
    section_marker: string | null;
    start_ms: number;
    end_ms: number;
    clip_relative_start_ms: number;
    clip_relative_end_ms: number;
  }>;
  total_lines: number;
  clip_duration_ms: number;
} {
  // Filter lyrics that fall within clip window (with some overlap tolerance)
  const clipLyrics = lyrics
    .filter(l => l.start_ms !== null && l.end_ms !== null)
    .filter(l => l.start_ms! < clipEndMs) // Line starts before clip ends
    .sort((a, b) => a.line_index - b.line_index);

  const lines = clipLyrics.map(l => ({
    line_index: l.line_index,
    text: l.text,
    section_marker: l.section_marker,
    start_ms: l.start_ms!,
    end_ms: Math.min(l.end_ms!, clipEndMs), // Cap at clip end
    clip_relative_start_ms: l.start_ms!, // Clip starts at 0, so same as absolute
    clip_relative_end_ms: Math.min(l.end_ms!, clipEndMs),
  }));

  return {
    lines,
    total_lines: lines.length,
    clip_duration_ms: clipEndMs,
  };
}

async function main() {
  const iswc = values.iswc;
  const dryRun = values['dry-run'];

  if (!iswc) {
    console.error('❌ Must specify --iswc');
    process.exit(1);
  }

  console.log('\n🎬 Create Free Clip');
  console.log(`   ISWC: ${iswc}`);
  if (dryRun) console.log('   Mode: DRY RUN');

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error('❌ Song not found');
    process.exit(1);
  }

  console.log(`\n🎵 ${song.title}`);

  // Check prerequisites
  if (!song.clip_end_ms) {
    console.error('❌ No clip_end_ms set - run select-clip.ts first');
    process.exit(1);
  }

  if (!song.enhanced_instrumental_url) {
    console.error('❌ No enhanced instrumental - run process-audio.ts first');
    process.exit(1);
  }

  console.log(`   Clip end: ${song.clip_end_ms}ms (${(song.clip_end_ms / 1000).toFixed(1)}s)`);
  console.log(`   Full instrumental: ${song.enhanced_instrumental_url.substring(0, 50)}...`);

  // Get English lyrics
  const lyrics = await getLyricsBySong(song.id, 'en');
  if (lyrics.length === 0) {
    console.error('❌ No English lyrics found');
    process.exit(1);
  }

  // Generate clip lyrics JSON
  console.log('\n📝 Generating clip lyrics...');
  const clipLyrics = generateClipLyrics(lyrics, song.clip_end_ms);
  console.log(`   ${clipLyrics.total_lines} lines in clip`);

  if (dryRun) {
    console.log('\n📋 Clip lyrics preview:');
    clipLyrics.lines.slice(0, 5).forEach(l => {
      console.log(`   [${l.line_index}] ${l.text.substring(0, 40)}... (${l.start_ms}-${l.end_ms}ms)`);
    });
    if (clipLyrics.lines.length > 5) {
      console.log(`   ... and ${clipLyrics.lines.length - 5} more lines`);
    }
    console.log('\n✅ Dry run complete');
    process.exit(0);
  }

  // Setup working directory
  const songDir = join(SONGS_DIR, iswc);
  if (!existsSync(songDir)) {
    mkdirSync(songDir, { recursive: true });
  }

  const fullAudioPath = join(songDir, 'enhanced_instrumental.mp3');
  const clipAudioPath = join(songDir, 'clip_instrumental.mp3');
  const clipLyricsPath = join(songDir, 'clip_lyrics.json');

  // Download full instrumental
  console.log('\n📥 Downloading full instrumental...');
  await downloadAudio(song.enhanced_instrumental_url, fullAudioPath);

  // Crop audio
  console.log('\n✂️  Cropping audio...');
  await cropAudio(fullAudioPath, clipAudioPath, song.clip_end_ms);

  // Save clip lyrics JSON
  console.log('\n💾 Saving clip lyrics...');
  await Bun.write(clipLyricsPath, JSON.stringify(clipLyrics, null, 2));

  // Upload to Grove
  console.log('\n☁️  Uploading to Grove...');

  const clipAudioBuffer = await Bun.file(clipAudioPath).arrayBuffer();
  const clipAudioResult = await uploadToGrove(
    Buffer.from(clipAudioBuffer),
    `${iswc}-clip-instrumental.mp3`,
    'audio/mpeg'
  );
  console.log(`   Clip audio: ${clipAudioResult.url}`);

  const clipLyricsBuffer = await Bun.file(clipLyricsPath).arrayBuffer();
  const clipLyricsResult = await uploadToGrove(
    Buffer.from(clipLyricsBuffer),
    `${iswc}-clip-lyrics.json`,
    'application/json'
  );
  console.log(`   Clip lyrics: ${clipLyricsResult.url}`);

  // Update database
  console.log('\n💾 Updating database...');
  await updateSongClipAudio(iswc, {
    clip_instrumental_url: clipAudioResult.url,
    clip_lyrics_url: clipLyricsResult.url,
  });

  // Cleanup temp files
  console.log('\n🧹 Cleaning up...');
  try {
    unlinkSync(fullAudioPath);
    unlinkSync(clipAudioPath);
    unlinkSync(clipLyricsPath);
  } catch {
    // Ignore cleanup errors
  }

  console.log('\n✅ Done!');
  console.log(`   clip_instrumental_url: ${clipAudioResult.url}`);
  console.log(`   clip_lyrics_url: ${clipLyricsResult.url}`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
