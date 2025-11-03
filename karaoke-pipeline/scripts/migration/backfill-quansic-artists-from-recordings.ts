#!/usr/bin/env bun
/**
 * Backfill quansic_artists from quansic_recordings.artists
 *
 * Problem: Some artists (Billie Eilish, Macklemore) came through /enrich-recording
 * but have different Spotify IDs in Quansic vs our spotify_tracks data.
 *
 * Solution: Extract all artists from quansic_recordings and insert into quansic_artists,
 * using the Spotify ID from our spotify_tracks (not Quansic's ID).
 */

import { query, close } from '../../src/db/neon';

interface QuansicRecording {
  spotify_track_id: string;
  artists: any[];
}

interface SpotifyArtist {
  spotify_artist_id: string;
  name: string;
}

async function main() {
  console.log('🎤 Backfilling quansic_artists from quansic_recordings...\n');

  // Get all quansic_recordings with artists
  const recordings = await query<QuansicRecording>(`
    SELECT spotify_track_id, artists
    FROM quansic_recordings
    WHERE artists IS NOT NULL
  `);

  console.log(`📊 Found ${recordings.length} recordings with artist data\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Extract unique artists
  const artistMap = new Map<string, any>();

  for (const recording of recordings) {
    if (!recording.artists || !Array.isArray(recording.artists)) continue;

    for (const artist of recording.artists) {
      const name = artist.name;
      const isni = artist.ids?.isnis?.[0];

      if (!name) continue;

      // Use ISNI as key if available, otherwise name
      const key = isni || name;

      // Keep the first occurrence (they should all be the same)
      if (!artistMap.has(key)) {
        artistMap.set(key, artist);
      }
    }
  }

  console.log(`✅ Extracted ${artistMap.size} unique artists\n`);

  // Now match to our spotify_tracks to get correct Spotify IDs
  for (const [key, artistData] of artistMap) {
    const name = artistData.name;
    console.log(`\n🎤 Processing: ${name}`);

    try {
      // Find this artist in our spotify_tracks
      const matches = await query<SpotifyArtist>(`
        SELECT DISTINCT
          artist->>'id' as spotify_artist_id,
          artist->>'name' as name
        FROM spotify_tracks,
        jsonb_array_elements(artists) as artist
        WHERE LOWER(artist->>'name') = LOWER($1)
        LIMIT 1
      `, [name]);

      if (matches.length === 0) {
        console.log(`   ⚠️  Not in our spotify_tracks - skipping`);
        skipped++;
        continue;
      }

      const spotifyId = matches[0].spotify_artist_id;
      console.log(`   ✅ Matched to Spotify ID: ${spotifyId}`);

      // Check if already exists
      const existing = await query(`
        SELECT id FROM quansic_artists WHERE spotify_artist_id = $1
      `, [spotifyId]);

      if (existing.length > 0) {
        console.log(`   ⏭️  Already in quansic_artists`);
        skipped++;
        continue;
      }

      // Insert into quansic_artists
      await query(`
        INSERT INTO quansic_artists (
          spotify_artist_id,
          quansic_id,
          name,
          isni,
          isni_all,
          ipi_all,
          musicbrainz_mbid,
          luminate_ids,
          gracenote_ids,
          amazon_ids,
          apple_ids,
          raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (spotify_artist_id) DO NOTHING
      `, [
        spotifyId,
        artistData.ids?.quansicId || null,
        artistData.name,
        artistData.ids?.isnis?.[0] || null,
        artistData.ids?.isnis || null,
        artistData.ids?.ipis || null,
        artistData.ids?.musicBrainzIds?.[0] || null,
        artistData.ids?.luminateIds || null,
        artistData.ids?.gracenoteIds || null,
        artistData.ids?.amazonIds || null,
        artistData.ids?.appleIds || null,
        JSON.stringify(artistData)
      ]);

      console.log(`   ✅ Inserted into quansic_artists`);
      inserted++;

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errors++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 Summary:');
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('═══════════════════════════════════════\n');

  await close();
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
