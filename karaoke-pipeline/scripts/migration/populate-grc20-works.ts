/**
 * Populate grc20_works table from multiple sources
 *
 * Data sources (in priority order):
 * 1. Quansic: ISWC codes, comprehensive metadata
 * 2. MusicBrainz: Authoritative recordings, ISRCs
 * 3. Spotify: Primary track data, popularity
 * 4. Genius: Lyrics metadata, pageviews
 *
 * Strategy:
 * - Reference grc20_artists for primary_artist_id
 * - Use ISWC when available (industry standard)
 * - Flatten JSONB arrays to comma-separated TEXT
 */

import { query } from '../../src/db/neon';

interface WorkAggregation {
  // Identity
  title: string;
  alternateTitles?: string;
  disambiguation?: string;

  // Industry IDs
  iswc?: string;
  iswcSource?: string;
  isrc?: string;
  mbid?: string;
  bmiWorkId?: string;
  ascapWorkId?: string;

  // Platform IDs
  spotifyTrackId: string;
  geniusSongId?: number;
  discogsReleaseId?: string;

  // Artist relationships
  primaryArtistId?: number;
  primaryArtistName: string;
  featuredArtists?: string;
  composers?: string;
  producers?: string;
  lyricists?: string;
  bmiWriters?: string;
  bmiPublishers?: string;

  // Metadata
  language?: string;
  releaseDate?: string;
  durationMs?: number;
  workType?: string;

  // Musical
  genres?: string;
  explicitContent?: boolean;

  // Popularity
  spotifyPopularity?: number;
  spotifyPlayCount?: bigint;
  geniusPageviews?: number;
  geniusAnnotationCount?: number;
  geniusPyongsCount?: number;

  // Genius-specific
  geniusLyricsState?: string;
  geniusFeaturedVideo?: boolean;

  // URLs
  spotifyUrl?: string;
  geniusUrl?: string;
  musicbrainzUrl?: string;
  wikidataUrl?: string;

  // Images
  imageUrl?: string;
  imageSource?: string;
}

async function main() {
  console.log('🎵 Populating grc20_works table...\n');

  // Step 1: Get all ACTUALLY processed tracks (ignore buggy song_pipeline.status)
  console.log('📊 Finding processed tracks...');

  const processedTracks = await query(`
    SELECT DISTINCT
      ks.spotify_track_id,
      st.title,
      st.artists->0->>'name' as artist_name
    FROM karaoke_segments ks
    JOIN spotify_tracks st ON st.spotify_track_id = ks.spotify_track_id
    WHERE ks.fal_enhanced_grove_cid IS NOT NULL  -- Has completed audio
    ORDER BY st.title
  `);

  console.log(`   Found ${processedTracks.length} processed tracks\n`);

  // Step 2: Aggregate data for each work
  const aggregations: WorkAggregation[] = [];

  for (const { spotify_track_id, title, artist_name } of processedTracks) {
    console.log(`🔍 Aggregating: ${title} - ${artist_name}`);

    const agg: WorkAggregation = {
      spotifyTrackId: spotify_track_id,
      title,
      primaryArtistName: artist_name
    };

    // Get Spotify data
    const spotifyData = await query(`
      SELECT * FROM spotify_tracks WHERE spotify_track_id = $1
    `, [spotify_track_id]);

    if (spotifyData.length > 0) {
      const spotify = spotifyData[0];
      agg.isrc = spotify.isrc;
      agg.durationMs = spotify.duration_ms;
      agg.releaseDate = spotify.release_date;
      agg.spotifyPopularity = spotify.popularity;
      agg.explicitContent = spotify.explicit;
      agg.imageUrl = spotify.image_url;
      agg.imageSource = 'spotify';

      // Get artist ID from grc20_artists
      const artistData = await query(`
        SELECT id FROM grc20_artists WHERE spotify_artist_id = $1
      `, [spotify.spotify_artist_id]);

      if (artistData.length > 0) {
        agg.primaryArtistId = artistData[0].id;
      }

      // Build Spotify URL
      agg.spotifyUrl = `https://open.spotify.com/track/${spotify_track_id}`;
    }

    // Get Genius data
    const geniusData = await query(`
      SELECT * FROM genius_songs WHERE spotify_track_id = $1
    `, [spotify_track_id]);

    if (geniusData.length > 0) {
      const genius = geniusData[0];
      agg.geniusSongId = genius.genius_song_id;
      agg.language = genius.language;
      agg.releaseDate = genius.release_date || agg.releaseDate;
      agg.geniusPageviews = genius.pageviews;
      agg.geniusAnnotationCount = genius.annotation_count;
      agg.geniusPyongsCount = genius.pyongs_count;
      agg.geniusLyricsState = genius.lyrics_state;
      agg.geniusFeaturedVideo = genius.featured_video;
      agg.geniusUrl = `https://genius.com/songs/${genius.genius_song_id}`;
    }

    // Get MusicBrainz data
    const mbData = await query(`
      SELECT * FROM musicbrainz_recordings WHERE spotify_track_id = $1
    `, [spotify_track_id]);

    if (mbData.length > 0) {
      const mb = mbData[0];
      agg.mbid = mb.mbid;
      agg.disambiguation = mb.disambiguation;
      agg.musicbrainzUrl = `https://musicbrainz.org/recording/${mb.mbid}`;

      // Extract wikidata from relations
      if (mb.relations && typeof mb.relations === 'object') {
        const wikidata = mb.relations['wikidata'];
        if (wikidata) agg.wikidataUrl = wikidata;
      }
    }

    // Get Quansic data (ISWC)
    const quansicData = await query(`
      SELECT * FROM quansic_recordings WHERE spotify_track_id = $1
    `, [spotify_track_id]);

    if (quansicData.length > 0 && quansicData[0].recording_data) {
      const recording = quansicData[0].recording_data;

      // ISWC (gold standard)
      if (recording.iswc) {
        agg.iswc = recording.iswc;
        agg.iswcSource = 'quansic';
      }

      // Composers
      if (recording.composers && Array.isArray(recording.composers)) {
        agg.composers = recording.composers.map((c: any) => c.name).join(', ');
      }

      // Producers
      if (recording.producers && Array.isArray(recording.producers)) {
        agg.producers = recording.producers.map((p: any) => p.name).join(', ');
      }
    }

    // Get BMI fallback data from processing_log
    const bmiLogData = await query(`
      SELECT metadata
      FROM processing_log
      WHERE spotify_track_id = $1
        AND stage = 'iswc_resolution'
        AND (metadata->>'source' = 'bmi' OR metadata->'bmi_work_id' IS NOT NULL)
      ORDER BY created_at DESC
      LIMIT 1
    `, [spotify_track_id]);

    if (bmiLogData.length > 0 && bmiLogData[0].metadata) {
      const bmiData = bmiLogData[0].metadata;

      // BMI ISWC (if Quansic didn't have it)
      if (bmiData.iswc && !agg.iswc) {
        agg.iswc = bmiData.iswc;
        agg.iswcSource = 'bmi';
      }

      // BMI work IDs
      if (bmiData.bmi_work_id) {
        agg.bmiWorkId = bmiData.bmi_work_id;
      }
      if (bmiData.ascap_work_id) {
        agg.ascapWorkId = bmiData.ascap_work_id;
      }

      // BMI writers (with IPIs)
      if (bmiData.writers && Array.isArray(bmiData.writers)) {
        agg.bmiWriters = bmiData.writers
          .map((w: any) => `${w.name}${w.ipi ? ` (IPI: ${w.ipi})` : ''}`)
          .join(', ');
      }

      // BMI publishers (with IPIs)
      if (bmiData.publishers && Array.isArray(bmiData.publishers)) {
        agg.bmiPublishers = bmiData.publishers
          .map((p: any) => `${p.name}${p.ipi ? ` (IPI: ${p.ipi})` : ''}`)
          .join(', ');
      }
    }

    aggregations.push(agg);
    console.log(`   ✅ ${agg.title} (ISWC: ${agg.iswc || 'none'})`);
  }

  console.log(`\n📝 Inserting ${aggregations.length} works into grc20_works...\n`);

  // Step 3: Insert into grc20_works
  for (const agg of aggregations) {
    await query(`
      INSERT INTO grc20_works (
        title, alternate_titles, disambiguation,
        iswc, iswc_source, isrc, mbid, bmi_work_id, ascap_work_id,
        spotify_track_id, genius_song_id, discogs_release_id,
        primary_artist_id, primary_artist_name,
        featured_artists, composers, producers, lyricists,
        bmi_writers, bmi_publishers,
        language, release_date, duration_ms, work_type,
        genres, explicit_content,
        spotify_popularity, spotify_play_count,
        genius_pageviews, genius_annotation_count, genius_pyongs_count,
        genius_lyrics_state, genius_featured_video,
        spotify_url, genius_url, musicbrainz_url, wikidata_url,
        image_url, image_source
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14,
        $15, $16, $17, $18,
        $19, $20,
        $21, $22, $23, $24,
        $25, $26,
        $27, $28,
        $29, $30, $31,
        $32, $33,
        $34, $35, $36, $37,
        $38, $39
      )
      ON CONFLICT (spotify_track_id) DO UPDATE SET
        updated_at = NOW()
    `, [
      agg.title, agg.alternateTitles, agg.disambiguation,
      agg.iswc, agg.iswcSource, agg.isrc, agg.mbid, agg.bmiWorkId, agg.ascapWorkId,
      agg.spotifyTrackId, agg.geniusSongId, agg.discogsReleaseId,
      agg.primaryArtistId, agg.primaryArtistName,
      agg.featuredArtists, agg.composers, agg.producers, agg.lyricists,
      agg.bmiWriters, agg.bmiPublishers,
      agg.language, agg.releaseDate, agg.durationMs, agg.workType,
      agg.genres, agg.explicitContent,
      agg.spotifyPopularity, agg.spotifyPlayCount,
      agg.geniusPageviews, agg.geniusAnnotationCount, agg.geniusPyongsCount,
      agg.geniusLyricsState, agg.geniusFeaturedVideo,
      agg.spotifyUrl, agg.geniusUrl, agg.musicbrainzUrl, agg.wikidataUrl,
      agg.imageUrl, agg.imageSource
    ]);

    console.log(`   ✅ Inserted: ${agg.title}`);
  }

  // Step 4: Summary
  const summary = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(iswc) as with_iswc,
      COUNT(iswc) FILTER (WHERE iswc_source = 'quansic') as iswc_from_quansic,
      COUNT(iswc) FILTER (WHERE iswc_source = 'bmi') as iswc_from_bmi,
      COUNT(bmi_work_id) as with_bmi_work_id,
      COUNT(bmi_writers) as with_bmi_writers,
      COUNT(primary_artist_id) as with_artist_link,
      COUNT(grc20_entity_id) as minted,
      COUNT(*) - COUNT(grc20_entity_id) as ready_to_mint
    FROM grc20_works
  `);

  console.log('\n📊 Summary:');
  console.log(`   Total works: ${summary[0].total}`);
  console.log(`   With ISWC: ${summary[0].with_iswc} (${Math.round(summary[0].with_iswc / summary[0].total * 100)}%)`);
  console.log(`     - From Quansic: ${summary[0].iswc_from_quansic}`);
  console.log(`     - From BMI: ${summary[0].iswc_from_bmi}`);
  console.log(`   With BMI work ID: ${summary[0].with_bmi_work_id}`);
  console.log(`   With BMI writers (IPIs): ${summary[0].with_bmi_writers}`);
  console.log(`   With artist link: ${summary[0].with_artist_link} (${Math.round(summary[0].with_artist_link / summary[0].total * 100)}%)`);
  console.log(`   Already minted: ${summary[0].minted}`);
  console.log(`   Ready to mint: ${summary[0].ready_to_mint}`);

  console.log('\n✅ Done!\n');
}

main().catch(console.error);
