#!/usr/bin/env bun

/**
 * Slice songs into clip sections with audio and metadata
 * Usage:
 *   bun run src/commands/slice.ts --song song-1
 *   bun run src/commands/slice.ts --all
 */

import { readdir, stat, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { MetadataGenerator } from '../processors/metadata.js';
import { detectSections, normalizeClipTimestamps } from '../processors/section-detector.js';
import { sliceAudio, checkFFmpeg } from '../processors/audio-slicer.js';
import { analyzeLyrics } from '../processors/learning-metrics.js';
import { parseAudioFilename } from '../utils/filename-parser.js';
import type { EnhancedSongMetadata, ClipMetadata } from '../types.js';

const SONGS_DIR = './songs';

/**
 * Get list of song folders
 */
async function getSongFolders(): Promise<string[]> {
  try {
    const entries = await readdir(SONGS_DIR);
    const folders: string[] = [];

    for (const entry of entries) {
      const fullPath = join(SONGS_DIR, entry);
      const stats = await stat(fullPath);
      if (stats.isDirectory() && entry !== 'sample') {
        folders.push(entry);
      }
    }

    return folders;
  } catch (error) {
    console.error('Error scanning songs directory:', error);
    return [];
  }
}

/**
 * Load enhanced metadata for a song
 */
async function loadEnhancedMetadata(songId: string): Promise<EnhancedSongMetadata | null> {
  const songDir = join(SONGS_DIR, songId);

  try {
    // Load alignment file
    const alignmentPath = join(songDir, 'karaoke-alignment.json');
    const alignmentData = await Bun.file(alignmentPath).json();

    // Load lyrics
    const lyricsPath = join(songDir, 'lyrics.txt');
    const lyrics = await Bun.file(lyricsPath).text();
    const lyricsLines = lyrics.split('\n').filter(line => line.trim());

    // Load translations
    const translations: Record<string, string[]> = {};
    const translationsDir = join(songDir, 'translations');

    try {
      const translationFiles = await readdir(translationsDir);
      for (const file of translationFiles) {
        const langCode = file.replace('.txt', '');
        const filePath = join(translationsDir, file);
        const content = await Bun.file(filePath).text();
        const lines = content.split('\n').filter(line => line.trim());
        translations[langCode] = lines;
      }
    } catch {
      // No translations folder
    }

    // Find audio file to extract metadata
    const files = await readdir(songDir);
    let audioFilename = '';
    let artist = '';
    let title = '';

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (ext === '.mp3' || ext === '.wav' || ext === '.m4a') {
        const parsed = parseAudioFilename(file);
        if (parsed?.isFullTrack) {
          audioFilename = file;
          artist = parsed.artist;
          title = parsed.title;
          break;
        }
      }
    }

    if (!audioFilename) {
      console.error(`  ❌ No audio file found`);
      return null;
    }

    // Generate enhanced metadata
    const metadataGenerator = new MetadataGenerator();
    const enhancedMetadata = metadataGenerator.generateEnhancedMetadata(
      alignmentData.words,
      lyricsLines,
      translations,
      title,
      artist
    );

    return enhancedMetadata;
  } catch (error) {
    console.error(`  ❌ Error loading metadata:`, error);
    return null;
  }
}

/**
 * Get audio file paths for a song (full track and optional instrumental)
 */
async function getAudioPaths(songId: string): Promise<{ fullTrack: string | null; instrumental: string | null }> {
  const songDir = join(SONGS_DIR, songId);

  try {
    const files = await readdir(songDir);
    let fullTrack: string | null = null;
    let instrumental: string | null = null;

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (ext === '.mp3' || ext === '.wav' || ext === '.m4a') {
        const parsed = parseAudioFilename(file);
        if (parsed?.isFullTrack) {
          fullTrack = join(songDir, file);
        } else if (parsed?.isInstrumental) {
          instrumental = join(songDir, file);
        }
      }
    }

    return { fullTrack, instrumental };
  } catch (error) {
    console.error(`  ❌ Error finding audio:`, error);
    return { fullTrack: null, instrumental: null };
  }
}

/**
 * Slice a single song into clips
 */
async function sliceSong(songId: string): Promise<boolean> {
  console.log(`📀 Slicing ${songId}...`);

  // Load metadata
  const metadata = await loadEnhancedMetadata(songId);
  if (!metadata) {
    return false;
  }

  // Get audio paths
  const { fullTrack, instrumental } = await getAudioPaths(songId);
  if (!fullTrack) {
    console.error(`  ❌ No audio file found`);
    return false;
  }

  if (instrumental) {
    console.log(`  🎹 Instrumental track detected`);
  }

  // Detect sections
  const sections = detectSections(metadata);
  console.log(`  📍 Detected ${sections.length} sections`);

  // Create clips directory
  const clipsDir = join(SONGS_DIR, songId, 'clips');
  await mkdir(clipsDir, { recursive: true });

  // Slice each section
  let slicedCount = 0;

  for (const section of sections) {
    // Generate filename: "verse.mp3", "chorus.mp3", "verse-2.mp3", etc.
    const sectionSlug = section.sectionType.toLowerCase().replace(/\s+/g, '-');
    const clipFilename = section.sectionIndex === 0
      ? `${sectionSlug}.mp3`
      : `${sectionSlug}-${section.sectionIndex + 1}.mp3`;
    const clipPath = join(clipsDir, clipFilename);

    try {
      // Slice main audio
      await sliceAudio(fullTrack, section, clipPath);

      // Slice instrumental if available
      if (instrumental) {
        const instrumentalFilename = clipFilename.replace('.mp3', '-instrumental.mp3');
        const instrumentalClipPath = join(clipsDir, instrumentalFilename);
        await sliceAudio(instrumental, section, instrumentalClipPath);
      }

      // Normalize timestamps
      const normalizedLines = normalizeClipTimestamps(section.lines, section.startTime);

      // Calculate learning metrics
      const learningMetrics = await analyzeLyrics(normalizedLines, section.duration);

      // Generate clip metadata
      const clipMetadata: ClipMetadata = {
        version: 3 as 2, // Type hack for now
        id: section.id,
        title: metadata.title,
        artist: metadata.artist,
        sectionType: section.sectionType,
        sectionIndex: section.sectionIndex,
        duration: section.duration,
        format: 'word-and-line-timestamps',
        lines: normalizedLines,
        availableLanguages: metadata.availableLanguages,
        generatedAt: new Date().toISOString(),
        elevenLabsProcessed: true,
        wordCount: learningMetrics.pace.totalWords,
        lineCount: normalizedLines.length,
        learningMetrics
      };

      // Save metadata
      const metadataPath = join(clipsDir, `${clipFilename.replace('.mp3', '')}.json`);
      await Bun.write(metadataPath, JSON.stringify(clipMetadata, null, 2));

      slicedCount++;
      console.log(`  ✅ ${section.sectionType} ${section.sectionIndex > 0 ? section.sectionIndex + 1 : ''} (${section.duration.toFixed(1)}s, difficulty ${learningMetrics.difficultyLevel}/5)`);
    } catch (error) {
      console.error(`  ❌ Failed to slice ${section.id}:`, error);
    }
  }

  console.log(`  ✅ Sliced ${slicedCount}/${sections.length} clips`);
  return slicedCount === sections.length;
}

/**
 * Main command
 */
async function main() {
  const args = process.argv.slice(2);

  // Check ffmpeg
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    console.error('❌ ffmpeg not found. Please install ffmpeg.');
    process.exit(1);
  }

  // Parse arguments
  let targetSongs: string[] = [];

  if (args.includes('--all')) {
    targetSongs = await getSongFolders();
  } else if (args.includes('--song')) {
    const songIndex = args.indexOf('--song');
    const songId = args[songIndex + 1];
    if (!songId) {
      console.error('❌ --song requires a song ID');
      process.exit(1);
    }
    targetSongs = [songId];
  } else {
    console.error('Usage:');
    console.error('  bun run src/commands/slice.ts --song <songId>');
    console.error('  bun run src/commands/slice.ts --all');
    process.exit(1);
  }

  if (targetSongs.length === 0) {
    console.log('No songs found to slice');
    return;
  }

  console.log(`✂️  Slicing ${targetSongs.length} song(s)...\n`);

  // Slice each song
  let successCount = 0;
  let failedCount = 0;

  for (const songId of targetSongs) {
    const success = await sliceSong(songId);
    if (success) {
      successCount++;
    } else {
      failedCount++;
    }
    console.log();
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Slicing Summary:`);
  console.log(`   Total: ${targetSongs.length}`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failedCount}\n`);

  if (failedCount > 0) {
    console.error('❌ Some songs failed to slice');
    process.exit(1);
  } else {
    console.log('✅ All songs sliced successfully!');
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
