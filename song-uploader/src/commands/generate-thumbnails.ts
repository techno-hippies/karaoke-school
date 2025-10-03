#!/usr/bin/env bun

/**
 * Generate 300x300 thumbnails from song-cover.png files
 * Usage:
 *   bun run src/commands/generate-thumbnails.ts --song "Artist - Title"
 *   bun run src/commands/generate-thumbnails.ts --all
 *   bun run src/commands/generate-thumbnails.ts --force --song "Artist - Title"
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { processSongImages } from '../processors/image-processor.js';

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
 * Main command
 */
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  console.log('🖼️  Thumbnail Generator\n');

  if (force) {
    console.log('🔄 Force mode: Regenerating all thumbnails\n');
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
    console.error('  bun run src/commands/generate-thumbnails.ts --song <songId>');
    console.error('  bun run src/commands/generate-thumbnails.ts --all');
    console.error('  bun run src/commands/generate-thumbnails.ts --force --all');
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

    const songDir = join(SONGS_DIR, songId);

    try {
      const result = await processSongImages(songDir, force);

      if (!result.hasCover) {
        console.log(`  ⏭️  Skipped (no song-cover.png)\n`);
        skipped++;
      } else {
        processed++;
        console.log();
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error);
      errors++;
      console.log();
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n📊 Summary:`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}\n`);

  if (errors > 0) {
    console.error('❌ Some thumbnails failed to generate');
    process.exit(1);
  } else {
    console.log('✅ All thumbnails generated successfully!');
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
