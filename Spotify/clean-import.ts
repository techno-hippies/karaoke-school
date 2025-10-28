/**
 * Clean Spotify Import
 *
 * Simple line-by-line processing of SQL dumps
 */

import { neon } from '@neondatabase/serverless';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const sql = neon(process.env.DATABASE_URL!);
const SPOTIFY_DATA_PATH = '/media/t42/me/QBittorrent/MusicBrainz Tidal Spotify Deezer Dataset 06 July 2025';

interface ImportStats {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ line: number; error: string }>;
}

async function importFile(filename: string): Promise<ImportStats> {
  const filePath = `${SPOTIFY_DATA_PATH}/${filename}`;
  console.log(`\n📁 Processing ${filename}`);

  const stats: ImportStats = {
    total: 0,
    success: 0,
    failed: 0,
    errors: []
  };

  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;

    // Skip non-INSERT lines
    if (!line.trim().startsWith('INSERT INTO public.')) {
      continue;
    }

    stats.total++;

    try {
      // Remove "public." schema prefix and trailing semicolon
      const cleanStatement = line
        .replace(/INSERT INTO public\./g, 'INSERT INTO ')
        .replace(/;$/g, '');

      // Execute single INSERT
      await sql.unsafe(cleanStatement);
      stats.success++;

      // Progress every 1000 inserts
      if (stats.success % 1000 === 0) {
        const progress = ((stats.success / stats.total) * 100).toFixed(1);
        console.log(`   📊 ${stats.success.toLocaleString()} / ${stats.total.toLocaleString()} (${progress}%)`);
      }

    } catch (error: any) {
      stats.failed++;

      // Log first 10 errors only
      if (stats.errors.length < 10) {
        stats.errors.push({
          line: lineNumber,
          error: error.message?.substring(0, 100)
        });
      }

      // Don't spam console with every error
      if (stats.failed === 1 || stats.failed % 100 === 0) {
        console.error(`   ⚠️ Errors: ${stats.failed}`);
      }
    }
  }

  return stats;
}

async function main() {
  console.log('🎵 Starting Clean Spotify Import');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.substring(0, 50)}...`);
  console.log(`📂 Source: ${SPOTIFY_DATA_PATH}\n`);

  const startTime = Date.now();

  // Import order matters due to foreign keys
  const files = [
    'spotify_artist.sql',           // 214k artists
    'spotify_album.sql',            // 408k albums
    'spotify_track.sql',            // 2.1M tracks
    'spotify_album_artist.sql',     // relationships
    'spotify_track_artist.sql',     // relationships
    'spotify_artist_image.sql',     // images
    'spotify_album_image.sql',      // images
    'spotify_album_externalid.sql', // external IDs
    'spotify_track_externalid.sql'  // ISRCs (critical!)
  ];

  const results: Array<{ file: string; stats: ImportStats }> = [];

  for (const file of files) {
    try {
      const stats = await importFile(file);
      results.push({ file, stats });

      console.log(`   ✅ ${file}: ${stats.success.toLocaleString()} / ${stats.total.toLocaleString()} succeeded`);

      if (stats.failed > 0) {
        console.log(`   ⚠️ Failed: ${stats.failed.toLocaleString()}`);

        if (stats.errors.length > 0) {
          console.log(`   First errors:`);
          for (const err of stats.errors.slice(0, 3)) {
            console.log(`     Line ${err.line}: ${err.error}`);
          }
        }
      }

    } catch (error) {
      console.error(`   ❌ Fatal error in ${file}:`, error);
      throw error;
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(`\n📊 Import Summary (${duration} minutes):`);
  console.log('─'.repeat(60));

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const { file, stats } of results) {
    totalSuccess += stats.success;
    totalFailed += stats.failed;
    console.log(`${file.padEnd(35)} ${stats.success.toLocaleString().padStart(8)} / ${stats.total.toLocaleString()}`);
  }

  console.log('─'.repeat(60));
  console.log(`Total: ${totalSuccess.toLocaleString()} succeeded, ${totalFailed.toLocaleString()} failed`);

  // Verify critical tables
  console.log('\n🔍 Verification:');

  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM spotify_artist) as artists,
      (SELECT COUNT(*) FROM spotify_track) as tracks,
      (SELECT COUNT(*) FROM spotify_track_externalid WHERE name = 'isrc') as isrcs
  `;

  console.log(`   Artists: ${Number(counts[0].artists).toLocaleString()}`);
  console.log(`   Tracks: ${Number(counts[0].tracks).toLocaleString()}`);
  console.log(`   ISRCs: ${Number(counts[0].isrcs).toLocaleString()}`);

  console.log('\n✅ Import complete!');
}

if (require.main === module) {
  main().catch(console.error);
}
