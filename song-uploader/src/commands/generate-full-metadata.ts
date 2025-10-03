#!/usr/bin/env bun

/**
 * Generate full-song karaoke metadata with word-level and line-level timestamps
 * Usage:
 *   bun run src/commands/generate-full-metadata.ts --song "Artist - Title"
 *   bun run src/commands/generate-full-metadata.ts --all
 *   bun run src/commands/generate-full-metadata.ts --force --song "Artist - Title"
 */

import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { generateFullSongMetadata } from '../processors/full-song-generator.js';

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
 * Process a single song
 */
async function processSong(
  songId: string,
  force: boolean
): Promise<{ success: boolean; skipped: boolean }> {
  const songDir = join(SONGS_DIR, songId);
  const outputPath = join(songDir, 'full-song-metadata.json');

  // Check if already exists and not forcing
  if (!force && await existsSync(outputPath)) {
    console.log(`  ⏭️  Already exists (use --force to regenerate)`);
    return { success: true, skipped: true };
  }

  // Check for required files
  const alignmentPath = join(songDir, 'karaoke-alignment.json');
  const lyricsPath = join(songDir, 'lyrics.txt');

  if (!await existsSync(alignmentPath)) {
    console.log(`  ❌ Missing karaoke-alignment.json (run elevenlabs command first)`);
    return { success: false, skipped: false };
  }

  if (!await existsSync(lyricsPath)) {
    console.log(`  ❌ Missing lyrics.txt`);
    return { success: false, skipped: false };
  }

  try {
    console.log(`  🔄 Generating full-song metadata...`);

    const metadata = await generateFullSongMetadata(songId, songDir);

    // Save to file
    await Bun.write(outputPath, JSON.stringify(metadata, null, 2));

    console.log(`  ✅ Generated: full-song-metadata.json`);
    console.log(`     - Title: ${metadata.title}`);
    console.log(`     - Artist: ${metadata.artist}`);
    console.log(`     - Duration: ${Math.floor(metadata.duration)}s`);
    console.log(`     - Words: ${metadata.wordCount}`);
    console.log(`     - Lines: ${metadata.lineCount}`);
    console.log(`     - Languages: ${metadata.availableLanguages.join(', ')}`);
    console.log(`     - Sections: ${metadata.sectionIndex.length}`);

    return { success: true, skipped: false };
  } catch (error) {
    console.error(`  ❌ Generation failed:`, error);
    return { success: false, skipped: false };
  }
}

/**
 * Main command
 */
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  console.log('🎵 Full-Song Metadata Generator\n');

  if (force) {
    console.log('🔄 Force mode: Regenerating existing metadata\n');
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
    console.error('  bun run src/commands/generate-full-metadata.ts --song <songId>');
    console.error('  bun run src/commands/generate-full-metadata.ts --all');
    console.error('  bun run src/commands/generate-full-metadata.ts --force --all');
    process.exit(1);
  }

  if (targetSongs.length === 0) {
    console.log('No songs found');
    return;
  }

  console.log(`Processing ${targetSongs.length} song(s)...\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const songId of targetSongs) {
    console.log(`📀 ${songId}`);

    const result = await processSong(songId, force);

    if (result.success && !result.skipped) {
      processed++;
    } else if (result.skipped) {
      skipped++;
    } else {
      errors++;
    }

    console.log();
  }

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n📊 Summary:`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}\n`);

  if (errors > 0) {
    console.error('❌ Some songs failed to process');
    process.exit(1);
  } else {
    console.log('✅ All metadata generated successfully!');
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
