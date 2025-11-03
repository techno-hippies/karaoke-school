/**
 * Populate grc20_works table from multiple sources
 *
 * **WORK-LEVEL DATA ONLY** - Does NOT create recordings
 *
 * Data sources (in priority order):
 * 1. Quansic: ISWC codes, comprehensive metadata
 * 2. MusicBrainz: Authoritative recordings, ISRCs, work relationships
 * 3. MLC: Mechanical licensing data, ISWC fallback, writer/publisher info
 * 4. Spotify: Primary track data, popularity
 * 5. Genius: Lyrics metadata, pageviews
 *
 * Strategy:
 * - Reference grc20_artists for primary_artist_id
 * - Use ISWC when available (industry standard)
 * - ISWC priority: Quansic > MusicBrainz > MLC
 * - Flatten JSONB arrays to comma-separated TEXT
 * - Recordings are created separately by populate-grc20-recordings.ts
 */

import { query } from '../../src/db/neon';
import { withTransaction, validateDependencies } from '../../src/db/transaction';

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
  wikidataId?: string;  // Wikidata QID (universal entity identifier)
  // NOTE: BMI/ASCAP work IDs removed - internal only, not for blockchain minting

  // Platform IDs (work reference - for tracking known recordings)
  spotifyTrackId: string;
  geniusSongId?: number;

  // Artist relationships
  primaryArtistId?: number;
  primaryArtistName: string;
  featuredArtists?: string;
  composers?: string;
  producers?: string;
  lyricists?: string;
  // NOTE: BMI writers/publishers removed - internal only, not for blockchain minting

  // Work Metadata
  language?: string;
  workType?: string;
  genres?: string;

  // Musical Properties
  keySignature?: string;
  tempoBpm?: number;

  // Work Reference URLs (bibliographic)
  musicbrainzUrl?: string;
  wikidataUrl?: string;
  allmusicUrl?: string;
  secondhandsongs_url?: string;
  whosampledUrl?: string;
  locUrl?: string;
  bnfUrl?: string;
  worldcatUrl?: string;
  jaxstaUrl?: string;
  setlistfmUrl?: string;
  officialUrl?: string;
  lastfmUrl?: string;

  // Genius is work/lyrics level but genius_song_id is sufficient
  // (can construct URL as needed: https://genius.com/songs/{id})

  // Recording data (to be stored in grc20_work_recordings)
  // Spotify
  spotifyUrl?: string;
  releaseDate?: string;
  durationMs?: number;

  // Apple Music (only platform besides Spotify in quansic_recordings)
  appleMusicUrl?: string;

  // MusicBrainz recording metadata
  musicbrainzFirstReleaseDate?: string;
  musicbrainzIsVideo?: boolean;

  // Derivative images (Grove storage)
  groveImageUrl?: string;
  groveThumbnailUrl?: string;
}

async function main() {
  console.log('🎵 Populating grc20_works table...\n');

  // Validate dependencies
  await validateDependencies({ artists: true });

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
      // NOTE: We do NOT store popularity (mutable, changes over time)
      // NOTE: We do NOT store image URLs from Spotify - we use derivative_images (Grove storage)
      agg.durationMs = spotify.duration_ms;
      agg.releaseDate = spotify.release_date;

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

      // Extract featured artists (all artists beyond the first one)
      const artists = typeof spotify.artists === 'string' ? JSON.parse(spotify.artists) : spotify.artists;
      if (artists && Array.isArray(artists) && artists.length > 1) {
        const featuredArtistNames = artists
          .slice(1)  // Skip first artist (primary)
          .map((a: any) => a.name)
          .join(', ');
        if (featuredArtistNames) {
          agg.featuredArtists = featuredArtistNames;
        }
      }
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
      // NOTE: We don't store Genius engagement metrics (pageviews, annotations, pyongs, featured_video, lyrics_state)
      // These are recording-level and change over time - not immutable work metadata

      // Genius title (usually canonical, strips features/remasters)
      if (genius.title) {
        geniusWorkTitle = genius.title;
      }
    }

    // Get MusicBrainz data (recording level, for disambiguation/relations only)
    // NOTE: We do NOT store recording MBIDs - we'll get work MBIDs from musicbrainz_works
    // Join via ISRC since spotify_track_id may not be populated in musicbrainz_recordings
    const mbData = await query(`
      SELECT mbr.*
      FROM spotify_tracks st
      JOIN musicbrainz_recordings mbr ON mbr.isrc = st.isrc
      WHERE st.spotify_track_id = $1 AND st.isrc IS NOT NULL
    `, [spotify_track_id]);

    if (mbData.length > 0) {
      const mb = mbData[0];
      agg.disambiguation = mb.disambiguation;
      // Don't set musicbrainzUrl yet - will be set to work URL if we find the work

      // Extract recording metadata
      if (mb.first_release_date) {
        agg.musicbrainzFirstReleaseDate = mb.first_release_date;
      }
      if (mb.video !== null && mb.video !== undefined) {
        agg.musicbrainzIsVideo = mb.video;
      }

      // Extract genres from MusicBrainz tags (filter out chart data and non-genre tags)
      if (mb.tags && Array.isArray(mb.tags) && mb.tags.length > 0) {
        const invalidTagPatterns = [
          /wochen/i,              // Chart weeks
          /offizielle charts/i,   // Official charts
          /^\d+[\+\-]?\s*wochen/i, // "5+ wochen", "1-4 wochen"
          /chart/i,               // Generic chart references
          /^top\s*\d+/i,          // "top 10", "top 100"
          /billboard/i,           // Billboard charts
          /position/i             // Chart positions
        ];

        const validTags = mb.tags
          .filter((t: any) => {
            const tagName = t.name?.toLowerCase() || '';
            // Filter out invalid tags
            return !invalidTagPatterns.some(pattern => pattern.test(tagName));
          })
          .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
          .slice(0, 5)  // Top 5 valid tags
          .map((t: any) => t.name);

        if (validTags.length > 0) {
          agg.genres = validTags.join(', ');
        }
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

      // Composers and Lyricists
      if (recording.composers && Array.isArray(recording.composers)) {
        // Separate by role
        const composersOnly = recording.composers.filter((c: any) => c.role === 'Composer');
        const composerLyricists = recording.composers.filter((c: any) => c.role === 'ComposerLyricist');

        // If we have ComposerLyricists, they go in both fields
        if (composerLyricists.length > 0) {
          const names = composerLyricists.map((c: any) => c.name);
          agg.composers = [...names, ...composersOnly.map((c: any) => c.name)].join(', ');
          agg.lyricists = names.join(', ');
        } else if (composersOnly.length > 0) {
          agg.composers = composersOnly.map((c: any) => c.name).join(', ');
        } else {
          // Fallback: all composers regardless of role
          agg.composers = recording.composers.map((c: any) => c.name).join(', ');
        }
      }

      // Producers (note: quansic_recordings doesn't have producers field)
      // This would need to come from raw_data if available
      if (recording.raw_data?.producers && Array.isArray(recording.raw_data.producers)) {
        agg.producers = recording.raw_data.producers.map((p: any) => p.name).join(', ');
      }

      // Extract platform IDs/URLs from platform_ids JSONB
      if (recording.platform_ids && typeof recording.platform_ids === 'object') {
        const platformIds = recording.platform_ids;

        // Apple Music (only platform besides Spotify with data in quansic_recordings)
        if (platformIds.apple) {
          agg.appleMusicUrl = `https://music.apple.com/us/album/${platformIds.apple}`;
        }
        // Note: deezer, tidal, amazon, youtube, discogs NOT in quansic source data
      }
    }

    // Note: Migration 034 removed derivative_images table
    // Images are now stored directly in grc20_work_recordings
    // Skip derivative image fetching for now

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

      // Work type (e.g., "Song", "Instrumental")
      if (mbWork.work_type) {
        agg.workType = mbWork.work_type;
      }

      // Language (MusicBrainz is more reliable than Genius for this)
      if (mbWork.language && !agg.language) {
        agg.language = mbWork.language;
      }
    }

    // Get Wikidata Works data (NEW!) - JOIN via spotify_track_id
    const wikidataWorksData = await query(`
      SELECT wdw.*
      FROM wikidata_works wdw
      WHERE wdw.spotify_track_id = $1
    `, [spotify_track_id]);

    if (wikidataWorksData.length > 0) {
      const wdWork = wikidataWorksData[0];

      // Store Wikidata QID (universal entity identifier)
      if (wdWork.wikidata_id) {
        agg.wikidataId = wdWork.wikidata_id;
      }

      console.log(`   ✅ Wikidata: ${agg.wikidataId || 'no QID'}`);
    } else {
      console.log(`   ⚠️  Wikidata work: not found (run processor 05b-enrich-wikidata-works)`);
    }

    // NOTE: BMI Works integration removed - used only for internal ISWC hunting
    // BMI/ASCAP IDs should NOT be minted to blockchain (proprietary, not industry standard)

    // Get MLC Works data (NEW!) - JOIN via ISRC like MusicBrainz
    const mlcWorksData = await query(`
      SELECT mlw.*
      FROM spotify_tracks st
      JOIN mlc_works mlw ON mlw.isrc = st.isrc
      WHERE st.spotify_track_id = $1
        AND st.isrc IS NOT NULL
    `, [spotify_track_id]);

    if (mlcWorksData.length > 0) {
      const mlcWork = mlcWorksData[0];

      // ISWC (only if not already found from Quansic or MusicBrainz)
      if (mlcWork.iswc && !agg.iswc) {
        agg.iswc = normalizeISWC(mlcWork.iswc);
        agg.iswcSource = 'mlc';
      }

      // MLC work title (if available, use as alternate)
      // Note: MLC titles are often ALL CAPS, so we use them as fallback only
      if (mlcWork.title && !quansicWorkTitle && !musicbrainzWorkTitle) {
        // Convert from ALL CAPS to Title Case for better display
        const mlcTitle = mlcWork.title
          .split(' ')
          .map(word => word.charAt(0) + word.slice(1).toLowerCase())
          .join(' ');
        titleVariants.push(mlcTitle);
      }

      // Writers (if not already from Quansic)
      if (mlcWork.writers && !agg.composers) {
        const writers = typeof mlcWork.writers === 'string'
          ? JSON.parse(mlcWork.writers)
          : mlcWork.writers;

        if (Array.isArray(writers) && writers.length > 0) {
          const writerNames = writers
            .map((w: any) => w.name)
            .filter((n: string) => n && n !== 'Unknown')
            .join(', ');

          if (writerNames) {
            agg.composers = writerNames;
          }
        }
      }
    }

    // Get BMI Works data - JOIN via Spotify title match
    // Note: bmi_works.title is stored as proper Spotify title (not ALL CAPS) by backfill script
    const bmiWorksData = await query(`
      SELECT bw.*
      FROM spotify_tracks st
      JOIN bmi_works bw ON LOWER(TRIM(bw.title)) = LOWER(TRIM(st.title))
      WHERE st.spotify_track_id = $1
    `, [spotify_track_id]);

    if (bmiWorksData.length > 0) {
      const bmiWork = bmiWorksData[0];

      // ISWC (only if not already found from Quansic, MusicBrainz, or MLC)
      if (bmiWork.iswc && !agg.iswc) {
        agg.iswc = normalizeISWC(bmiWork.iswc);
        agg.iswcSource = 'bmi';
      }

      // NOTE: We don't use BMI title (stored as Spotify title in our backfill)
      // NOTE: We don't use BMI writers/publishers (proprietary, not blockchain-ready)
    }

    // CRITICAL: Determine proper WORK title (not recording title)
    // Priority: Quansic > MusicBrainz > Spotify cleaned > Genius
    // BMI title not used (we store Spotify title in bmi_works now)

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

  // Step 3: Insert into grc20_works (WORK-LEVEL DATA ONLY)
  // Recordings will be created by populate-grc20-recordings.ts
  // Use ISWC-based deduplication (preferred) or genius_song_id fallback
  for (const agg of aggregations) {
    // Check if work already exists (by ISWC or genius_song_id)
    let existingWork = null;

    if (agg.iswc) {
      const iswcCheck = await query(`
        SELECT id FROM grc20_works WHERE iswc = $1
      `, [agg.iswc]);
      existingWork = iswcCheck.length > 0 ? iswcCheck[0] : null;
    }

    if (!existingWork && agg.geniusSongId) {
      const geniusCheck = await query(`
        SELECT id FROM grc20_works WHERE genius_song_id = $1
      `, [agg.geniusSongId]);
      existingWork = geniusCheck.length > 0 ? geniusCheck[0] : null;
    }

    if (existingWork) {
      // Update existing work
      await query(`
        UPDATE grc20_works SET
          title = $1,
          alternate_titles = $2,
          iswc = $3,
          iswc_source = $4,
          mbid = $5,
          wikidata_id = $6,
          genius_song_id = $7,
          primary_artist_id = $8,
          primary_artist_name = $9,
          featured_artists = $10,
          composers = $11,
          producers = $12,
          lyricists = $13,
          language = $14,
          work_type = $15,
          genres = $16,
          musicbrainz_url = $17,
          updated_at = NOW()
        WHERE id = $18
      `, [
        agg.title, agg.alternateTitles,
        agg.iswc, agg.iswcSource, agg.mbid,
        agg.wikidataId,
        agg.geniusSongId,
        agg.primaryArtistId, agg.primaryArtistName,
        agg.featuredArtists, agg.composers, agg.producers, agg.lyricists,
        agg.language, agg.workType, agg.genres,
        agg.musicbrainzUrl,
        existingWork.id
      ]);
      console.log(`   ✅ Work updated: ${agg.title} (ID: ${existingWork.id})`);
    } else {
      // Insert new work
      await query(`
        INSERT INTO grc20_works (
          title, alternate_titles,
          iswc, iswc_source, mbid,
          wikidata_id,
          genius_song_id,
          primary_artist_id, primary_artist_name,
          featured_artists, composers, producers, lyricists,
          language, work_type, genres,
          musicbrainz_url
        ) VALUES (
          $1, $2,
          $3, $4, $5,
          $6,
          $7,
          $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16,
          $17
        )
      `, [
        agg.title, agg.alternateTitles,
        agg.iswc, agg.iswcSource, agg.mbid,
        agg.wikidataId,
        agg.geniusSongId,
        agg.primaryArtistId, agg.primaryArtistName,
        agg.featuredArtists, agg.composers, agg.producers, agg.lyricists,
        agg.language, agg.workType, agg.genres,
        agg.musicbrainzUrl
      ]);
      console.log(`   ✅ Work inserted: ${agg.title}`);
    }
  }

  console.log('\n📝 Next step: Run populate-grc20-recordings.ts to create recordings\n');

  // Step 4: Summary
  const summary = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(iswc) as with_iswc,
      COUNT(iswc) FILTER (WHERE iswc_source = 'quansic') as iswc_from_quansic,
      COUNT(iswc) FILTER (WHERE iswc_source = 'musicbrainz') as iswc_from_musicbrainz,
      COUNT(iswc) FILTER (WHERE iswc_source = 'mlc') as iswc_from_mlc,
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
  console.log(`     - From MLC: ${summary[0].iswc_from_mlc}`);
  console.log(`   With composers: ${summary[0].with_composers}`);
  console.log(`   With artist link: ${summary[0].with_artist_link} (${Math.round(summary[0].with_artist_link / summary[0].total * 100)}%)`);
  console.log(`   Already minted: ${summary[0].minted}`);
  console.log(`   Ready to mint: ${summary[0].ready_to_mint}`);

  console.log('\n✅ Done!\n');
}

main().catch(console.error);
