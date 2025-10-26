/**
 * Karaoke Production Routes
 *
 * Orchestrate the full karaoke production pipeline:
 * 1. Download track from Spotify (via freyr service)
 * 2. Select iconic 190s segment (if track > 190s)
 * 3. Separate vocals (demucs-modal)
 * 4. Enhance instrumental (fal-audio)
 * 5. Get synced lyrics (LRCLib)
 * 6. Align lyrics with audio (ElevenLabs)
 * 7. Upload to Grove (immutable storage)
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { DemucsService, type DemucsWebhookPayload } from '../demucs';
import { GroveService } from '../grove';
import type { Env } from '../types';

const karaoke = new Hono<{ Bindings: Env }>();

/**
 * POST /karaoke/create
 * Start a karaoke production for a Spotify track
 */
karaoke.post('/karaoke/create', async (c) => {
  const { spotify_track_id } = await c.req.json();

  if (!spotify_track_id) {
    return c.json({ error: 'spotify_track_id required' }, 400);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  // 1. Check if track exists in database
  const trackResult = await db.sql`
    SELECT spotify_track_id, title, artist, duration_ms
    FROM spotify_tracks
    WHERE spotify_track_id = ${spotify_track_id}
  `;

  if (trackResult.length === 0) {
    return c.json({ error: 'Track not found in database. Enrich it first via /enrich' }, 404);
  }

  const track = trackResult[0];

  // 2. Check if karaoke production already exists
  const existingProduction = await db.sql`
    SELECT production_id, processing_status
    FROM karaoke_productions
    WHERE spotify_track_id = ${spotify_track_id}
  `;

  if (existingProduction.length > 0) {
    return c.json({
      message: 'Karaoke production already exists',
      production: existingProduction[0],
    });
  }

  // 3. Create initial karaoke_downloads record
  await db.sql`
    INSERT INTO karaoke_downloads (spotify_track_id, download_status)
    VALUES (${spotify_track_id}, 'pending')
    ON CONFLICT (spotify_track_id) DO NOTHING
  `;

  // 4. Create initial karaoke_productions record
  await db.sql`
    INSERT INTO karaoke_productions (spotify_track_id, processing_status)
    VALUES (${spotify_track_id}, 'queued')
    RETURNING production_id
  `;

  return c.json({
    success: true,
    spotify_track_id,
    track: {
      title: track.title,
      artist: track.artist,
      duration_ms: track.duration_ms,
    },
    message: 'Karaoke production queued. Use worker or manual steps to process.',
    next_steps: [
      'POST /karaoke/download - Download track with freyr',
      'POST /karaoke/select-segment - Select best 190s segment',
      'POST /karaoke/separate - Separate vocals with demucs',
      'POST /karaoke/enhance - Enhance instrumental with fal.ai',
      'POST /karaoke/lyrics - Get synced lyrics from LRCLib',
      'POST /karaoke/align - Align lyrics with ElevenLabs',
    ],
  });
});

/**
 * POST /karaoke/download
 * Download track audio from Spotify via freyr service
 */
karaoke.post('/karaoke/download', async (c) => {
  const { spotify_track_id } = await c.req.json();

  if (!spotify_track_id) {
    return c.json({ error: 'spotify_track_id required' }, 400);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const FREYR_SERVICE_URL = c.env.FREYR_SERVICE_URL; // e.g., https://freyr-download-service.onrender.com

  if (!FREYR_SERVICE_URL) {
    return c.json({ error: 'FREYR_SERVICE_URL not configured' }, 500);
  }

  // Call freyr service
  const downloadResponse = await fetch(`${FREYR_SERVICE_URL}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spotify_track_id }),
  });

  if (!downloadResponse.ok) {
    const error = await downloadResponse.json();
    return c.json({
      error: 'freyr download failed',
      details: error,
    }, 500);
  }

  const downloadResult = await downloadResponse.json();

  // Update database
  await db.sql`
    UPDATE karaoke_downloads
    SET download_status = 'completed',
        file_size_bytes = ${downloadResult.file_size},
        freyr_output_path = ${`${spotify_track_id}.m4a`},
        download_completed_at = NOW()
    WHERE spotify_track_id = ${spotify_track_id}
  `;

  return c.json({
    success: true,
    spotify_track_id,
    cached: downloadResult.cached,
    file_size: downloadResult.file_size,
    format: downloadResult.format,
    download_time_seconds: downloadResult.download_time_seconds,
    message: 'Track downloaded successfully. Next: select segment.',
  });
});

/**
 * POST /karaoke/select-segment
 * Select best 190s segment for karaoke (or use full track if ≤190s)
 *
 * This endpoint should be called from a system with access to the karaoke-segment-selector service
 * (e.g., master-pipeline). For now, it returns guidance on how to select segments.
 */
karaoke.post('/karaoke/select-segment', async (c) => {
  const { spotify_track_id, start_ms, end_ms, reason } = await c.req.json();

  if (!spotify_track_id || start_ms === undefined || end_ms === undefined) {
    return c.json({
      error: 'spotify_track_id, start_ms, and end_ms required',
      note: 'Use KaraokeSegmentSelectorService from master-pipeline to generate these values',
    }, 400);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  // Get track duration
  const trackResult = await db.sql`
    SELECT duration_ms FROM spotify_tracks
    WHERE spotify_track_id = ${spotify_track_id}
  `;

  if (trackResult.length === 0) {
    return c.json({ error: 'Track not found' }, 404);
  }

  const { duration_ms } = trackResult[0];
  const segment_duration_ms = end_ms - start_ms;

  // Upsert segment selection
  await db.sql`
    INSERT INTO karaoke_segments (
      spotify_track_id,
      full_duration_ms,
      segment_start_ms,
      segment_end_ms,
      segment_duration_ms,
      selection_reason
    ) VALUES (
      ${spotify_track_id},
      ${duration_ms},
      ${start_ms},
      ${end_ms},
      ${segment_duration_ms},
      ${reason || 'manual_selection'}
    )
    ON CONFLICT (spotify_track_id)
    DO UPDATE SET
      segment_start_ms = EXCLUDED.segment_start_ms,
      segment_end_ms = EXCLUDED.segment_end_ms,
      segment_duration_ms = EXCLUDED.segment_duration_ms,
      selection_reason = EXCLUDED.selection_reason,
      created_at = NOW()
  `;

  return c.json({
    success: true,
    spotify_track_id,
    segment: {
      start_ms,
      end_ms,
      duration_ms: segment_duration_ms,
      is_full_track: start_ms === 0 && end_ms === duration_ms,
    },
    reason,
    message: 'Segment selected. Next: extract segment from audio.',
  });
});

/**
 * POST /karaoke/extract-segment
 * Extract the selected segment from downloaded audio
 */
karaoke.post('/karaoke/extract-segment', async (c) => {
  const { spotify_track_id } = await c.req.json();

  if (!spotify_track_id) {
    return c.json({ error: 'spotify_track_id required' }, 400);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const FREYR_SERVICE_URL = c.env.FREYR_SERVICE_URL;

  if (!FREYR_SERVICE_URL) {
    return c.json({ error: 'FREYR_SERVICE_URL not configured' }, 500);
  }

  // Get segment details
  const segmentResult = await db.sql`
    SELECT segment_start_ms, segment_end_ms
    FROM karaoke_segments
    WHERE spotify_track_id = ${spotify_track_id}
  `;

  if (segmentResult.length === 0) {
    return c.json({ error: 'Segment not selected yet. Call /karaoke/select-segment first.' }, 404);
  }

  const { segment_start_ms, segment_end_ms } = segmentResult[0];

  // Call freyr /segment endpoint
  const segmentResponse = await fetch(`${FREYR_SERVICE_URL}/segment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spotify_track_id,
      start_ms: segment_start_ms,
      end_ms: segment_end_ms,
    }),
  });

  if (!segmentResponse.ok) {
    const error = await segmentResponse.json();
    return c.json({
      error: 'Segment extraction failed',
      details: error,
    }, 500);
  }

  const segmentData = await segmentResponse.json();

  return c.json({
    success: true,
    spotify_track_id,
    segment_size: segmentData.segment_size,
    duration_ms: segmentData.duration_ms,
    message: 'Segment extracted. Next: separate vocals with demucs.',
  });
});

/**
 * GET /karaoke/lyrics
 * Fetch synced lyrics from LRCLib
 */
karaoke.get('/karaoke/lyrics', async (c) => {
  const spotify_track_id = c.req.query('spotify_track_id');

  if (!spotify_track_id) {
    return c.json({ error: 'spotify_track_id query parameter required' }, 400);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  // Check if we already have cached lyrics
  const cachedLyrics = await db.sql`
    SELECT lrclib_id, synced_lyrics, plain_lyrics
    FROM lrclib_lyrics
    WHERE spotify_track_id = ${spotify_track_id}
  `;

  if (cachedLyrics.length > 0) {
    return c.json({
      cached: true,
      lyrics: cachedLyrics[0],
    });
  }

  // Get track info
  const trackResult = await db.sql`
    SELECT title, artist, duration_ms
    FROM spotify_tracks
    WHERE spotify_track_id = ${spotify_track_id}
  `;

  if (trackResult.length === 0) {
    return c.json({ error: 'Track not found' }, 404);
  }

  const { title, artist, duration_ms } = trackResult[0];
  const duration_seconds = Math.round(duration_ms / 1000);

  // Call LRCLib API
  const lrcLibUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}&duration=${duration_seconds}`;

  const lrcLibResponse = await fetch(lrcLibUrl);

  if (!lrcLibResponse.ok) {
    return c.json({
      error: 'LRCLib API error',
      status: lrcLibResponse.status,
    }, 500);
  }

  const lrcLibResults = await lrcLibResponse.json();

  if (lrcLibResults.length === 0) {
    return c.json({
      found: false,
      message: 'No lyrics found in LRCLib',
    });
  }

  // Take first result
  const lyrics = lrcLibResults[0];

  // Cache in database
  await db.sql`
    INSERT INTO lrclib_lyrics (lrclib_id, spotify_track_id, synced_lyrics, plain_lyrics)
    VALUES (${lyrics.id}, ${spotify_track_id}, ${lyrics.syncedLyrics}, ${lyrics.plainLyrics})
    ON CONFLICT (lrclib_id) DO UPDATE
    SET synced_lyrics = EXCLUDED.synced_lyrics,
        plain_lyrics = EXCLUDED.plain_lyrics,
        fetched_at = NOW()
  `;

  return c.json({
    found: true,
    cached: false,
    lyrics: {
      lrclib_id: lyrics.id,
      synced_lyrics: lyrics.syncedLyrics,
      plain_lyrics: lyrics.plainLyrics,
    },
  });
});

/**
 * POST /karaoke/separate
 * Submit Demucs separation job (async via Modal + webhook)
 */
karaoke.post('/karaoke/separate', async (c) => {
  const { spotify_track_id } = await c.req.json();

  if (!spotify_track_id) {
    return c.json({ error: 'spotify_track_id required' }, 400);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const MODAL_DEMUCS_ENDPOINT = c.env.MODAL_DEMUCS_ENDPOINT;
  const WORKER_URL = c.env.WORKER_URL;

  if (!MODAL_DEMUCS_ENDPOINT) {
    return c.json({ error: 'MODAL_DEMUCS_ENDPOINT not configured' }, 500);
  }

  if (!WORKER_URL) {
    return c.json({ error: 'WORKER_URL not configured' }, 500);
  }

  // Get audio URL from database
  const audioResult = await db.sql`
    SELECT taf.grove_url, st.title, st.artists
    FROM track_audio_files taf
    INNER JOIN spotify_tracks st ON taf.spotify_track_id = st.spotify_track_id
    WHERE taf.spotify_track_id = ${spotify_track_id}
  `;

  if (audioResult.length === 0) {
    return c.json({ error: 'Audio file not found. Download track first via /audio/download-tracks' }, 404);
  }

  const { grove_url, title, artists } = audioResult[0];

  // Submit job to Modal
  const jobId = crypto.randomUUID();
  const demucs = new DemucsService(MODAL_DEMUCS_ENDPOINT);

  const result = await demucs.separateAsync(
    grove_url,
    `${WORKER_URL}/webhooks/demucs-complete`,
    jobId
  );

  // Update database
  await db.sql`
    INSERT INTO karaoke_productions (
      spotify_track_id,
      modal_job_id,
      processing_status
    )
    VALUES (${spotify_track_id}, ${jobId}, 'separating')
    ON CONFLICT (spotify_track_id)
    DO UPDATE SET
      modal_job_id = EXCLUDED.modal_job_id,
      processing_status = 'separating',
      updated_at = NOW()
  `;

  return c.json({
    success: true,
    job_id: jobId,
    status: 'processing',
    track: { title, artists },
    message: 'Demucs separation started. Webhook will be called when complete.',
  });
});

/**
 * POST /webhooks/demucs-complete
 * Webhook handler for Demucs separation completion
 */
karaoke.post('/webhooks/demucs-complete', async (c) => {
  const payload: DemucsWebhookPayload = await c.req.json();
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  console.log(`[Webhook] Demucs job ${payload.job_id} - status: ${payload.status}`);

  // Handle failure
  if (payload.status === 'failed') {
    await db.sql`
      UPDATE karaoke_productions
      SET processing_status = 'failed',
          error_message = ${payload.error || 'Unknown error'},
          updated_at = NOW()
      WHERE modal_job_id = ${payload.job_id}
    `;

    return c.json({ received: true, status: 'failed' });
  }

  // Handle success - upload to Grove
  try {
    const grove = new GroveService(37111); // Lens testnet

    console.log(`[Webhook] Uploading vocals to Grove...`);
    const vocalsResult = await grove.uploadBase64(payload.vocals_base64!, 'audio/mp3');

    console.log(`[Webhook] Uploading instrumental to Grove...`);
    const instrumentalResult = await grove.uploadBase64(payload.instrumental_base64!, 'audio/mp3');

    console.log(`[Webhook] Vocals CID: ${vocalsResult.cid}`);
    console.log(`[Webhook] Instrumental CID: ${instrumentalResult.cid}`);

    // Update database with Grove CIDs
    await db.sql`
      UPDATE karaoke_productions
      SET vocals_cid = ${vocalsResult.cid},
          vocals_uri = ${vocalsResult.uri},
          vocals_gateway_url = ${vocalsResult.gatewayUrl},
          instrumental_cid = ${instrumentalResult.cid},
          instrumental_uri = ${instrumentalResult.uri},
          instrumental_gateway_url = ${instrumentalResult.gatewayUrl},
          processing_status = 'separated',
          separation_duration_seconds = ${payload.duration},
          updated_at = NOW()
      WHERE modal_job_id = ${payload.job_id}
    `;

    return c.json({
      received: true,
      status: 'completed',
      vocals_cid: vocalsResult.cid,
      instrumental_cid: instrumentalResult.cid,
    });
  } catch (error) {
    console.error(`[Webhook] Failed to upload to Grove:`, error);

    await db.sql`
      UPDATE karaoke_productions
      SET processing_status = 'failed',
          error_message = ${error instanceof Error ? error.message : 'Grove upload failed'},
          updated_at = NOW()
      WHERE modal_job_id = ${payload.job_id}
    `;

    return c.json({ received: true, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

/**
 * GET /karaoke/status
 * Check processing status of a karaoke production
 */
karaoke.get('/karaoke/status', async (c) => {
  const spotify_track_id = c.req.query('spotify_track_id');

  if (!spotify_track_id) {
    return c.json({ error: 'spotify_track_id query parameter required' }, 400);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  // Get production status
  const production = await db.sql`
    SELECT
      p.production_id,
      p.spotify_track_id,
      p.processing_status,
      p.modal_job_id,
      p.vocals_cid,
      p.vocals_uri,
      p.vocals_gateway_url,
      p.instrumental_cid,
      p.instrumental_uri,
      p.instrumental_gateway_url,
      p.separation_duration_seconds,
      p.error_message,
      d.download_status,
      d.download_completed_at,
      s.segment_start_ms,
      s.segment_end_ms,
      s.segment_duration_ms,
      l.lrclib_id,
      p.grove_instrumental_cid,
      p.grove_vocals_cid,
      p.grove_lyrics_cid
    FROM karaoke_productions p
    LEFT JOIN karaoke_downloads d ON p.spotify_track_id = d.spotify_track_id
    LEFT JOIN karaoke_segments s ON p.spotify_track_id = s.spotify_track_id
    LEFT JOIN lrclib_lyrics l ON p.spotify_track_id = l.spotify_track_id
    WHERE p.spotify_track_id = ${spotify_track_id}
  `;

  if (production.length === 0) {
    return c.json({
      found: false,
      message: 'No karaoke production found for this track',
    });
  }

  return c.json({
    found: true,
    production: production[0],
  });
});

export default karaoke;
