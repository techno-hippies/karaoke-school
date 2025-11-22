/**
 * Audio Task: Clip Segments
 *
 * Crops the enhanced full song to the AI-selected viral clip boundaries
 * (40-100s verse+chorus segment) and uploads to Grove.
 *
 * Flow:
 * 1. Get tracks with enhanced audio + clip boundaries selected
 * 2. Download enhanced full song from Grove
 * 3. Use FFmpeg to crop to clip_start_ms → clip_end_ms
 * 4. Upload cropped clip to Grove
 * 5. Store clip_grove_cid and clip_grove_url
 */

import { unlinkSync } from 'fs';
import { query } from '../../db/connection';
import {
  ensureAudioTask,
  startTask,
  completeTask,
  failTask,
  updateTrackStage
} from '../../db/audio-tasks';
import { createFFmpegService } from '../../services/ffmpeg';
import { uploadToGrove } from '../../services/storage';

interface TrackWithClipData {
  spotify_track_id: string;
  title: string;
  artists: string;
  fal_enhanced_grove_url: string;
  clip_start_ms: number;
  clip_end_ms: number;
}

/**
 * Process clip creation for tracks
 */
export async function processClipSegments(limit: number = 10): Promise<void> {
  console.log(`\n✂️  Audio Task: Clip Segments (limit: ${limit})`);

  try {
    // Find tracks with enhanced audio and clip boundaries selected
    const tracks = await query<TrackWithClipData>(
      `SELECT
        t.spotify_track_id,
        t.title,
        t.artists,
        ks.fal_enhanced_grove_url,
        ks.clip_start_ms,
        ks.clip_end_ms
      FROM tracks t
      JOIN karaoke_segments ks ON t.spotify_track_id = ks.spotify_track_id
      JOIN audio_tasks at_enhance ON t.spotify_track_id = at_enhance.spotify_track_id
        AND at_enhance.task_type = 'enhance'
        AND at_enhance.status = 'completed'
      JOIN audio_tasks at_segment ON t.spotify_track_id = at_segment.spotify_track_id
        AND at_segment.task_type = 'segment'
        AND at_segment.status = 'completed'
      LEFT JOIN audio_tasks at_clip ON t.spotify_track_id = at_clip.spotify_track_id
        AND at_clip.task_type = 'clip'
      WHERE ks.fal_enhanced_grove_url IS NOT NULL
        AND ks.clip_start_ms IS NOT NULL
        AND ks.clip_end_ms IS NOT NULL
        AND ks.clip_grove_url IS NULL
        AND (at_clip.id IS NULL OR at_clip.status = 'pending')
      ORDER BY t.created_at DESC
      LIMIT $1`,
      [limit]
    );

    if (tracks.length === 0) {
      console.log('✓ No tracks ready for clip creation');
      return;
    }

    console.log(`Found ${tracks.length} tracks ready\n`);

    let successCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      const startTime = Date.now();

      try {
        const clipDuration = track.clip_end_ms - track.clip_start_ms;
        console.log(`✂️  ${track.title} - ${track.artists}`);
        console.log(`   Clip: ${(track.clip_start_ms / 1000).toFixed(1)}s - ${(track.clip_end_ms / 1000).toFixed(1)}s (${(clipDuration / 1000).toFixed(1)}s)`);

        // Ensure task record exists
        await ensureAudioTask(track.spotify_track_id, 'clip');
        await startTask(track.spotify_track_id, 'clip');

        // Step 1: Crop enhanced song to viral clip using FFmpeg
        console.log(`   Cropping from Grove URL...`);
        const ffmpeg = createFFmpegService();
        const cropResult = await ffmpeg.cropFromUrl(track.fal_enhanced_grove_url, {
          startMs: track.clip_start_ms,
          endMs: track.clip_end_ms,
          bitrate: 192
        });

        console.log(`   ✓ Cropped: ${(cropResult.buffer.length / 1024 / 1024).toFixed(2)} MB`);

        // Step 2: Upload clip to Grove
        console.log(`   Uploading to Grove...`);
        const groveResult = await uploadToGrove(
          cropResult.buffer,
          'audio/mp3',
          `clip-${track.spotify_track_id}.mp3`
        );

        console.log(`   ✓ Uploaded: ${groveResult.cid}`);

        // Step 3: Update karaoke_segments with clip URLs
        await query(
          `UPDATE karaoke_segments
           SET clip_grove_cid = $1,
               clip_grove_url = $2,
               updated_at = NOW()
           WHERE spotify_track_id = $3`,
          [groveResult.cid, groveResult.url, track.spotify_track_id]
        );

        // Step 4: Complete task
        const processingTime = Date.now() - startTime;
        await completeTask(track.spotify_track_id, 'clip', {
          grove_cid: groveResult.cid,
          grove_url: groveResult.url,
          clip_duration_ms: clipDuration,
          duration_ms: processingTime
        });

        // Update track stage
        await updateTrackStage(track.spotify_track_id);

        console.log(`   ✓ Completed (${(processingTime / 1000).toFixed(1)}s)\n`);
        successCount++;

      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);

        await failTask(
          track.spotify_track_id,
          'clip',
          error.message,
          { stack: error.stack }
        );

        failedCount++;
      }
    }

    console.log(`\n✓ Clip creation complete: ${successCount} succeeded, ${failedCount} failed`);

  } catch (error: any) {
    console.error(`Fatal error: ${error.message}`);
    throw error;
  }
}

// CLI execution
if (import.meta.main) {
  // Parse --limit=N or second arg
  let limit = 10;
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1]);
  } else if (process.argv[2] && !process.argv[2].startsWith('--')) {
    limit = parseInt(process.argv[2]);
  }

  processClipSegments(limit)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
