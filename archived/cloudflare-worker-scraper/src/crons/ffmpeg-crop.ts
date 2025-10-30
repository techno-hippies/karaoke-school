/**
 * FFmpeg Crop Cron
 *
 * Crops instrumental segments (190s) for fal.ai processing
 * - Finds tracks with segments selected but not yet cropped
 * - Gets instrumental Grove URL from track_separated_audio table
 * - Submits async crop jobs to Akash
 * - Webhook handles Grove upload when complete
 */

import { NeonDB } from '../neon';
import { FFmpegService } from '../services/ffmpeg';
import type { Env } from '../types';

export default async function runFFmpegCrop(env: Env): Promise<void> {
  console.log('✂️ FFmpeg Crop Cron: Starting...');

  const db = new NeonDB(env.NEON_DATABASE_URL);
  const MODAL_FFMPEG_ENDPOINT = env.MODAL_FFMPEG_ENDPOINT;

  if (!MODAL_FFMPEG_ENDPOINT) {
    console.error('❌ MODAL_FFMPEG_ENDPOINT not configured');
    return;
  }

  try {
    // Find tracks with segments selected but not yet cropped
    const tracksNeedingCrop = await db.sql`
      SELECT
        st.spotify_track_id,
        st.title,
        st.artists[1] as artist,
        ks.fal_segment_start_ms,
        ks.fal_segment_end_ms,
        tsa.instrumental_grove_cid,
        tsa.instrumental_grove_url
      FROM karaoke_segments ks
      INNER JOIN spotify_tracks st ON ks.spotify_track_id = st.spotify_track_id
      INNER JOIN track_separated_audio tsa ON st.spotify_track_id = tsa.spotify_track_id
      WHERE ks.fal_segment_start_ms IS NOT NULL
        AND ks.fal_segment_end_ms IS NOT NULL
        AND ks.fal_segment_grove_cid IS NULL
        AND tsa.instrumental_grove_cid IS NOT NULL
      ORDER BY ks.created_at ASC
      LIMIT 10
    `;

    if (tracksNeedingCrop.length === 0) {
      console.log('✓ No tracks need cropping');
      return;
    }

    console.log(`Found ${tracksNeedingCrop.length} tracks needing cropping`);

    const ffmpeg = new FFmpegService(MODAL_FFMPEG_ENDPOINT);
    let submitted = 0;
    let failed = 0;

    // Webhook URL for results
    const webhookUrl = `${env.WORKER_BASE_URL || 'https://tiktok-scraper.deletion-backup782.workers.dev'}/webhook/ffmpeg-crop`;

    for (const track of tracksNeedingCrop) {
      try {
        const durationMs = track.fal_segment_end_ms - track.fal_segment_start_ms;
        console.log(`  Cropping: ${track.title} - ${track.artist} (${Math.floor(durationMs / 1000)}s @ ${Math.floor(track.fal_segment_start_ms / 1000)}s)`);

        // Convert lens:// URI to HTTP gateway URL
        let audioUrl = track.instrumental_grove_url;
        if (audioUrl.startsWith('lens://')) {
          const cid = audioUrl.replace('lens://', '');
          audioUrl = `https://api.grove.storage/${cid}`;
        }

        const result = await ffmpeg.cropAsync(
          audioUrl,
          track.fal_segment_start_ms,
          track.fal_segment_end_ms,
          webhookUrl,
          track.spotify_track_id  // Use track ID as job ID
        );

        console.log(`  ✓ Submitted job: ${result.jobId}`);
        submitted++;

        // Rate limit: 500ms between submissions
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`  ✗ Failed: ${track.title}`, error.message);
        failed++;
      }
    }

    console.log(`✓ FFmpeg Crop Cron: Complete (${submitted} submitted, ${failed} failed)`);
  } catch (error: any) {
    console.error('FFmpeg crop cron failed:', error);
  }
}
