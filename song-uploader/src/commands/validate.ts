#!/usr/bin/env bun

/**
 * Validate lyrics format for song folders
 * Usage:
 *   bun run src/commands/validate.ts --song song-1
 *   bun run src/commands/validate.ts --all
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { validateSongFolder, formatValidationErrors } from '../processors/lyrics-validator.js';
import type { ValidationResult } from '../processors/lyrics-validator.js';

const SONGS_DIR = './songs';

interface ValidationReport {
  songId: string;
  result: ValidationResult;
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
 * Load lyrics and translations for a song
 */
async function loadSongLyrics(songId: string): Promise<{
  lyrics: string;
  translations: Map<string, string>;
} | null> {
  const songDir = join(SONGS_DIR, songId);

  try {
    // Load main lyrics
    const lyricsPath = join(songDir, 'lyrics.txt');
    const lyrics = await Bun.file(lyricsPath).text();

    if (!lyrics.trim()) {
      console.error(`❌ ${songId}: Empty lyrics file`);
      return null;
    }

    // Load translations
    const translations = new Map<string, string>();
    const translationsDir = join(songDir, 'translations');

    try {
      const translationFiles = await readdir(translationsDir);
      for (const file of translationFiles) {
        const langCode = file.replace('.txt', '');
        const filePath = join(translationsDir, file);
        const content = await Bun.file(filePath).text();
        translations.set(langCode, content);
      }
    } catch {
      // No translations folder - that's OK
    }

    return { lyrics, translations };
  } catch (error) {
    console.error(`❌ ${songId}: Failed to load lyrics -`, error);
    return null;
  }
}

/**
 * Validate a single song
 */
async function validateSong(songId: string): Promise<ValidationReport | null> {
  const songData = await loadSongLyrics(songId);
  if (!songData) {
    return null;
  }

  const result = await validateSongFolder(
    songId,
    songData.lyrics,
    songData.translations
  );

  return { songId, result };
}

/**
 * Main validation command
 */
async function main() {
  const args = process.argv.slice(2);

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
    console.error('  bun run src/commands/validate.ts --song <songId>');
    console.error('  bun run src/commands/validate.ts --all');
    process.exit(1);
  }

  if (targetSongs.length === 0) {
    console.log('No songs found to validate');
    return;
  }

  console.log(`🔍 Validating ${targetSongs.length} song(s)...\n`);

  // Validate each song
  const reports: ValidationReport[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const songId of targetSongs) {
    console.log(`📀 Validating ${songId}...`);
    const report = await validateSong(songId);

    if (!report) {
      console.log(`  ⚠️  Skipped (missing files)\n`);
      continue;
    }

    reports.push(report);
    totalErrors += report.result.errors.length;
    totalWarnings += report.result.warnings.length;

    if (report.result.valid) {
      if (report.result.warnings.length > 0) {
        console.log(`  ⚠️  Valid with warnings (${report.result.warnings.length})`);
      } else {
        console.log(`  ✅ Valid`);
      }
    } else {
      console.log(`  ❌ Invalid (${report.result.errors.length} errors)`);
    }
    console.log();
  }

  // Print detailed reports
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const report of reports) {
    if (report.result.errors.length > 0 || report.result.warnings.length > 0) {
      console.log(`📀 ${report.songId}:`);
      console.log(formatValidationErrors(report.result));
      console.log();
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Validation Summary:`);
  console.log(`   Songs checked: ${reports.length}`);
  console.log(`   Valid: ${reports.filter(r => r.result.valid).length}`);
  console.log(`   Invalid: ${reports.filter(r => !r.result.valid).length}`);
  console.log(`   Total errors: ${totalErrors}`);
  console.log(`   Total warnings: ${totalWarnings}\n`);

  // Exit with error code if any validation failures
  if (totalErrors > 0) {
    console.error('❌ Validation failed. Fix errors before processing.');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('⚠️  Validation passed with warnings.');
  } else {
    console.log('✅ All validations passed!');
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
