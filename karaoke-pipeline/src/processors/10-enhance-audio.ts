/**
 * Step 10: fal.ai Audio Enhancement
 *
 * Enhances instrumental tracks using Stable Audio 2.5.
 *
 * NOTE: Currently enhances the FULL instrumental for all songs.
 * The segment selection (optimal_segment_start_ms, clip_start_ms) is metadata
 * that tells the app which part to play, but the entire instrumental is enhanced.
 *
 * TODO: Add cropping step for songs ≥190s (requires external service with FFmpeg)
 *
 * Processes tracks that have:
 * - Segment selection complete (karaoke_segments.clip_start_ms)
 * - NO fal.ai enhancement yet (karaoke_segments.fal_enhanced_grove_cid IS NULL)
 */

import {
  updateFalEnhancement,
  getTracksNeedingFalEnhancement
} from '../db/karaoke-segments';
import { FalAudioService } from '../services/fal-audio';
import { uploadToGrove } from '../services/grove';
import type { Env } from '../types';

export async function processFalEnhancement(env: Env, limit: number = 10): Promise<void> {
  console.log(`\n[Step 10] fal.ai Audio Enhancement (limit: ${limit})`);

  if (!env.FAL_API_KEY) {
    console.log('⚠️ FAL_API_KEY not configured, skipping');
    return;
  }

  if (!env.IRYS_PRIVATE_KEY) {
    console.log('⚠️ IRYS_PRIVATE_KEY not configured (needed for Grove upload), skipping');
    return;
  }

  const falService = new FalAudioService(env.FAL_API_KEY, {
    maxPollAttempts: 180, // 6 minutes
    pollInterval: 2000     // 2 seconds
  });

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
        console.log(`   Instrumental: ${track.instrumental_grove_url.slice(0, 50)}...`);

        // For now: Enhance full instrumental
        // TODO: If optimal_segment_* exists, crop to 190s first (requires external service)
        if (track.optimal_segment_start_ms && track.optimal_segment_end_ms) {
          console.log(`   Note: Song has optimal segment selected (${track.optimal_segment_start_ms}-${track.optimal_segment_end_ms}ms)`);
          console.log(`   But will enhance FULL track (cropping requires FFmpeg)`);
        }

        // Step 1: Send to fal.ai for enhancement
        console.log(`   Sending to fal.ai...`);
        const result = await falService.enhanceInstrumental({
          audioUrl: track.instrumental_grove_url,
          prompt: 'instrumental',
          strength: 0.3
        });

        console.log(`   ✓ Enhancement complete in ${result.duration.toFixed(1)}s`);

        // Step 2: Download enhanced audio
        console.log(`   Downloading enhanced audio...`);
        const audioBuffer = await falService.downloadAudio(result.audioUrl);

        // Step 3: Upload to Grove
        console.log(`   Uploading to Grove...`);
        const groveResult = await uploadToGrove(
          env.IRYS_PRIVATE_KEY,
          Buffer.from(audioBuffer),
          'audio/mpeg',
          {
            'Content-Type': 'audio/mpeg',
            'Application': 'Karaoke-Pipeline',
            'File-Type': 'fal-enhanced-instrumental',
            'Spotify-Track-ID': track.spotify_track_id,
            'Processing-Duration': result.duration.toString()
          }
        );

        console.log(`   ✓ Uploaded to Grove: ${groveResult.cid}`);

        // Step 4: Update database
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
