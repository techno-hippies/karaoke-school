/**
 * Drop recording-level columns from grc20_works
 * These have been migrated to grc20_work_recordings table
 */

import { query } from '../../src/db/neon';

async function main() {
  console.log('Dropping recording-level columns from grc20_works...\n');

  const columnsToDrop = [
    // Spotify recording data
    'spotify_track_id', 'spotify_url', 'spotify_popularity', 'spotify_play_count',
    // Streaming platform URLs
    'apple_music_url', 'deezer_url', 'tidal_url', 'amazon_music_url', 'youtube_music_url',
    'beatport_url', 'itunes_url', 'qobuz_url',
    // Discogs recording
    'discogs_release_id', 'discogs_url',
    // Recording metadata
    'release_date', 'duration_ms', 'explicit_content',
    // Album art
    'image_url', 'image_source',
    // Genius engagement metrics (not work-level)
    'genius_pageviews', 'genius_annotation_count', 'genius_pyongs_count', 'genius_featured_video',
    // Recording code
    'isrc',
    // Other platform URLs
    'maniadb_url', 'melon_url', 'mora_url', 'musixmatch_url', 'lrclib_url', 'lyrics_ovh_url',
    'youtube_url', 'imvdb_url', 'rateyourmusic_url', 'jaxsta_url', 'setlistfm_url'
  ];

  const dropSQL = `ALTER TABLE grc20_works DROP COLUMN ${columnsToDrop.join(', DROP COLUMN ')};`;

  try {
    await query(dropSQL);
    console.log(`✅ Dropped ${columnsToDrop.length} recording-level columns`);
    console.log('✅ grc20_works is now a pure WORK entity');
    console.log('✅ Recording data is in grc20_work_recordings');
  } catch (err) {
    console.error('❌ Error dropping columns:', err);
    process.exit(1);
  }
}

main();
