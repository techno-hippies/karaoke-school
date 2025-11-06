#!/usr/bin/env bun
/**
 * Processor: Quansic Artist Enrichment
 * Enriches artists from spotify_tracks with ISNI/IPI data from Quansic
 *
 * Flow:
 * 1. Find artists in spotify_tracks.artists without Quansic data
 * 2. Call Quansic /lookup-artist endpoint with Spotify artist ID
 * 3. Store in quansic_artists table
 *
 * Usage:
 *   bun src/processors/08-enrich-quansic-artists.ts [batchSize]
 */

import { query, transaction, close } from '../db/neon';

const QUANSIC_URL = process.env.QUANSIC_URL || 'http://1lsb38mac5f273k366859u5390.ingress.akash-palmito.org';

interface SpotifyArtist {
  spotify_artist_id: string;
  name: string;
}

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 20;

  console.log('🎤 Quansic Artist Enrichment v2');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log(`🌐 Quansic URL: ${QUANSIC_URL}`);
  console.log('');

  // Find artists from spotify_tracks.artists that aren't in quansic_artists yet
  console.log('⏳ Finding artists to enrich...');

  const artistsToEnrich = await query<SpotifyArtist>(`
    SELECT DISTINCT
      artist->>'id' as spotify_artist_id,
      artist->>'name' as name
    FROM spotify_tracks,
    jsonb_array_elements(artists) as artist
    LEFT JOIN quansic_artists qa ON qa.spotify_artist_id = artist->>'id'
    WHERE qa.id IS NULL AND artist->>'id' IS NOT NULL
    ORDER BY artist->>'name'
    LIMIT ${batchSize}
  `);

  if (artistsToEnrich.length === 0) {
    console.log('✅ No artists need Quansic enrichment. All caught up!');
    await close();
    return;
  }

  console.log(`✅ Found ${artistsToEnrich.length} artists to enrich`);
  console.log('');

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const artist of artistsToEnrich) {
    console.log(`\n🎤 Processing: ${artist.name} (Spotify ID: ${artist.spotify_artist_id})`);

    try {
      const spotifyId = artist.spotify_artist_id;

      // Call Quansic /lookup-artist
      console.log(`   ⏳ Calling Quansic...`);
      const response = await fetch(`${QUANSIC_URL}/lookup-artist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotify_artist_id: spotifyId })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.log(`   ⚠️  Quansic lookup failed: ${result.error || 'Unknown error'}`);
        notFoundCount++;
        continue;
      }

      const data = result.data;
      console.log(`   ✅ Found in Quansic: ${data.name}`);
      console.log(`   📋 ISNI: ${data.ids?.isnis?.[0] || 'None'}`);

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
        ON CONFLICT (spotify_artist_id) DO UPDATE SET
          quansic_id = EXCLUDED.quansic_id,
          name = EXCLUDED.name,
          isni = EXCLUDED.isni,
          isni_all = EXCLUDED.isni_all,
          ipi_all = EXCLUDED.ipi_all,
          musicbrainz_mbid = EXCLUDED.musicbrainz_mbid,
          luminate_ids = EXCLUDED.luminate_ids,
          gracenote_ids = EXCLUDED.gracenote_ids,
          amazon_ids = EXCLUDED.amazon_ids,
          apple_ids = EXCLUDED.apple_ids,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        spotifyId,
        data.ids?.quansic_id || null,
        data.name,
        data.ids?.isnis?.[0] || null,
        data.ids?.isnis || null,
        data.ids?.ipis || null,
        data.ids?.musicBrainzIds?.[0] || null,
        data.ids?.luminateIds || null,
        data.ids?.gracenoteIds || null,
        data.ids?.amazonIds || null,
        data.ids?.appleIds || null,
        data.raw_data || null
      ]);

      console.log(`   ✅ Stored in quansic_artists`);
      successCount++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('📊 Summary:');
  console.log(`   ✅ Successfully enriched: ${successCount}`);
  console.log(`   ⚠️  Not found: ${notFoundCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('═══════════════════════════════════════');

  await close();
}

/**
 * Process Quansic artist enrichment (for orchestrator)
 */
export async function processQuansicArtistEnrichment(_env: any, limit: number = 20): Promise<void> {
  const artistsToEnrich = await query<SpotifyArtist>(`
    SELECT DISTINCT
      artist->>'id' as spotify_artist_id,
      artist->>'name' as name
    FROM spotify_tracks,
    jsonb_array_elements(artists) as artist
    LEFT JOIN quansic_artists qa ON qa.spotify_artist_id = artist->>'id'
    WHERE qa.id IS NULL AND artist->>'id' IS NOT NULL
    ORDER BY artist->>'name'
    LIMIT ${limit}
  `);

  if (artistsToEnrich.length === 0) {
    console.log('✅ No artists need Quansic enrichment');
    return;
  }

  console.log(`📊 Processing ${artistsToEnrich.length} artists`);

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const artist of artistsToEnrich) {
    console.log(`\n🎤 ${artist.name}`);

    try {
      const spotifyId = artist.spotify_artist_id;
      console.log(`   ✅ Spotify: ${spotifyId}`);

      const response = await fetch(`${QUANSIC_URL}/lookup-artist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotify_artist_id: spotifyId })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.log(`   ⚠️  Not in Quansic`);
        notFoundCount++;
        continue;
      }

      const data = result.data;
      console.log(`   ✅ ISNI: ${data.ids?.isnis?.[0] || 'None'}`);

      await query(`
        INSERT INTO quansic_artists (
          spotify_artist_id, quansic_id, name, isni, isni_all, ipi_all,
          musicbrainz_mbid, luminate_ids, gracenote_ids, amazon_ids, apple_ids, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (spotify_artist_id) DO UPDATE SET
          quansic_id = EXCLUDED.quansic_id, name = EXCLUDED.name,
          isni = EXCLUDED.isni, isni_all = EXCLUDED.isni_all, ipi_all = EXCLUDED.ipi_all,
          musicbrainz_mbid = EXCLUDED.musicbrainz_mbid,
          luminate_ids = EXCLUDED.luminate_ids, gracenote_ids = EXCLUDED.gracenote_ids,
          amazon_ids = EXCLUDED.amazon_ids, apple_ids = EXCLUDED.apple_ids,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        spotifyId, data.ids?.quansic_id || null, data.name,
        data.ids?.isnis?.[0] || null, data.ids?.isnis || null, data.ids?.ipis || null,
        data.ids?.musicBrainzIds?.[0] || null, data.ids?.luminateIds || null,
        data.ids?.gracenoteIds || null, data.ids?.amazonIds || null,
        data.ids?.appleIds || null, data.raw_data || null
      ]);

      successCount++;
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  console.log('\n📊 Quansic Artist Enrichment Summary:');
  console.log(`   ✅ Enriched: ${successCount}`);
  console.log(`   ⚠️  Not found: ${notFoundCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

// Run if called directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
