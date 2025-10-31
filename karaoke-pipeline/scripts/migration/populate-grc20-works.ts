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

/**
 * Normalize ISWC to unformatted: T + 10 digits
 * Input: T0719621610 or T-071.962.161-0
 * Output: T0719621610
 */
function normalizeISWC(iswc: string): string {
  // Extract just T and digits, remove all punctuation
  const match = iswc.match(/^T(\d+)$/);
  if (match) {
    const digits = match[1];
    if (digits.length === 10) {
      return `T${digits}`;
    }
  }

  // If it has punctuation, strip it
  const digits = iswc.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `T${digits}`;
  }

  console.warn(`⚠️ Invalid ISWC: ${iswc} (expected T + 10 digits, got ${iswc})`);
  return iswc; // Return as-is if invalid
}

interface WorkAggregation {
  // Identity
  title: string;
  alternateTitles?: string;
  disambiguation?: string;

  // Industry IDs
  iswc?: string;
  iswcSource?: string;
  mbid?: string;  // MusicBrainz WORK ID (not recording ID)
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
      title, // Will be overridden with work title (priority: Quansic > BMI > Genius > cleaned Spotify)
      primaryArtistName: artist_name
    };

    // Store work title candidates (declared early for scope)
    let quansicWorkTitle: string | undefined;
    let musicbrainzWorkTitle: string | undefined;
    let spotifyCleanedTitle: string | undefined;
    let geniusWorkTitle: string | undefined;

    // For alternate_titles tracking
    const titleVariants: string[] = [];

    // Get Spotify data with artist ID extracted in SQL
    const spotifyData = await query(`
      SELECT
        st.*,
        st.artists->0->>'id' as primary_artist_spotify_id,
        ga.id as primary_artist_grc20_id
      FROM spotify_tracks st
      LEFT JOIN grc20_artists ga ON ga.spotify_artist_id = st.artists->0->>'id'
      WHERE st.spotify_track_id = $1
    `, [spotify_track_id]);

    if (spotifyData.length > 0) {
      const spotify = spotifyData[0];
      // NOTE: We do NOT store ISRC (recording code) - this table is for WORKS which use ISWC
      agg.durationMs = spotify.duration_ms;
      agg.releaseDate = spotify.release_date;
      agg.spotifyPopularity = spotify.popularity;
      agg.explicitContent = spotify.explicit;
      agg.imageUrl = spotify.image_url;
      agg.imageSource = 'spotify';

      // Artist ID already joined in SQL
      if (spotify.primary_artist_grc20_id) {
        agg.primaryArtistId = spotify.primary_artist_grc20_id;
      }

      // Clean Spotify title (remove recording artifacts)
      spotifyCleanedTitle = spotify.title
        .replace(/ - \d{4} Remaster(ed)?$/i, '')
        .replace(/ - Remaster(ed)?( \d{4})?$/i, '')
        .replace(/ \(feat\. [^)]+\)$/i, '')
        .replace(/ \(with [^)]+\)$/i, '')
        .trim();

      // NOTE: We do NOT store raw Spotify recording title as variant
      // Recording artifacts ("- Remaster", features) are NOT alternate titles

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

      // Genius title (usually canonical, strips features/remasters)
      if (genius.title) {
        geniusWorkTitle = genius.title;
      }
    }

    // Get MusicBrainz data (recording level, for disambiguation/relations only)
    // NOTE: We do NOT store recording MBIDs - we'll get work MBIDs from musicbrainz_works
    const mbData = await query(`
      SELECT * FROM musicbrainz_recordings WHERE spotify_track_id = $1
    `, [spotify_track_id]);

    if (mbData.length > 0) {
      const mb = mbData[0];
      agg.disambiguation = mb.disambiguation;
      // Don't set musicbrainzUrl yet - will be set to work URL if we find the work

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

    if (quansicData.length > 0) {
      const recording = quansicData[0];

      // Work title (GOLD STANDARD - highest priority)
      if (recording.work_title) {
        quansicWorkTitle = recording.work_title;
      }

      // ISWC (gold standard)
      if (recording.iswc) {
        agg.iswc = normalizeISWC(recording.iswc);
        agg.iswcSource = 'quansic';
      }

      // Composers
      if (recording.composers && Array.isArray(recording.composers)) {
        agg.composers = recording.composers.map((c: any) => c.name).join(', ');
      }

      // Producers (note: quansic_recordings doesn't have producers field)
      // This would need to come from raw_data if available
      if (recording.raw_data?.producers && Array.isArray(recording.raw_data.producers)) {
        agg.producers = recording.raw_data.producers.map((p: any) => p.name).join(', ');
      }
    }

    // Get MusicBrainz Works data (NEW!) - JOIN via ISRC since spotify_track_id may be NULL
    const mbWorksData = await query(`
      SELECT mbw.*
      FROM spotify_tracks st
      JOIN musicbrainz_recordings mr ON mr.isrc = st.isrc
      JOIN musicbrainz_works mbw ON mbw.work_mbid = mr.work_mbid
      WHERE st.spotify_track_id = $1
        AND st.isrc IS NOT NULL
        AND mr.work_mbid IS NOT NULL
    `, [spotify_track_id]);

    if (mbWorksData.length > 0) {
      const mbWork = mbWorksData[0];

      // Store WORK MBID (not recording MBID)
      if (mbWork.work_mbid) {
        agg.mbid = mbWork.work_mbid;
        agg.musicbrainzUrl = `https://musicbrainz.org/work/${mbWork.work_mbid}`;
      }

      // MusicBrainz work title (ISWC-registered canonical title)
      if (mbWork.title) {
        musicbrainzWorkTitle = mbWork.title;
      }

      // ISWC (only if not already found from Quansic)
      if (mbWork.iswc && !agg.iswc) {
        agg.iswc = normalizeISWC(mbWork.iswc);
        agg.iswcSource = 'musicbrainz';
      }
    }

    // Get BMI Works data (NEW! Join via ISWC)
    if (agg.iswc) {
      const bmiData = await query(`
        SELECT * FROM bmi_works WHERE iswc = $1
      `, [agg.iswc]);

      if (bmiData.length > 0) {
        const bmi = bmiData[0];

        // NOTE: BMI titles are too unreliable (ALL CAPS, missing apostrophes)
        // We use BMI ONLY for writer/publisher metadata, NOT for titles

        // BMI work IDs
        if (bmi.bmi_work_id) agg.bmiWorkId = bmi.bmi_work_id;
        if (bmi.ascap_work_id) agg.ascapWorkId = bmi.ascap_work_id;

        // BMI writers (with IPIs) - structured data!
        if (bmi.writers && Array.isArray(bmi.writers)) {
          agg.bmiWriters = bmi.writers
            .map((w: any) => `${w.name}${w.ipi ? ` (IPI: ${w.ipi})` : ''}`)
            .join(', ');
        }

        // BMI publishers (with IPIs)
        if (bmi.publishers && Array.isArray(bmi.publishers)) {
          agg.bmiPublishers = bmi.publishers
            .map((p: any) => `${p.name}${p.ipi ? ` (IPI: ${p.ipi})` : ''}`)
            .join(', ');
        }
      }
    }

    // Fallback: Get BMI data from processing_log (legacy)
    if (!agg.iswc || !agg.bmiWorkId) {
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
        const legacyBmi = bmiLogData[0].metadata;

        // BMI ISWC (if nothing else found it)
        if (legacyBmi.iswc && !agg.iswc) {
          agg.iswc = legacyBmi.iswc;
          agg.iswcSource = 'bmi';
        }

        // BMI work IDs (if not from bmi_works table)
        if (legacyBmi.bmi_work_id && !agg.bmiWorkId) {
          agg.bmiWorkId = legacyBmi.bmi_work_id;
        }
        if (legacyBmi.ascap_work_id && !agg.ascapWorkId) {
          agg.ascapWorkId = legacyBmi.ascap_work_id;
        }
      }
    }

    // CRITICAL: Determine proper WORK title (not recording title)
    // Priority: Quansic > MusicBrainz > Spotify cleaned > Genius
    // BMI excluded: too unreliable (ALL CAPS, missing apostrophes, includes features)

    let finalTitle: string;

    if (quansicWorkTitle) {
      finalTitle = quansicWorkTitle;
      // Store other sources as variants if different
      if (musicbrainzWorkTitle && musicbrainzWorkTitle !== finalTitle) {
        titleVariants.push(musicbrainzWorkTitle);
      }
      if (spotifyCleanedTitle && spotifyCleanedTitle !== finalTitle) {
        titleVariants.push(spotifyCleanedTitle);
      }
      if (geniusWorkTitle && geniusWorkTitle !== finalTitle) {
        titleVariants.push(geniusWorkTitle);
      }
    } else if (musicbrainzWorkTitle) {
      finalTitle = musicbrainzWorkTitle;
      // Store other sources as variants if different
      if (spotifyCleanedTitle && spotifyCleanedTitle !== finalTitle) {
        titleVariants.push(spotifyCleanedTitle);
      }
      if (geniusWorkTitle && geniusWorkTitle !== finalTitle) {
        titleVariants.push(geniusWorkTitle);
      }
    } else if (spotifyCleanedTitle) {
      // Corroboration check: Do Spotify and Genius agree?
      if (geniusWorkTitle && spotifyCleanedTitle === geniusWorkTitle) {
        // ✅ Both sources agree - high confidence
        finalTitle = spotifyCleanedTitle;
      } else {
        // Use Spotify (recording authority), store Genius as variant
        finalTitle = spotifyCleanedTitle;
        if (geniusWorkTitle && geniusWorkTitle !== finalTitle) {
          titleVariants.push(geniusWorkTitle);
        }
      }
    } else if (geniusWorkTitle) {
      finalTitle = geniusWorkTitle;
    } else {
      // Fallback: use initial Spotify title (shouldn't happen)
      finalTitle = agg.title;
    }

    agg.title = finalTitle;

    // Build alternate_titles from all collected variants
    // Only store MEANINGFUL differences (not capitalization)
    if (titleVariants.length > 0) {
      const uniqueVariants = [...new Set(titleVariants)]
        .filter(v => {
          // Remove if same as primary (case-insensitive)
          if (v.toLowerCase() === finalTitle.toLowerCase()) return false;

          // Keep only if meaningfully different (not just capitalization)
          return v !== finalTitle;
        });

      if (uniqueVariants.length > 0) {
        agg.alternateTitles = uniqueVariants.join(' | ');
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
        iswc, iswc_source, mbid, bmi_work_id, ascap_work_id,
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
        $4, $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13,
        $14, $15, $16, $17,
        $18, $19,
        $20, $21, $22, $23,
        $24, $25,
        $26, $27,
        $28, $29, $30,
        $31, $32,
        $33, $34, $35, $36,
        $37, $38
      )
      ON CONFLICT (spotify_track_id) DO UPDATE SET
        title = EXCLUDED.title,
        alternate_titles = EXCLUDED.alternate_titles,
        iswc = EXCLUDED.iswc,
        iswc_source = EXCLUDED.iswc_source,
        mbid = EXCLUDED.mbid,
        bmi_work_id = EXCLUDED.bmi_work_id,
        ascap_work_id = EXCLUDED.ascap_work_id,
        primary_artist_id = EXCLUDED.primary_artist_id,
        primary_artist_name = EXCLUDED.primary_artist_name,
        composers = EXCLUDED.composers,
        producers = EXCLUDED.producers,
        bmi_writers = EXCLUDED.bmi_writers,
        bmi_publishers = EXCLUDED.bmi_publishers,
        language = EXCLUDED.language,
        release_date = EXCLUDED.release_date,
        duration_ms = EXCLUDED.duration_ms,
        spotify_popularity = EXCLUDED.spotify_popularity,
        genius_pageviews = EXCLUDED.genius_pageviews,
        genius_annotation_count = EXCLUDED.genius_annotation_count,
        genius_lyrics_state = EXCLUDED.genius_lyrics_state,
        spotify_url = EXCLUDED.spotify_url,
        genius_url = EXCLUDED.genius_url,
        musicbrainz_url = EXCLUDED.musicbrainz_url,
        wikidata_url = EXCLUDED.wikidata_url,
        image_url = EXCLUDED.image_url,
        image_source = EXCLUDED.image_source,
        updated_at = NOW()
    `, [
      agg.title, agg.alternateTitles, agg.disambiguation,
      agg.iswc, agg.iswcSource, agg.mbid, agg.bmiWorkId, agg.ascapWorkId,
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
      COUNT(iswc) FILTER (WHERE iswc_source = 'musicbrainz') as iswc_from_musicbrainz,
      COUNT(iswc) FILTER (WHERE iswc_source = 'bmi') as iswc_from_bmi,
      COUNT(bmi_work_id) as with_bmi_work_id,
      COUNT(bmi_writers) as with_bmi_writers,
      COUNT(composers) as with_composers,
      COUNT(primary_artist_id) as with_artist_link,
      COUNT(grc20_entity_id) as minted,
      COUNT(*) - COUNT(grc20_entity_id) as ready_to_mint
    FROM grc20_works
  `);

  console.log('\n📊 Summary:');
  console.log(`   Total works: ${summary[0].total}`);
  console.log(`   With ISWC: ${summary[0].with_iswc} (${Math.round(summary[0].with_iswc / summary[0].total * 100)}%)`);
  console.log(`     - From Quansic: ${summary[0].iswc_from_quansic}`);
  console.log(`     - From MusicBrainz: ${summary[0].iswc_from_musicbrainz}`);
  console.log(`     - From BMI: ${summary[0].iswc_from_bmi}`);
  console.log(`   With BMI work ID: ${summary[0].with_bmi_work_id}`);
  console.log(`   With BMI writers (IPIs): ${summary[0].with_bmi_writers}`);
  console.log(`   With composers: ${summary[0].with_composers}`);
  console.log(`   With artist link: ${summary[0].with_artist_link} (${Math.round(summary[0].with_artist_link / summary[0].total * 100)}%)`);
  console.log(`   Already minted: ${summary[0].minted}`);
  console.log(`   Ready to mint: ${summary[0].ready_to_mint}`);

  console.log('\n✅ Done!\n');
}

main().catch(console.error);
