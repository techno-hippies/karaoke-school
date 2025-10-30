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

    UNION ALL

    SELECT
      'Lyrics (LRCLIB)' as stage,
      5 as stage_order,
      COUNT(DISTINCT st.spotify_track_id) as total,
      COUNT(DISTINCT stl.spotify_track_id) as enriched,
      ROUND(100.0 * COUNT(DISTINCT stl.spotify_track_id) / NULLIF(COUNT(DISTINCT st.spotify_track_id), 0), 1) as pct
    FROM base_videos v
    JOIN spotify_tracks st ON v.spotify_track_id = st.spotify_track_id
    LEFT JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
    WHERE st.has_iswc = true

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

  const unenrichedLyrics = await db.sql`
    SELECT st.spotify_track_id, st.title, st.artists[1] as artist
    FROM spotify_tracks st
    LEFT JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
    WHERE st.has_iswc = true
      AND st.duration_ms IS NOT NULL
      AND stl.spotify_track_id IS NULL
    LIMIT 100
  `;

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
      'lyrics': {
        count: unenrichedLyrics.length,
        sample: unenrichedLyrics.slice(0, 3).map((t: any) => ({ title: t.title, artist: t.artist })),
      },
    },
    summary: {
      total_pending: unenrichedSpotifyTracks.length + unenrichedSpotifyArtists.length +
                     unenrichedGeniusTracks.length + unenrichedMBArtists.length +
                     unenrichedMBRecordings.length + unenrichedQuansic.length +
                     unenrichedLyrics.length,
    },
  });
});

/**
 * GET /worker-status
 * Show recent enrichment activity to verify workers are running
 */
monitoring.get('/worker-status', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  // Get TikTok → Karaoke pipeline breakdown
  const pipelineStats = await db.sql`
    SELECT
      COUNT(DISTINCT tsv.video_id) as total_copyrighted_videos,
      COUNT(DISTINCT CASE WHEN st.has_iswc = true THEN tsv.video_id END) as videos_with_iswc,
      COUNT(DISTINCT CASE WHEN stl.spotify_track_id IS NOT NULL THEN tsv.video_id END) as videos_with_lyrics,
      COUNT(DISTINCT CASE WHEN taf.spotify_track_id IS NOT NULL THEN tsv.video_id END) as videos_with_audio,
      COUNT(DISTINCT CASE WHEN ks.spotify_track_id IS NOT NULL THEN tsv.video_id END) as videos_with_segments,
      COUNT(DISTINCT CASE WHEN tsa.spotify_track_id IS NOT NULL AND tsa.separation_status = 'completed' THEN tsv.video_id END) as videos_with_demucs,
      COUNT(DISTINCT CASE WHEN ks.fal_segment_grove_cid IS NOT NULL THEN tsv.video_id END) as videos_with_cropped_segment
    FROM tiktok_scraped_videos tsv
    LEFT JOIN spotify_tracks st ON tsv.spotify_track_id = st.spotify_track_id
    LEFT JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
    LEFT JOIN track_audio_files taf ON st.spotify_track_id = taf.spotify_track_id
    LEFT JOIN karaoke_segments ks ON st.spotify_track_id = ks.spotify_track_id
    LEFT JOIN track_separated_audio tsa ON st.spotify_track_id = tsa.spotify_track_id
    WHERE tsv.copyright_status = 'copyrighted'
  `;

  // Get bottleneck details
  const bottlenecks = await db.sql`
    SELECT
      COUNT(*) FILTER (WHERE st.has_iswc = true AND stl.spotify_track_id IS NULL) as lyrics_needed,
      COUNT(*) FILTER (WHERE stl.spotify_track_id IS NOT NULL AND taf.spotify_track_id IS NULL) as audio_needed,
      COUNT(*) FILTER (WHERE taf.spotify_track_id IS NOT NULL AND tsa.spotify_track_id IS NULL) as demucs_needed,
      COUNT(*) FILTER (WHERE tsa.separation_status = 'completed' AND tsa.instrumental_grove_cid IS NOT NULL AND ks.fal_segment_start_ms IS NOT NULL AND ks.fal_segment_grove_cid IS NULL) as crop_needed
    FROM spotify_tracks st
    LEFT JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
    LEFT JOIN track_audio_files taf ON st.spotify_track_id = taf.spotify_track_id
    LEFT JOIN karaoke_segments ks ON st.spotify_track_id = ks.spotify_track_id
    LEFT JOIN track_separated_audio tsa ON st.spotify_track_id = tsa.spotify_track_id
    WHERE st.spotify_track_id IN (
      SELECT spotify_track_id FROM tiktok_scraped_videos WHERE copyright_status = 'copyrighted'
    )
  `;

  // Get recent enrichment activity by checking fetched_at timestamps
  const recentActivity = await db.sql`
    WITH recent_enrichments AS (
      SELECT
        'spotify_tracks' as stage,
        COUNT(*) as count,
        MAX(fetched_at) as last_enriched
      FROM spotify_tracks
      WHERE fetched_at > NOW() - INTERVAL '1 hour'

      UNION ALL

      SELECT
        'genius_songs' as stage,
        COUNT(*) as count,
        MAX(fetched_at) as last_enriched
      FROM genius_songs
      WHERE fetched_at > NOW() - INTERVAL '1 hour'

      UNION ALL

      SELECT
        'musicbrainz_artists' as stage,
        COUNT(*) as count,
        MAX(fetched_at) as last_enriched
      FROM musicbrainz_artists
      WHERE fetched_at > NOW() - INTERVAL '1 hour'

      UNION ALL

      SELECT
        'musicbrainz_recordings' as stage,
        COUNT(*) as count,
        MAX(fetched_at) as last_enriched
      FROM musicbrainz_recordings
      WHERE fetched_at > NOW() - INTERVAL '1 hour'

      UNION ALL

      SELECT
        'quansic_artists' as stage,
        COUNT(*) as count,
        MAX(fetched_at) as last_enriched
      FROM quansic_artists
      WHERE fetched_at > NOW() - INTERVAL '1 hour'
    )
    SELECT * FROM recent_enrichments
    WHERE count > 0
    ORDER BY last_enriched DESC
  `;

  // Get ISWC lookup activity (tracks with has_iswc set recently)
  const iswcActivity = await db.sql`
    SELECT
      COUNT(*) FILTER (WHERE has_iswc = true) as found_iswc,
      COUNT(*) FILTER (WHERE has_iswc = false) as no_iswc,
      MAX(updated_at) as last_checked
    FROM spotify_tracks
    WHERE has_iswc IS NOT NULL
      AND updated_at > NOW() - INTERVAL '1 hour'
  `;

  // Get overall last activity across all tables
  const lastActivity = await db.sql`
    SELECT MAX(last_enriched) as last_worker_activity
    FROM (
      SELECT MAX(fetched_at) as last_enriched FROM spotify_tracks
      UNION ALL
      SELECT MAX(fetched_at) FROM genius_songs
      UNION ALL
      SELECT MAX(fetched_at) FROM musicbrainz_artists
      UNION ALL
      SELECT MAX(fetched_at) FROM musicbrainz_recordings
      UNION ALL
      SELECT MAX(fetched_at) FROM quansic_artists
    ) t
  `;

  const lastWorkerActivity = lastActivity[0]?.last_worker_activity;
  const timeSinceLastActivity = lastWorkerActivity
    ? Math.round((Date.now() - new Date(lastWorkerActivity).getTime()) / 1000)
    : null;

  const pipeline = pipelineStats[0];
  const bottleneck = bottlenecks[0];

  return c.json({
    status: timeSinceLastActivity !== null && timeSinceLastActivity < 300 ? 'active' : 'idle',
    last_activity: lastWorkerActivity,
    seconds_since_activity: timeSinceLastActivity,

    // TikTok → Karaoke Pipeline
    tiktok_karaoke_pipeline: {
      '1_scraped_videos': {
        count: parseInt(pipeline.total_copyrighted_videos),
        description: 'TikTok videos scraped with copyrighted music',
      },
      '2_iswc_discovered': {
        count: parseInt(pipeline.videos_with_iswc),
        percent: Math.round((parseInt(pipeline.videos_with_iswc) / parseInt(pipeline.total_copyrighted_videos)) * 100),
        description: 'Videos with ISWC found (BMI/CISAC/MusicBrainz/Quansic/MLC)',
        cron: 'Every 3 minutes',
      },
      '3_lyrics_enriched': {
        count: parseInt(pipeline.videos_with_lyrics),
        percent: Math.round((parseInt(pipeline.videos_with_lyrics) / parseInt(pipeline.videos_with_iswc)) * 100),
        description: 'Videos with synced lyrics (LRCLIB + Lyrics.ovh)',
        cron: 'Every 15 minutes',
      },
      '4_audio_downloaded': {
        count: parseInt(pipeline.videos_with_audio),
        percent: Math.round((parseInt(pipeline.videos_with_audio) / parseInt(pipeline.videos_with_lyrics)) * 100),
        description: 'Full audio downloaded (Freyr + Grove + AcoustID verification)',
        cron: 'Every 25 minutes',
        bottleneck: parseInt(bottleneck.audio_needed) > 0 ? `⚠️ ${bottleneck.audio_needed} tracks waiting for download` : null,
      },
      '5_segments_selected': {
        count: parseInt(pipeline.videos_with_segments),
        percent: Math.round((parseInt(pipeline.videos_with_segments) / parseInt(pipeline.videos_with_lyrics)) * 100),
        description: 'Best 190s segment selected (Gemini Flash 2.5 Lite)',
        cron: 'Every 45 minutes',
      },
      '6_demucs_separated': {
        count: parseInt(pipeline.videos_with_demucs),
        percent: Math.round((parseInt(pipeline.videos_with_demucs) / parseInt(pipeline.videos_with_audio)) * 100),
        description: 'Vocal/instrumental separation complete (Demucs MDX)',
        cron: 'Every 35 minutes',
        bottleneck: parseInt(bottleneck.demucs_needed) > 0 ? `⚠️ ${bottleneck.demucs_needed} tracks waiting for Demucs` : null,
      },
      '7_segments_cropped': {
        count: parseInt(pipeline.videos_with_cropped_segment),
        percent: Math.round((parseInt(pipeline.videos_with_cropped_segment) / parseInt(pipeline.videos_with_demucs)) * 100),
        description: 'Instrumental 190s segments cropped (FFmpeg on Akash)',
        cron: 'Every 50 minutes',
        bottleneck: parseInt(bottleneck.crop_needed) > 0 ? `⚠️ ${bottleneck.crop_needed} tracks ready for cropping` : null,
      },
      '8_fal_ai_processing': {
        count: 0,
        percent: 0,
        description: '190s audio-to-audio enhancement for karaoke (fal.ai)',
        status: 'Not yet implemented',
      },
    },

    recent_hour: {
      enrichments_by_stage: recentActivity,
      iswc_lookups: iswcActivity[0] || { found_iswc: 0, no_iswc: 0, last_checked: null },
    },
    health: {
      is_working: timeSinceLastActivity !== null && timeSinceLastActivity < 600,
      message: timeSinceLastActivity === null
        ? 'No enrichment activity detected'
        : timeSinceLastActivity < 300
        ? 'Worker recently active'
        : timeSinceLastActivity < 600
        ? 'Worker idle but healthy'
        : 'Worker may be stuck - no activity in 10+ minutes',
    },
  });
});

export default monitoring;
