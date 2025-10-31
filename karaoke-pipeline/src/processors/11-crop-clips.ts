/**
 * Step 11: Viral Clip Cropping
 *
 * Crops the enhanced 190s instrumental to extract the best 20-50s viral clip.
 * Uses word-level timing from the 190s segment to select the clip boundary.
 *
 * IMPORTANT: Uses the CROPPED 190s enhanced audio from Step 10
 * Converts absolute clip timestamps to relative offsets (0-190000ms)
 *
 * Processes tracks that have:
 * - Segment selection complete (karaoke_segments.clip_start_ms)
 * - fal.ai enhancement complete (karaoke_segments.fal_enhanced_grove_cid)
 * - NO clip cropping yet (karaoke_segments.clip_cropped_grove_cid IS NULL)
 */

import {
  getTracksNeedingClipCropping,
  updateClipCropped
} from '../db/karaoke-segments';
import { FFmpegService } from '../services/ffmpeg';
import { uploadToGrove } from '../services/grove';
import type { Env } from '../types';

export async function processClipCropping(env: Env, limit: number = 10): Promise<void> {
  console.log(`\n[Step 11] Viral Clip Cropping (limit: ${limit})`);

  const ffmpegService = new FFmpegService();

  try {
    // Find tracks needing clip cropping
    const tracks = await getTracksNeedingClipCropping(env.DATABASE_URL, limit);

    if (tracks.length === 0) {
      console.log('✓ No tracks need clip cropping (all caught up!)');
      return;
    }

    console.log(`Found ${tracks.length} tracks needing clip cropping`);

    let croppedCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      try {
        console.log(`\n📍 Cropping clip: ${track.spotify_track_id}`);

        const clipStartMs = track.clip_start_ms;
        const clipEndMs = track.clip_end_ms;
        const segmentStartMs = track.optimal_segment_start_ms;
        const segmentEndMs = track.optimal_segment_end_ms;

        let clampedClipStartMs: number;
        let clampedClipEndMs: number;

        // For songs ≥190s: clips are relative to segment start
        // For songs <190s: clips are absolute (no segment)
        if (segmentStartMs !== null && segmentEndMs !== null) {
          // Songs ≥190s with optimal segment
          const clipRelativeStartMs = clipStartMs - segmentStartMs;
          const clipRelativeEndMs = clipEndMs - segmentStartMs;
          const clipDurationMs = clipRelativeEndMs - clipRelativeStartMs;

          console.log(
            `   Segment: ${segmentStartMs}ms - ${segmentEndMs}ms (190s)`
          );
          console.log(
            `   Clip (absolute): ${clipStartMs}ms - ${clipEndMs}ms (${clipDurationMs}ms)`
          );
          console.log(
            `   Clip (relative to segment): ${clipRelativeStartMs}ms - ${clipRelativeEndMs}ms`
          );

          // Validate clip is within segment bounds
          if (clipRelativeStartMs < 0 || clipRelativeEndMs > 190000) {
            console.warn(
              `   ⚠️  Clip is outside segment bounds! Relative: [${clipRelativeStartMs}, ${clipRelativeEndMs}]`
            );
            console.warn(`   Clamping to segment: [0, 190000]`);
          }

          // Clamp to segment bounds [0, 190000]
          clampedClipStartMs = Math.max(0, clipRelativeStartMs);
          clampedClipEndMs = Math.min(190000, clipRelativeEndMs);

          // Handle invalid ranges (e.g., clip entirely before segment)
          if (clampedClipEndMs <= clampedClipStartMs) {
            console.warn(`   ⚠️  Invalid clip range after clamping! Start: ${clampedClipStartMs}, End: ${clampedClipEndMs}`);
            console.warn(`   Using fallback: middle 35s of segment`);
            // Use middle 35s of segment as fallback
            clampedClipStartMs = Math.max(0, (190000 - 35000) / 2);
            clampedClipEndMs = clampedClipStartMs + 35000;
          }
        } else {
          // Songs <190s: no segment, use absolute times
          console.log(
            `   Song <190s (no optimal segment)`
          );
          console.log(
            `   Clip (absolute): ${clipStartMs}ms - ${clipEndMs}ms (${clipEndMs - clipStartMs}ms)`
          );

          clampedClipStartMs = clipStartMs;
          clampedClipEndMs = clipEndMs;
        }

        // Crop enhanced 190s audio to clip range
        console.log(`   ✂️  Cropping enhanced audio...`);
        const cropResult = await ffmpegService.cropFromUrl(
          track.fal_enhanced_grove_url,
          {
            startMs: clampedClipStartMs,
            endMs: clampedClipEndMs,
            bitrate: 192
          }
        );

        console.log(
          `   ✓ Cropped: ${(cropResult.buffer.length / 1024 / 1024).toFixed(2)}MB, ${cropResult.durationMs}ms`
        );

        // Upload cropped clip to Grove
        console.log(`   Uploading to Grove...`);
        const groveResult = await uploadToGrove(
          cropResult.buffer,
          'audio/mpeg',
          `clip-${track.spotify_track_id}.mp3`
        );

        console.log(`   ✓ Uploaded: ${groveResult.cid}`);

        // Update database with clip results
        await updateClipCropped(env.DATABASE_URL, track.spotify_track_id, {
          relativeStartMs: clampedClipStartMs,
          relativeEndMs: clampedClipEndMs,
          groveCid: groveResult.cid,
          groveUrl: groveResult.url
        });

        console.log(`   ✓ Database updated`);
        croppedCount++;
      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack: ${error.stack.split('\n')[0]}`);
        }
        failedCount++;

        // Continue to next track on error
      }
    }

    console.log(`\n✓ Step 11 complete: ${croppedCount} cropped, ${failedCount} failed`);

  } catch (error: any) {
    console.error(`[Step 11] Fatal error: ${error.message}`);
    throw error;
  }
}
