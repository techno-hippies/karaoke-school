#!/usr/bin/env bun
/**
 * Processor: Submit Audio Downloads (Fire-and-Forget)
 * Submits tracks to audio-download-service for async processing
 *
 * Architecture:
 * - This processor finds tracks ready for download and submits them
 * - audio-download-service handles: download → verify → Grove upload → DB updates
 * - No waiting or polling - audio-download-service updates song_pipeline when done
 *
 * Flow:
 * 1. Find tracks with status='lyrics_ready' and has_audio=FALSE
 * 2. Check if already submitted (exists in song_audio with NULL grove_cid)
 * 3. Submit uncached tracks to audio-download-service (fire-and-forget)
 * 4. audio-download-service completes workflow and updates both tables
 *
 * Usage:
 *   bun src/processors/download-audio.ts [batchSize]
 */

import { query, close } from '../db/neon';

// Bypass SSL verification for self-signed certs on audio-download-service
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const AUDIO_DOWNLOAD_SERVICE_URL = process.env.AUDIO_DOWNLOAD_SERVICE_URL || process.env.SLSK_SERVICE_URL || process.env.FREYR_SERVICE_URL || 'http://localhost:3001';
const ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY;
const CHAIN_ID = 37111; // Lens Network

interface Track {
  id: number;
  spotify_track_id: string;
  title: string;
  artists: string[] | { id: string; name: string }[];
  duration_ms: number;
}

async function submitToSlsk(track: Track): Promise<void> {
  // Extract artist name
  const artistName = Array.isArray(track.artists)
    ? (typeof track.artists[0] === 'object'
        ? (track.artists[0] as { name: string }).name
        : track.artists[0])
    : track.artists;

  console.log(`  🚀 Submitting: ${track.title} - ${artistName}`);

  // Submit to audio-download-service (wait for request to be sent, but don't wait for processing)
  try {
    const response = await fetch(`${AUDIO_DOWNLOAD_SERVICE_URL}/download-and-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spotify_track_id: track.spotify_track_id,
        expected_title: track.title,
        expected_artist: artistName,
        acoustid_api_key: ACOUSTID_API_KEY,
        chain_id: CHAIN_ID,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`     ⚠️  Submission rejected: ${error}`);
    } else {
      console.log(`     ✓ Submitted (processing asynchronously)`);
      // Don't wait for the JSON response - audio-download-service will process in background
      response.body?.cancel(); // Cancel reading the body since we don't need it
    }
  } catch (error: any) {
    console.error(`     ⚠️  Submission failed: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 10;

  console.log('🎵 Audio Download Submitter (Fire-and-Forget)');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log(`🔗 audio-download-service: ${AUDIO_DOWNLOAD_SERVICE_URL}`);
  console.log('');

  // Find tracks that need audio download
  console.log('⏳ Finding tracks ready for audio download...');

  const tracksToProcess = await query<Track>(`
    SELECT
      tp.id,
      tp.spotify_track_id,
      st.title,
      st.artists,
      st.duration_ms,
      COALESCE(tp.retry_count, 0) as retry_count
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    JOIN song_lyrics sl ON tp.spotify_track_id = sl.spotify_track_id
    LEFT JOIN song_audio sa ON tp.spotify_track_id = sa.spotify_track_id
    WHERE tp.status = 'lyrics_ready'
      AND tp.has_audio = FALSE
      AND sl.normalized_lyrics IS NOT NULL  -- MUST have actual lyrics
      AND (
        -- Either no song_audio entry exists OR it exists but failed (grove_cid IS NULL)
        sa.spotify_track_id IS NULL
        OR sa.grove_cid IS NULL
      )
      -- Retry logic: skip if 3+ failures, respect 5min cooldown
      AND COALESCE(tp.retry_count, 0) < 3
      AND (
        tp.last_attempted_at IS NULL
        OR tp.last_attempted_at < NOW() - INTERVAL '5 minutes'
      )
    ORDER BY
      -- Prioritize: never-tried first, then oldest attempts
      tp.retry_count ASC,
      tp.last_attempted_at ASC NULLS FIRST,
      tp.id ASC
    LIMIT ${batchSize}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✅ No tracks need submission. All caught up!');
    return;
  }

  console.log(`✅ Found ${tracksToProcess.length} tracks to submit`);
  console.log('');

  // Submit all tracks (fire-and-forget)
  console.log('🚀 Submitting to audio-download-service...');

  for (const track of tracksToProcess) {
    await submitToSlsk(track);

    // Delay to avoid overwhelming the service (downloads take 60-180s each)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Tracks submitted: ${tracksToProcess.length}`);
  console.log('');
  console.log('✅ Done! audio-download-service will process asynchronously.');
  console.log('   Audio files will appear in song_audio table when complete.');
  console.log('   Pipeline status will update to "audio_downloaded" automatically.');
}

/**
 * Export function for orchestrator
 */
export async function processDownloadAudio(_env: any, limit: number = 50): Promise<void> {
  console.log(`[Step 6] Download Audio (limit: ${limit})`);

  const tracksToProcess = await query<Track>(`
    SELECT
      tp.id,
      tp.spotify_track_id,
      st.title,
      st.artists,
      st.duration_ms
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status = 'lyrics_ready'
      AND tp.has_audio = FALSE
      AND (
        NOT EXISTS (
          SELECT 1 FROM song_audio sa
          WHERE sa.spotify_track_id = tp.spotify_track_id
        )
        OR EXISTS (
          SELECT 1 FROM song_audio sa
          WHERE sa.spotify_track_id = tp.spotify_track_id
            AND sa.grove_cid IS NULL
        )
      )
    ORDER BY tp.id
    LIMIT ${limit}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✓ No tracks need audio download');
    return;
  }

  console.log(`Found ${tracksToProcess.length} tracks`);

  // Submit all tracks to slsk-service (fire-and-forget)
  let submittedCount = 0;

  for (const track of tracksToProcess) {
    try {
      const artistName = Array.isArray(track.artists)
        ? (typeof track.artists[0] === 'object'
            ? (track.artists[0] as { name: string }).name
            : track.artists[0])
        : track.artists;

      // Create abort controller with 30 second timeout (Akash can be slow to respond)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(`${AUDIO_DOWNLOAD_SERVICE_URL}/download-and-store`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spotify_track_id: track.spotify_track_id,
            expected_title: track.title,
            expected_artist: artistName,
            acoustid_api_key: ACOUSTID_API_KEY,
            neon_database_url: DATABASE_URL,
            chain_id: CHAIN_ID,
          }),
          signal: controller.signal,
          // @ts-ignore - Bun-specific option to skip SSL verification for Akash self-signed certs
          tls: { rejectUnauthorized: false },
        });

        if (response.ok) {
          submittedCount++;
          response.body?.cancel();

          // Track successful submission
          await query(`
            UPDATE song_pipeline
            SET last_attempted_at = NOW()
            WHERE id = $1
          `, [track.id]);
        } else {
          // Track failed submission
          const errorText = await response.text();
          await query(`
            UPDATE song_pipeline
            SET
              retry_count = COALESCE(retry_count, 0) + 1,
              last_attempted_at = NOW(),
              error_message = $1,
              error_stage = 'step_6_download_submission'
            WHERE id = $2
          `, [errorText.substring(0, 500), track.id]);
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      // Track timeout/network errors
      if (error.name !== 'AbortError') {
        console.log(`     ⚠️  ${error.message}`);

        try {
          await query(`
            UPDATE song_pipeline
            SET
              retry_count = COALESCE(retry_count, 0) + 1,
              last_attempted_at = NOW(),
              error_message = $1,
              error_stage = 'step_6_download_network'
            WHERE id = $2
          `, [error.message.substring(0, 500), track.id]);
        } catch (updateError) {
          // Ignore update errors (don't want to fail the loop)
        }
      }
    }
  }

  console.log(`✅ Step 6 Complete: ${submittedCount} submitted to audio-download-service`);
}

// Only run main() if this file is executed directly, not when imported
if (import.meta.main) {
  main()
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await close();
    });
}
