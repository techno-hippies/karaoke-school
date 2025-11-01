/**
 * Step 10: fal.ai Audio Enhancement with FFmpeg Cropping
 *
 * Enhances instrumental tracks using Stable Audio 2.5.
 *
 * FLOW:
 * 1. For songs ≥190s: Crop to optimal segment FIRST using local FFmpeg
 * 2. Upload cropped version to Grove
 * 3. Send (cropped or full) audio to fal.ai for enhancement
 * 4. Upload enhanced audio to Grove
 *
 * Processes tracks that have:
 * - Segment selection complete (karaoke_segments.clip_start_ms)
 * - NO fal.ai enhancement yet (karaoke_segments.fal_enhanced_grove_cid IS NULL)
 */

import {
  updateFalEnhancement,
  updateCroppedInstrumental,
  getTracksNeedingFalEnhancement
} from '../db/karaoke-segments';
import { FalAudioService } from '../services/fal-audio';
import { FFmpegService } from '../services/ffmpeg';
import { uploadToGrove } from '../services/grove';
import type { Env } from '../types';

export async function processFalEnhancement(env: Env, limit: number = 10): Promise<void> {
  console.log(`\n[Step 10] fal.ai Audio Enhancement (limit: ${limit})`);

  if (!env.FAL_API_KEY) {
    console.log('⚠️ FAL_API_KEY not configured, skipping');
    return;
  }

  // Check if FFmpeg is available for cropping
  const hasFFmpeg = FFmpegService.isAvailable();
  console.log(`   FFmpeg: ${hasFFmpeg ? '✓ Available' : '✗ Not available'}`);

  const falService = new FalAudioService(env.FAL_API_KEY, {
    maxPollAttempts: 180, // 6 minutes
    pollInterval: 2000     // 2 seconds
  });

  const ffmpegService = hasFFmpeg ? new FFmpegService() : null;

  try {
    // Find tracks needing enhancement
    const tracks = await getTracksNeedingFalEnhancement(env.DATABASE_URL, limit);

    if (tracks.length === 0) {
      console.log('✓ No tracks need enhancement (all caught up!)');
      return;
    }

    console.log(`Found ${tracks.length} tracks needing enhancement`);

    let enhancedCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      try {
        console.log(`\n📍 Enhancing: ${track.spotify_track_id}`);
        console.log(`   Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);

        let audioUrlForFal = track.instrumental_grove_url;
        let croppedGroveUrl: string | null = null;

        // STEP 1: Crop if needed (songs ≥190s with optimal segment)
        if (
          hasFFmpeg &&
          ffmpegService &&
          track.optimal_segment_start_ms !== null &&
          track.optimal_segment_end_ms !== null &&
          track.duration_ms >= 190000
        ) {
          try {
            let segmentStart = track.optimal_segment_start_ms;
            let segmentEnd = track.optimal_segment_end_ms;
            let segmentDuration = segmentEnd - segmentStart;

            console.log(`   ✂️  Cropping: ${segmentStart}ms-${segmentEnd}ms (${(segmentDuration / 1000).toFixed(1)}s)`);

            // If segment exceeds 190s, trim it down to 190s max (fal.ai limit)
            if (segmentDuration > 190000) {
              const originalDuration = segmentDuration;
              segmentEnd = segmentStart + 190000;
              segmentDuration = 190000;
              console.log(`   ⚠️  Segment was ${(originalDuration / 1000).toFixed(1)}s, trimming to exactly 190s for fal.ai`);
            }

            const cropResult = await ffmpegService.cropFromUrl(track.instrumental_grove_url, {
              startMs: segmentStart,
              endMs: segmentEnd,
              bitrate: 192
            });

            // Upload cropped audio
            console.log(`   Uploading cropped audio to Grove...`);
            const croppedGroveResult = await uploadToGrove(
              cropResult.buffer,
              'audio/mpeg',
              `cropped-${track.spotify_track_id}.mp3`
            );

            croppedGroveUrl = croppedGroveResult.url;
            audioUrlForFal = croppedGroveUrl;

            // Update database with cropped audio
            await updateCroppedInstrumental(env.DATABASE_URL, track.spotify_track_id, {
              groveCid: croppedGroveResult.cid,
              groveUrl: croppedGroveResult.url
            });

            console.log(`   ✓ Cropped & uploaded: ${croppedGroveResult.cid}`);
          } catch (cropError: any) {
            console.warn(`   ⚠️  Cropping failed, will enhance FULL track: ${cropError.message}`);
            // Continue with full track if cropping fails
          }
        } else if (track.optimal_segment_start_ms && track.optimal_segment_end_ms) {
          const segmentDuration = track.optimal_segment_end_ms - track.optimal_segment_start_ms;
          console.log(`   Note: Has segment (${(segmentDuration / 1000).toFixed(1)}s) but FFmpeg unavailable`);
          console.log(`   Will enhance FULL track (${(track.duration_ms / 1000).toFixed(1)}s)`);
        }

        // STEP 2: Send to fal.ai for enhancement
        console.log(`   Sending to fal.ai...`);
        const result = await falService.enhanceInstrumental({
          audioUrl: audioUrlForFal,
          prompt: 'instrumental',
          strength: 0.35
        });

        console.log(`   ✓ Enhancement complete in ${result.duration.toFixed(1)}s`);

        // STEP 3: Download enhanced audio
        console.log(`   Downloading enhanced audio...`);
        const audioBuffer = await falService.downloadAudio(result.audioUrl);

        // STEP 4: Upload enhanced audio to Grove
        console.log(`   Uploading enhanced audio to Grove...`);
        const groveResult = await uploadToGrove(
          Buffer.from(audioBuffer),
          'audio/mpeg',
          `fal-enhanced-${track.spotify_track_id}.mp3`
        );

        console.log(`   ✓ Uploaded to Grove: ${groveResult.cid}`);

        // STEP 5: Update database
        await updateFalEnhancement(env.DATABASE_URL, track.spotify_track_id, {
          groveCid: groveResult.cid,
          groveUrl: groveResult.url,
          processingDurationSeconds: result.duration
        });

        console.log(`   ✓ Database updated`);
        enhancedCount++;

      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack: ${error.stack.split('\n')[0]}`);
        }
        failedCount++;

        // Continue to next track on error
      }
    }

    console.log(`\n✓ Step 10 complete: ${enhancedCount} enhanced, ${failedCount} failed`);
    if (enhancedCount > 0) {
      console.log(`   Total cost estimate: $${(enhancedCount * 0.20).toFixed(2)}`);
    }

  } catch (error: any) {
    console.error(`[Step 10] Fatal error: ${error.message}`);
    throw error;
  }
}
