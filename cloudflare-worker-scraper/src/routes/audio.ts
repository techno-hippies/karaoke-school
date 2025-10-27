/**
 * Audio Download Workflow Routes
 * Orchestrates download → Grove storage → Neon DB for tracks with complete licensing
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import type { Env } from '../types';

const audio = new Hono<{ Bindings: Env }>();

/**
 * GET /audio/ready-for-download
 * Get tracks that are ready for audio download (have corroborated ISWC)
 */
audio.get('/audio/ready-for-download', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '20');

  // Get tracks with corroborated ISWC that don't have audio files yet
  // NEW: Decoupled from MLC - just needs has_iswc = true
  const result = await db.sql`
    SELECT
      st.spotify_track_id,
      st.title,
      st.artists,
      st.isrc,
      st.iswc_source
    FROM spotify_tracks st
    LEFT JOIN track_audio_files taf ON st.spotify_track_id = taf.spotify_track_id
    WHERE taf.spotify_track_id IS NULL  -- No audio file yet
      AND st.has_iswc = true  -- Has corroborated ISWC from 2+ sources
    ORDER BY st.spotify_track_id
    LIMIT ${limit}
  `;

  return c.json({
    count: result.length,
    tracks: result.map((track: any) => ({
      spotify_track_id: track.spotify_track_id,
      title: track.title,
      artists: track.artists,
      isrc: track.isrc,
      iswc_source: track.iswc_source,  // Object showing which sources found the ISWC
    }))
  });
});

/**
 * POST /audio/download-tracks
 * Trigger audio download for ready tracks via freyr-service
 */
audio.post('/audio/download-tracks', async (c) => {
  if (!c.env.FREYR_SERVICE_URL) {
    return c.json({ error: 'FREYR_SERVICE_URL not configured' }, 500);
  }

  if (!c.env.ACOUSTID_API_KEY) {
    return c.json({ error: 'ACOUSTID_API_KEY not configured' }, 500);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '5');

  // Get ready tracks (NEW: decoupled from MLC - just needs corroborated ISWC)
  const readyTracks = await db.sql`
    SELECT
      st.spotify_track_id,
      st.title,
      st.artists,
      st.isrc,
      st.iswc_source
    FROM spotify_tracks st
    LEFT JOIN track_audio_files taf ON st.spotify_track_id = taf.spotify_track_id
    WHERE taf.spotify_track_id IS NULL
      AND st.has_iswc = true  -- Has corroborated ISWC from 2+ sources
    ORDER BY st.spotify_track_id
    LIMIT ${limit}
  `;

  if (readyTracks.length === 0) {
    return c.json({ message: 'No tracks ready for audio download' });
  }

  console.log(`Downloading audio for ${readyTracks.length} tracks...`);

  const results = [];
  let downloaded = 0;

  for (const track of readyTracks) {
    try {
      // Artists is stored as string array: ["Ariana Grande"], not objects
      const artists = track.artists as string[];
      const primaryArtist = artists[0] || 'Unknown';

      console.log(`Downloading: ${track.title} - ${primaryArtist} (${track.spotify_track_id})`);

      // Call freyr-service /download-and-store endpoint
      const response = await fetch(`${c.env.FREYR_SERVICE_URL}/download-and-store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spotify_track_id: track.spotify_track_id,
          expected_title: track.title,
          expected_artist: primaryArtist,
          acoustid_api_key: c.env.ACOUSTID_API_KEY,
          neon_database_url: c.env.NEON_DATABASE_URL,
          chain_id: 37111, // Lens Network
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to download ${track.spotify_track_id}: ${errorData.message}`);
        results.push({
          spotify_track_id: track.spotify_track_id,
          title: track.title,
          status: 'failed',
          error: errorData.message || response.statusText,
        });
        continue;
      }

      const data = await response.json();
      downloaded++;

      results.push({
        spotify_track_id: track.spotify_track_id,
        title: track.title,
        status: 'success',
        grove_cid: data.grove_cid,
        grove_url: data.grove_url,
        download_method: data.download_method,
        verified: data.verification?.verified,
        confidence: data.verification?.confidence,
        file_size_mb: (data.file_size_bytes / 1024 / 1024).toFixed(2),
        duration_seconds: data.workflow_duration_seconds,
      });

      console.log(`✓ Downloaded and stored: ${track.title} (CID: ${data.grove_cid})`);

      // Rate limiting: wait 2 seconds between downloads to avoid overwhelming freyr-service
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error downloading ${track.spotify_track_id}:`, error);
      results.push({
        spotify_track_id: track.spotify_track_id,
        title: track.title,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.json({
    success: true,
    service: 'audio-download',
    downloaded,
    total: readyTracks.length,
    results,
  });
});

/**
 * GET /audio/status/:spotify_track_id
 * Get audio file status for a specific track
 */
audio.get('/audio/status/:spotify_track_id', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const spotifyTrackId = c.req.param('spotify_track_id');

  const result = await db.sql`
    SELECT
      taf.*,
      st.title,
      st.artists,
      st.isrc
    FROM track_audio_files taf
    JOIN spotify_tracks st ON taf.spotify_track_id = st.spotify_track_id
    WHERE taf.spotify_track_id = ${spotifyTrackId}
  `;

  if (result.length === 0) {
    return c.json({ error: 'Audio file not found for this track' }, 404);
  }

  const audioFile = result[0] as any;

  return c.json({
    spotify_track_id: audioFile.spotify_track_id,
    title: audioFile.title,
    artists: audioFile.artists,
    isrc: audioFile.isrc,
    grove_cid: audioFile.grove_cid,
    grove_url: audioFile.grove_url,
    download_method: audioFile.download_method,
    verified: audioFile.verified,
    verification_confidence: audioFile.verification_confidence,
    acoustid_score: audioFile.acoustid_score,
    file_size_bytes: audioFile.file_size_bytes,
    file_size_mb: (audioFile.file_size_bytes / 1024 / 1024).toFixed(2),
    duration_ms: audioFile.duration_ms,
    downloaded_at: audioFile.downloaded_at,
    updated_at: audioFile.updated_at,
  });
});

/**
 * GET /audio/stats
 * Get statistics about downloaded audio files
 */
audio.get('/audio/stats', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  const stats = await db.sql`
    SELECT
      COUNT(*) as total_files,
      COUNT(CASE WHEN verified = true THEN 1 END) as verified_count,
      COUNT(CASE WHEN download_method = 'freyr' THEN 1 END) as freyr_count,
      COUNT(CASE WHEN download_method = 'yt-dlp' THEN 1 END) as ytdlp_count,
      AVG(verification_confidence) as avg_confidence,
      SUM(file_size_bytes) as total_size_bytes,
      AVG(file_size_bytes) as avg_size_bytes
    FROM track_audio_files
  `;

  const readyToDownload = await db.sql`
    SELECT COUNT(*) as count
    FROM spotify_tracks st
    LEFT JOIN track_audio_files taf ON st.spotify_track_id = taf.spotify_track_id
    WHERE taf.spotify_track_id IS NULL
      AND st.has_iswc = true
  `;

  const statsData = stats[0] as any;
  const readyCount = readyToDownload[0] as any;

  return c.json({
    downloaded: {
      total_files: parseInt(statsData.total_files),
      verified_count: parseInt(statsData.verified_count),
      by_method: {
        freyr: parseInt(statsData.freyr_count),
        ytdlp: parseInt(statsData.ytdlp_count),
      },
      avg_confidence: parseFloat((statsData.avg_confidence || 0).toFixed(3)),
      total_size_mb: (statsData.total_size_bytes / 1024 / 1024).toFixed(2),
      avg_size_mb: (statsData.avg_size_bytes / 1024 / 1024).toFixed(2),
    },
    ready_to_download: parseInt(readyCount.count),
  });
});

export default audio;
