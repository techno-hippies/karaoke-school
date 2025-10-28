/**
 * Final Spotify Import - Using postgres driver with auto-commit
 */

import postgres from 'postgres';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const sql = postgres(process.env.DATABASE_URL!);
const SPOTIFY_DATA_PATH = '/media/t42/me/QBittorrent/MusicBrainz Tidal Spotify Deezer Dataset 06 July 2025';

async function importFile(filename: string) {
  const filePath = `${SPOTIFY_DATA_PATH}/${filename}`;
  console.log(`\n📁 Processing ${filename}`);

  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let total = 0;
  let success = 0;
  const batch: string[] = [];
  const BATCH_SIZE = 1000;

  for await (const line of rl) {
    // Skip non-INSERT lines
    if (!line.trim().startsWith('INSERT INTO public.')) {
      continue;
    }

    total++;

    // Remove schema prefix
    const cleanStatement = line
      .replace(/INSERT INTO public\./g, 'INSERT INTO ')
      .replace(/;$/g, '');

    batch.push(cleanStatement);

    // Process in batches
    if (batch.length >= BATCH_SIZE) {
      try {
        // Execute batch in single transaction
        await sql.begin(async sql => {
          for (const stmt of batch) {
            await sql.unsafe(stmt);
          }
        });
        success += batch.length;

        if (success % 10000 === 0) {
          console.log(`   📊 ${success.toLocaleString()} / ${total.toLocaleString()}`);
        }
      } catch (error: any) {
        console.error(`   ⚠️ Batch failed:`, error.message?.substring(0, 100));
      }

      batch.length = 0;
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    try {
      await sql.begin(async sql => {
        for (const stmt of batch) {
          await sql.unsafe(stmt);
        }
      });
      success += batch.length;
    } catch (error: any) {
      console.error(`   ⚠️ Final batch failed:`, error.message?.substring(0, 100));
    }
  }

  console.log(`   ✅ ${filename}: ${success.toLocaleString()} / ${total.toLocaleString()}`);
  return { total, success };
}

async function main() {
  console.log('🎵 Starting Final Spotify Import (postgres driver)');
  console.log(`📂 Source: ${SPOTIFY_DATA_PATH}\n`);

  const startTime = Date.now();

  const files = [
    'spotify_artist.sql',
    'spotify_album.sql',
    'spotify_track.sql',
    'spotify_album_artist.sql',
    'spotify_track_artist.sql',
    'spotify_artist_image.sql',
    'spotify_album_image.sql',
    'spotify_album_externalid.sql',
    'spotify_track_externalid.sql'
  ];

  for (const file of files) {
    await importFile(file);
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(`\n✅ Import complete in ${duration} minutes!`);

  // Verify
  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM spotify_artist) as artists,
      (SELECT COUNT(*) FROM spotify_track) as tracks,
      (SELECT COUNT(*) FROM spotify_track_externalid WHERE name = 'isrc') as isrcs
  `;

  console.log(`\n🔍 Verification:`);
  console.log(`   Artists: ${counts[0].artists.toLocaleString()}`);
  console.log(`   Tracks: ${counts[0].tracks.toLocaleString()}`);
  console.log(`   ISRCs: ${counts[0].isrcs.toLocaleString()}`);

  await sql.end();
}

main().catch(console.error);
