#!/usr/bin/env bun
/**
 * Backfill Genius IDs Script
 *
 * Finds songs missing genius_song_id and searches Genius to populate them.
 *
 * Usage:
 *   bun src/scripts/backfill-genius.ts
 *   bun src/scripts/backfill-genius.ts --dry-run
 */

import { parseArgs } from 'util';
import { query } from '../db/connection';
import { searchGenius } from '../services/genius';
import { validateEnv, GENIUS_API_KEY } from '../config';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

interface SongWithArtist {
  id: string;
  iswc: string;
  title: string;
  artist_name: string | null;
}

async function main() {
  validateEnv(['DATABASE_URL', 'GENIUS_API_KEY']);

  const dryRun = values['dry-run'];

  console.log('\n🔍 Backfill Genius IDs');
  if (dryRun) console.log('   (DRY RUN - no changes will be made)');

  // Find songs missing genius_song_id
  const songs = await query<SongWithArtist>(`
    SELECT s.id, s.iswc, s.title, a.name as artist_name
    FROM songs s
    LEFT JOIN artists a ON s.artist_id = a.id
    WHERE s.genius_song_id IS NULL
    ORDER BY s.created_at
  `);

  console.log(`\n   Found ${songs.length} songs missing Genius ID\n`);

  if (songs.length === 0) {
    console.log('✅ All songs have Genius IDs');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const song of songs) {
    const searchQuery = song.artist_name
      ? `${song.title} ${song.artist_name}`
      : song.title;

    console.log(`📀 ${song.title} (${song.iswc})`);
    console.log(`   Search: "${searchQuery}"`);

    try {
      const result = await searchGenius(searchQuery);

      if (result) {
        console.log(`   ✅ Found: ${result.title} by ${result.primary_artist.name}`);
        console.log(`   Genius ID: ${result.id}`);
        console.log(`   URL: ${result.url}`);

        if (!dryRun) {
          await query(
            `UPDATE songs SET genius_song_id = $1, genius_url = $2, updated_at = NOW() WHERE id = $3`,
            [result.id, result.url, song.id]
          );
          console.log(`   💾 Updated database`);
        }
        updated++;
      } else {
        console.log(`   ⚠️  No result found`);
        failed++;
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }

    // Rate limit - Genius API is strict
    await new Promise((r) => setTimeout(r, 2000));
    console.log();
  }

  console.log('\n📊 Summary');
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);

  if (dryRun && updated > 0) {
    console.log('\n💡 Run without --dry-run to apply changes');
  }

  if (updated > 0 && !dryRun) {
    console.log('\n💡 Next steps:');
    console.log('   Generate trivia for all songs:');
    for (const song of songs) {
      console.log(`   bun src/scripts/generate-exercises.ts --iswc=${song.iswc} --type=trivia`);
    }
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
