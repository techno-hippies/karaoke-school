/**
 * Demucs Separation Cron
 *
 * Automatically submits tracks with audio files to Modal for vocal/instrumental separation.
 * Processes tracks that have:
 * - Downloaded audio file (track_audio_files)
 * - No existing separation (track_separated_audio)
 * - Verified audio (90%+ AcoustID confidence)
 */

import { NeonDB } from '../neon';
import { DemucsService } from '../services/demucs';
import type { Env } from '../types';

export default async function runDemucsSeparation(env: Env): Promise<void> {
  console.log('🎵 Demucs Separation Cron: Starting...');

  const db = new NeonDB(env.NEON_DATABASE_URL);
  const DEMUCS_MODE = (env.DEMUCS_MODE || 'local') as 'local' | 'modal';
  const DEMUCS_LOCAL_ENDPOINT = env.DEMUCS_LOCAL_ENDPOINT;
  const MODAL_DEMUCS_ENDPOINT = env.MODAL_DEMUCS_ENDPOINT;
  const WORKER_URL = env.WORKER_URL;

  if (!WORKER_URL) {
    console.error('❌ WORKER_URL not configured');
    return;
  }

  console.log(`[Demucs] Mode: ${DEMUCS_MODE}`);
  if (DEMUCS_MODE === 'local' && DEMUCS_LOCAL_ENDPOINT) {
    console.log(`[Demucs] Local endpoint: ${DEMUCS_LOCAL_ENDPOINT}`);
  }
  if (MODAL_DEMUCS_ENDPOINT) {
    console.log(`[Demucs] Modal endpoint available (fallback)`);
  }

  try {
    // Find tracks with audio but no separation
    const tracksNeedingSeparation = await db.sql`
      SELECT
        taf.spotify_track_id,
        taf.grove_url,
        taf.grove_cid,
        st.title,
        st.artists[1] as artist
      FROM track_audio_files taf
      INNER JOIN spotify_tracks st ON taf.spotify_track_id = st.spotify_track_id
      LEFT JOIN track_separated_audio tsa ON taf.spotify_track_id = tsa.spotify_track_id
      WHERE taf.verified = true
        AND taf.verification_confidence >= 0.90
        AND tsa.spotify_track_id IS NULL
      ORDER BY taf.downloaded_at DESC
      LIMIT 3
    `;

    if (tracksNeedingSeparation.length === 0) {
      console.log('✓ No tracks need separation');
      return;
    }

    console.log(`Found ${tracksNeedingSeparation.length} tracks needing separation`);

    const demucs = new DemucsService(
      DEMUCS_MODE,
      DEMUCS_LOCAL_ENDPOINT,
      MODAL_DEMUCS_ENDPOINT
    );
    let submitted = 0;
    let failed = 0;

    for (const track of tracksNeedingSeparation) {
      try {
        const jobId = crypto.randomUUID();

        // Submit to Modal
        const result = await demucs.separateAsync(
          track.grove_url,
          `${WORKER_URL}/webhooks/demucs-complete`,
          jobId
        );

        // Create pending record
        await db.sql`
          INSERT INTO track_separated_audio (
            spotify_track_id,
            modal_job_id,
            separation_status
          )
          VALUES (${track.spotify_track_id}, ${jobId}, 'processing')
        `;

        console.log(`  ✓ Submitted: ${track.title} - ${track.artist} (job: ${jobId}, mode: ${result.mode})`);
        submitted++;

        // Rate limit: 2 seconds between submissions
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`  ✗ Failed: ${track.title}`, error.message);

        // Record failure
        await db.sql`
          INSERT INTO track_separated_audio (
            spotify_track_id,
            separation_status,
            error_message
          )
          VALUES (${track.spotify_track_id}, 'failed', ${error.message})
          ON CONFLICT (spotify_track_id) DO UPDATE SET
            separation_status = 'failed',
            error_message = EXCLUDED.error_message,
            updated_at = NOW()
        `;

        failed++;
      }
    }

    console.log(`✓ Demucs Separation Cron: Complete (${submitted} submitted, ${failed} failed)`);
  } catch (error: any) {
    console.error('Demucs separation cron failed:', error);
  }
}
