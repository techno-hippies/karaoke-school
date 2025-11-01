/**
 * Populate grc20_work_recordings with streaming platform data
 *
 * **RECORDING-LEVEL DATA ONLY**
 *
 * Prerequisites:
 * - grc20_works must be populated first (creates work entities)
 * - This script creates ONE recording per work and populates streaming data
 *
 * Data sources:
 * 1. spotify_tracks -> title, URL, release date, duration
 * 2. quansic_recordings.platform_ids -> Apple Music, other platform IDs
 * 3. musicbrainz_recordings -> first release date, video flag
 * 4. derivative_images -> Grove image URLs
 *
 * Strategy:
 * - Creates one recording per work (1:1 relationship)
 * - Idempotent: Uses ON CONFLICT to update existing recordings
 * - Populates all available streaming data in single pass
 * - Platform URL construction from IDs where possible
 */

import { query } from '../../src/db/neon';
import { validateDependencies } from '../../src/db/transaction';

interface RecordingData {
  workId: number;
  spotifyTrackId: string;

  // Recording metadata
  title?: string;

  // Spotify
  spotifyUrl?: string;
  spotifyReleaseDate?: string;
  spotifyDurationMs?: number;

  // Apple Music
  appleMusicUrl?: string;

  // MusicBrainz
  musicbrainzFirstReleaseDate?: string;
  musicbrainzIsVideo?: boolean;

  // Grove
  groveImageUrl?: string;
  groveThumbnailUrl?: string;

  // TODO: Other platforms (Deezer, Tidal, etc.) need API integration
}

async function main() {
  console.log('🎵 Populating grc20_work_recordings...\n');

  // Validate dependencies
  await validateDependencies({ works: true });

  // Step 1: Get all processed tracks (same source as populate-grc20-works.ts)
  console.log('📊 Finding processed tracks...');
  const processedTracks = await query(`
    SELECT DISTINCT
      ks.spotify_track_id,
      st.title as spotify_title,
      st.artists->0->>'name' as artist_name
    FROM karaoke_segments ks
    JOIN spotify_tracks st ON st.spotify_track_id = ks.spotify_track_id
    WHERE ks.fal_enhanced_grove_cid IS NOT NULL
    ORDER BY st.title
  `);

  console.log(`   Found ${processedTracks.length} processed tracks\n`);

  let recordingsCreated = 0;
  let recordingsUpdated = 0;
  let recordingsSkipped = 0;

  // Step 2: Process each track and create/update recording
  for (const { spotify_track_id, spotify_title, artist_name } of processedTracks) {
    console.log(`🔍 Processing: ${spotify_title} - ${artist_name}`);

    // Find corresponding work (works are created by populate-grc20-works.ts)
    // Try multiple linking strategies:
    // 1. genius_song_id (if available)
    // 2. Title matching (cleaned - remove "Remaster", features, etc.)

    // First, get and clean the Spotify title
    const spotifyData = await query(`
      SELECT
        title,
        release_date,
        duration_ms,
        TRIM(REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                title,
                ' - \\d{4} Remaster(ed)?$', '', 'i'
              ),
              ' - Remaster(ed)?( \\d{4})?$', '', 'i'
            ),
            ' \\(feat\\. [^)]+\\)$', '', 'i'
          ),
          ' \\(with [^)]+\\)$', '', 'i'
        )) AS cleaned_title
      FROM spotify_tracks
      WHERE spotify_track_id = $1
    `, [spotify_track_id]);

    if (spotifyData.length === 0) {
      console.log(`  ⚠️  Spotify track not found: ${spotify_track_id}, skipping`);
      recordingsSkipped++;
      continue;
    }

    const cleanedTitle = spotifyData[0].cleaned_title;

    // Now find the work using genius_song_id or cleaned title (case-insensitive)
    const workData = await query(`
      SELECT DISTINCT gw.id as work_id, gw.title, gw.genius_song_id
      FROM grc20_works gw
      LEFT JOIN genius_songs gs ON gw.genius_song_id = gs.genius_song_id
      WHERE
        -- Match by genius_song_id (if available)
        (gs.spotify_track_id = $1 AND gw.genius_song_id IS NOT NULL)
        OR
        -- Match by cleaned title (case-insensitive)
        (LOWER(gw.title) = LOWER($2))
      LIMIT 1
    `, [spotify_track_id, cleanedTitle]);

    if (workData.length === 0) {
      console.log(`  ⚠️  No work found for ${spotify_track_id}, skipping`);
      recordingsSkipped++;
      continue;
    }

    const workId = workData[0].work_id;

    // Gather all recording data
    const recordingData: RecordingData = {
      workId,
      spotifyTrackId: spotify_track_id
    };

    // Use Spotify data we already fetched
    const spotify = spotifyData[0];
    recordingData.title = spotify.title;  // Recording title (may have "Remaster", features, etc.)
    recordingData.spotifyUrl = `https://open.spotify.com/track/${spotify_track_id}`;
    recordingData.spotifyReleaseDate = spotify.release_date;
    recordingData.spotifyDurationMs = spotify.duration_ms;

    // Get Quansic data (Apple Music, other platforms)
    const quansicData = await query(`
      SELECT * FROM quansic_recordings WHERE spotify_track_id = $1
    `, [spotify_track_id]);

    if (quansicData.length > 0) {
      const quansic = quansicData[0];

      if (quansic.platform_ids && typeof quansic.platform_ids === 'object') {
        const platformIds = quansic.platform_ids;

        // Apple Music
        if (platformIds.apple) {
          recordingData.appleMusicUrl = `https://music.apple.com/us/album/${platformIds.apple}`;
        }

        // TODO: Deezer, Tidal, Qobuz, etc. - need API integration
        // These platforms require ISRC-based lookups via their APIs
      }
    }

    // Get MusicBrainz recording data
    const mbData = await query(`
      SELECT mbr.*
      FROM spotify_tracks st
      JOIN musicbrainz_recordings mbr ON mbr.isrc = st.isrc
      WHERE st.spotify_track_id = $1 AND st.isrc IS NOT NULL
    `, [spotify_track_id]);

    if (mbData.length > 0) {
      const mb = mbData[0];
      recordingData.musicbrainzFirstReleaseDate = mb.first_release_date;
      recordingData.musicbrainzIsVideo = mb.video;
    }

    // Get derivative images
    const imageData = await query(`
      SELECT grove_url, thumbnail_grove_url
      FROM derivative_images
      WHERE spotify_track_id = $1 AND asset_type = 'track'
    `, [spotify_track_id]);

    if (imageData.length > 0) {
      const image = imageData[0];
      recordingData.groveImageUrl = image.grove_url;
      recordingData.groveThumbnailUrl = image.thumbnail_grove_url;
    }

    // Step 3: Insert or update recording (idempotent)
    const result = await query(`
      INSERT INTO grc20_work_recordings (
        work_id,
        spotify_track_id,
        title,
        spotify_url,
        spotify_release_date,
        spotify_duration_ms,
        apple_music_url,
        musicbrainz_first_release_date,
        musicbrainz_is_video,
        grove_image_url,
        grove_thumbnail_url
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      ON CONFLICT (work_id) DO UPDATE SET
        spotify_track_id = EXCLUDED.spotify_track_id,
        title = EXCLUDED.title,
        spotify_url = EXCLUDED.spotify_url,
        spotify_release_date = EXCLUDED.spotify_release_date,
        spotify_duration_ms = EXCLUDED.spotify_duration_ms,
        apple_music_url = EXCLUDED.apple_music_url,
        musicbrainz_first_release_date = EXCLUDED.musicbrainz_first_release_date,
        musicbrainz_is_video = EXCLUDED.musicbrainz_is_video,
        grove_image_url = EXCLUDED.grove_image_url,
        grove_thumbnail_url = EXCLUDED.grove_thumbnail_url,
        updated_at = NOW()
      RETURNING (xmax = 0) as inserted
    `, [
      recordingData.workId,
      recordingData.spotifyTrackId,
      recordingData.title,
      recordingData.spotifyUrl,
      recordingData.spotifyReleaseDate,
      recordingData.spotifyDurationMs,
      recordingData.appleMusicUrl,
      recordingData.musicbrainzFirstReleaseDate,
      recordingData.musicbrainzIsVideo,
      recordingData.groveImageUrl,
      recordingData.groveThumbnailUrl
    ]);

    if (result[0].inserted) {
      recordingsCreated++;
      console.log(`  ✅ Created recording for work ${workId}`);
    } else {
      recordingsUpdated++;
      console.log(`  ✅ Updated recording for work ${workId}`);
    }
  }

  console.log('\n✅ Population complete!\n');
  console.log('Summary:');
  console.log(`  - Recordings created: ${recordingsCreated}`);
  console.log(`  - Recordings updated: ${recordingsUpdated}`);
  console.log(`  - Tracks skipped (no work found): ${recordingsSkipped}`);
  console.log('\n📝 TODO: Other platforms require API integration:');
  console.log('  - Deezer: Need track lookup by ISRC or artist search');
  console.log('  - Tidal: Need track lookup by ISRC');
  console.log('  - Qobuz: Need track lookup by ISRC');
  console.log('  - SoundCloud: Need track search by title/artist');
  console.log('  - YouTube Music: Need track search');
  console.log('  - Melon: Need track search (Korean platform)');
  console.log('  - Amazon Music: Need track lookup');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
