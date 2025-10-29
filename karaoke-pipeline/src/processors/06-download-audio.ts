#!/usr/bin/env bun
/**
 * Processor: Submit Audio Downloads (Fire-and-Forget)
 * Submits tracks to slsk-service for async processing
 *
 * Architecture:
 * - This processor finds tracks ready for download and submits them
 * - slsk-service handles: download → verify → Grove upload → DB updates
 * - No waiting or polling - slsk-service updates song_pipeline when done
 *
 * Flow:
 * 1. Find tracks with status='lyrics_ready' and has_audio=FALSE
 * 2. Check if already submitted (exists in song_audio with NULL grove_cid)
 * 3. Submit uncached tracks to slsk-service (fire-and-forget)
 * 4. slsk-service completes workflow and updates both tables
 *
 * Usage:
 *   bun src/processors/06-download-audio.ts [batchSize]
 */

import { query, close } from '../db/neon';

const SLSK_SERVICE_URL = process.env.SLSK_SERVICE_URL || process.env.FREYR_SERVICE_URL || 'http://localhost:3001';
const ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
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

  // Submit to slsk-service (wait for request to be sent, but don't wait for processing)
  try {
    const response = await fetch(`${SLSK_SERVICE_URL}/download-and-store`, {
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
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`     ⚠️  Submission rejected: ${error}`);
    } else {
      console.log(`     ✓ Submitted (processing asynchronously)`);
      // Don't wait for the JSON response - slsk-service will process in background
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
  console.log(`🔗 slsk-service: ${SLSK_SERVICE_URL}`);
  console.log('');

  // Validate env vars
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable required');
    process.exit(1);
  }

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
    WHERE tp.status = 'lyrics_ready'
      AND tp.has_audio = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM song_audio sa
        WHERE sa.spotify_track_id = tp.spotify_track_id
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
  console.log('🚀 Submitting to slsk-service...');

  for (const track of tracksToProcess) {
    await submitToSlsk(track);

    // Small delay to avoid overwhelming the service
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Tracks submitted: ${tracksToProcess.length}`);
  console.log('');
  console.log('✅ Done! slsk-service will process asynchronously.');
  console.log('   Audio files will appear in song_audio table when complete.');
  console.log('   Pipeline status will update to "audio_downloaded" automatically.');
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await close();
  });
