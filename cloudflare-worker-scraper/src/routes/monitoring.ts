/**
 * Monitoring Routes
 * Track enrichment cascade status and health
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import type { Env } from '../types';

const monitoring = new Hono<{ Bindings: Env }>();

/**
 * GET /cascade-status
 * View enrichment pipeline completion for a specific creator
 */
monitoring.get('/cascade-status', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const handle = c.req.query('handle');

  if (!handle) {
    return c.json({ error: 'handle parameter required' }, 400);
  }

  const result = await db.sql`
    WITH base_videos AS (
      SELECT video_id, spotify_track_id, tiktok_handle
      FROM tiktok_scraped_videos
      WHERE tiktok_handle = ${handle}
      AND spotify_track_id IS NOT NULL
    )
    SELECT
      'Spotify Tracks' as stage,
      1 as stage_order,
      COUNT(DISTINCT v.spotify_track_id) as total,
      COUNT(DISTINCT st.spotify_track_id) FILTER (WHERE st.title IS NOT NULL) as enriched,
      ROUND(100.0 * COUNT(DISTINCT st.spotify_track_id) FILTER (WHERE st.title IS NOT NULL) / NULLIF(COUNT(DISTINCT v.spotify_track_id), 0), 1) as pct
    FROM base_videos v
    LEFT JOIN spotify_tracks st ON v.spotify_track_id = st.spotify_track_id

    UNION ALL

    SELECT
      'Genius Songs' as stage,
      2 as stage_order,
      COUNT(DISTINCT st.spotify_track_id) as total,
      COUNT(DISTINCT gs.genius_song_id) as enriched,
      ROUND(100.0 * COUNT(DISTINCT gs.genius_song_id) / NULLIF(COUNT(DISTINCT st.spotify_track_id), 0), 1) as pct
    FROM base_videos v
    JOIN spotify_tracks st ON v.spotify_track_id = st.spotify_track_id
    LEFT JOIN genius_songs gs ON st.spotify_track_id = gs.spotify_track_id

    UNION ALL

    SELECT
      'MusicBrainz Recordings' as stage,
      3 as stage_order,
      COUNT(DISTINCT st.spotify_track_id) as total,
      COUNT(DISTINCT mbr.recording_mbid) as enriched,
      ROUND(100.0 * COUNT(DISTINCT mbr.recording_mbid) / NULLIF(COUNT(DISTINCT st.spotify_track_id), 0), 1) as pct
    FROM base_videos v
    JOIN spotify_tracks st ON v.spotify_track_id = st.spotify_track_id
    LEFT JOIN musicbrainz_recordings mbr ON st.spotify_track_id = mbr.spotify_track_id

    UNION ALL

    SELECT
      'MusicBrainz Works' as stage,
      4 as stage_order,
      COUNT(DISTINCT mbr.recording_mbid) as total,
      COUNT(DISTINCT wrl.work_mbid) as enriched,
      ROUND(100.0 * COUNT(DISTINCT wrl.work_mbid) / NULLIF(COUNT(DISTINCT mbr.recording_mbid), 0), 1) as pct
    FROM base_videos v
    JOIN spotify_tracks st ON v.spotify_track_id = st.spotify_track_id
    JOIN musicbrainz_recordings mbr ON st.spotify_track_id = mbr.spotify_track_id
    LEFT JOIN work_recording_links wrl ON mbr.recording_mbid = wrl.recording_mbid

    ORDER BY stage_order
  `;

  return c.json({
    handle,
    cascade: result.map(({ stage_order, ...rest }: any) => rest),
  });
});

/**
 * GET /enrichment-queue
 * Show what items are pending enrichment at each stage
 */
monitoring.get('/enrichment-queue', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  const unenrichedSpotifyTracks = await db.getUnenrichedSpotifyTracks(100);
  const unenrichedSpotifyArtists = await db.getUnenrichedSpotifyArtists(100);
  const unenrichedGeniusTracks = await db.getUnenrichedGeniusTracks(100);
  const unenrichedMBArtists = await db.getUnenrichedMusicBrainzArtists(100);
  const unenrichedMBRecordings = await db.getUnenrichedMusicBrainzRecordings(100);
  const unenrichedQuansic = await db.getUnenrichedQuansicArtists(100);

  return c.json({
    queue: {
      'spotify_tracks': {
        count: unenrichedSpotifyTracks.length,
        sample: unenrichedSpotifyTracks.slice(0, 3),
      },
      'spotify_artists': {
        count: unenrichedSpotifyArtists.length,
        sample: unenrichedSpotifyArtists.slice(0, 3),
      },
      'genius_songs': {
        count: unenrichedGeniusTracks.length,
        sample: unenrichedGeniusTracks.slice(0, 3).map(t => ({ title: t.title, artist: t.artist })),
      },
      'musicbrainz_artists': {
        count: unenrichedMBArtists.length,
        sample: unenrichedMBArtists.slice(0, 3).map(a => ({ name: a.name, spotify_id: a.spotify_artist_id })),
      },
      'musicbrainz_recordings': {
        count: unenrichedMBRecordings.length,
        sample: unenrichedMBRecordings.slice(0, 3).map(t => ({ title: t.title, isrc: t.isrc })),
      },
      'quansic_artists': {
        count: unenrichedQuansic.length,
        sample: unenrichedQuansic.slice(0, 3).map(a => ({ name: a.name, isnis: a.isnis })),
      },
    },
    summary: {
      total_pending: unenrichedSpotifyTracks.length + unenrichedSpotifyArtists.length +
                     unenrichedGeniusTracks.length + unenrichedMBArtists.length +
                     unenrichedMBRecordings.length + unenrichedQuansic.length,
    },
  });
});

export default monitoring;
