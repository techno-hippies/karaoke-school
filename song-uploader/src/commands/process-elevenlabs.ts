#!/usr/bin/env bun

/**
 * Generate ElevenLabs word-level alignments for songs
 * Usage:
 *   bun run src/commands/process-elevenlabs.ts --song song-1
 *   bun run src/commands/process-elevenlabs.ts --all
 */

import '@dotenvx/dotenvx/config';
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { ElevenLabsProcessor } from '../processors/elevenlabs.js';
import { parseAudioFilename } from '../utils/filename-parser.js';

const SONGS_DIR = './songs';

interface SongFiles {
  audio: File;
  voiceStems?: File;
  lyrics: File;
}

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
 * Load song files for processing
 */
async function loadSongFiles(songId: string): Promise<SongFiles | null> {
  const songDir = join(SONGS_DIR, songId);

  try {
    const files = await readdir(songDir);
    const songFiles: Partial<SongFiles> = {};

    for (const file of files) {
      const filePath = join(songDir, file);
      const ext = extname(file).toLowerCase();

      if (ext === '.mp3' || ext === '.wav' || ext === '.m4a') {
        const parsed = parseAudioFilename(file);

        if (parsed?.isVocals) {
          songFiles.voiceStems = new File(
            [await Bun.file(filePath).arrayBuffer()],
            file,
            { type: `audio/${ext.slice(1)}` }
          );
        } else if (parsed?.isFullTrack) {
          songFiles.audio = new File(
            [await Bun.file(filePath).arrayBuffer()],
            file,
            { type: `audio/${ext.slice(1)}` }
          );
        }
        // Skip instrumental tracks for alignment processing
      } else if (file === 'lyrics.txt') {
        songFiles.lyrics = new File(
          [await Bun.file(filePath).arrayBuffer()],
          file,
          { type: 'text/plain' }
        );
      }
    }

    if (!songFiles.audio) {
      console.error(`  ❌ Missing audio file`);
      return null;
    }

    if (!songFiles.lyrics) {
      console.error(`  ❌ Missing lyrics.txt`);
      return null;
    }

    return songFiles as SongFiles;
  } catch (error) {
    console.error(`  ❌ Error loading files:`, error);
    return null;
  }
}

/**
 * Process a single song with ElevenLabs
 */
async function processSong(
  songId: string,
  apiKey: string
): Promise<boolean> {
  console.log(`📀 Processing ${songId}...`);

  // Load files
  const songFiles = await loadSongFiles(songId);
  if (!songFiles) {
    return false;
  }

  // Check for existing alignment file
  const alignmentFilePath = join(SONGS_DIR, songId, 'karaoke-alignment.json');
  const processor = new ElevenLabsProcessor(apiKey);

  try {
    await processor.loadAlignmentFromFile(alignmentFilePath);
    console.log(`  ✅ Alignment already exists (skipped)`);
    return true;
  } catch {
    // No existing alignment, need to call API
  }

  // Load lyrics
  const lyrics = await songFiles.lyrics.text();
  if (!lyrics.trim()) {
    console.error(`  ❌ Empty lyrics file`);
    return false;
  }

  // Call ElevenLabs API
  console.log(`  📞 Calling ElevenLabs API...`);
  const audioForProcessing = songFiles.voiceStems || songFiles.audio;

  try {
    const alignmentResult = await processor.callElevenLabsAPI(
      audioForProcessing,
      lyrics
    );

    await processor.saveAlignmentToFile(alignmentFilePath, alignmentResult);
    console.log(`  ✅ Alignment saved (${alignmentResult.words.length} words)`);
    return true;
  } catch (error) {
    console.error(`  ❌ ElevenLabs API failed:`, error);
    return false;
  }
}

/**
 * Main command
 */
async function main() {
  const args = process.argv.slice(2);

  // Check for API key
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY environment variable is required');
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
    console.error('  bun run src/commands/process-elevenlabs.ts --song <songId>');
    console.error('  bun run src/commands/process-elevenlabs.ts --all');
    process.exit(1);
  }

  if (targetSongs.length === 0) {
    console.log('No songs found to process');
    return;
  }

  console.log(`🎵 Processing ${targetSongs.length} song(s) with ElevenLabs...\n`);

  // Process each song
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const songId of targetSongs) {
    const success = await processSong(songId, apiKey);
    if (success) {
      successCount++;
    } else {
      failedCount++;
    }
    console.log();
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Processing Summary:`);
  console.log(`   Total: ${targetSongs.length}`);
  console.log(`   Processed: ${successCount}`);
  console.log(`   Failed: ${failedCount}\n`);

  if (failedCount > 0) {
    console.error('❌ Some songs failed to process');
    process.exit(1);
  } else {
    console.log('✅ All songs processed successfully!');
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
