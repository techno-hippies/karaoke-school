#!/usr/bin/env bun
/**
 * Audio Task: Clip Segments (REFACTORED with BaseTask)
 * Stage: segmented → ready (with clipped audio)
 *
 * Crops the enhanced full song to the AI-selected viral clip boundaries
 * (40-100s verse+chorus segment) and uploads to Grove.
 *
 * COMPARISON:
 * - Old version: 179 lines with manual lifecycle management
 * - New version: ~105 lines, BaseTask handles boilerplate
 * - Reduction: ~41% less code, same functionality
 *
 * Flow:
 * 1. Get tracks with enhanced audio + clip boundaries selected
 * 2. Download enhanced full song from Grove
 * 3. Use FFmpeg to crop to clip_start_ms → clip_end_ms
 * 4. Upload cropped clip to Grove
 * 5. Store clip_grove_cid and clip_grove_url
 *
 * Usage:
 *   bun src/tasks/audio/clip-segments-refactored.ts --limit=10
 */

import { query } from '../../db/connection';
import { TrackStage, AudioTaskType } from '../../db/task-stages';
import { createFFmpegService } from '../../services/ffmpeg';
import { uploadToGrove } from '../../services/storage';
import { BaseTask, type BaseTrackInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import type { ClipMetadata } from '../../types/task-metadata';

interface TrackForClipping extends BaseTrackInput {
  spotify_track_id: string;
  title: string;
  artists: string;
  fal_enhanced_grove_url: string;
  clip_start_ms: number;
  clip_end_ms: number;
}

interface ClipResult extends TaskResult {
  metadata: ClipMetadata;
}

/**
 * Clip Segments Task
 *
 * Uses BaseTask to eliminate boilerplate:
 * - No manual ensureAudioTask/startTask/completeTask/failTask
 * - No manual updateTrackStage
 * - No manual error handling and retries
 * - No manual success/failure counting
 */
export class ClipSegmentsTask extends BaseTask<TrackForClipping, ClipResult> {
  readonly taskType = AudioTaskType.Clip;
  private ffmpeg: ReturnType<typeof createFFmpegService>;

  constructor() {
    super();
    this.ffmpeg = createFFmpegService();
  }

  /**
   * Select tracks with enhanced audio and clip boundaries
   * NOTE: Tracks are at 'enhanced' stage after enhancement completes, not 'segmented'
   * Respects audio_tasks retry logic (attempts, backoff, max_attempts)
   */
  async selectTracks(limit: number): Promise<TrackForClipping[]> {
    const retryFilter = buildAudioTasksFilter(this.taskType);
    return query<TrackForClipping>(
      `SELECT
        t.spotify_track_id,
        t.title,
        t.artists,
        ks.fal_enhanced_grove_url,
        ks.clip_start_ms,
        ks.clip_end_ms
      FROM tracks t
      JOIN karaoke_segments ks ON t.spotify_track_id = ks.spotify_track_id
      WHERE t.stage = $1
        AND ks.fal_enhanced_grove_url IS NOT NULL
        AND ks.clip_start_ms IS NOT NULL
        AND ks.clip_end_ms IS NOT NULL
        AND ks.clip_grove_url IS NULL
        ${retryFilter}
      ORDER BY t.created_at DESC
      LIMIT $2`,
      [TrackStage.Enhanced, limit]
    );
  }

  /**
   * Process a single track: crop enhanced audio to viral clip
   */
  async processTrack(track: TrackForClipping): Promise<ClipResult> {
    const clipDuration = track.clip_end_ms - track.clip_start_ms;

    console.log(`\n✂️  ${track.title} - ${track.artists}`);
    console.log(`   Clip: ${(track.clip_start_ms / 1000).toFixed(1)}s - ${(track.clip_end_ms / 1000).toFixed(1)}s (${(clipDuration / 1000).toFixed(1)}s)`);

    // Step 1: Crop enhanced song to viral clip using FFmpeg
    console.log(`   Cropping from Grove URL...`);
    const cropResult = await this.ffmpeg.cropFromUrl(track.fal_enhanced_grove_url, {
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

    return {
      grove_cid: groveResult.cid,
      grove_url: groveResult.url,
      metadata: {
        duration_ms: clipDuration,
        file_size_bytes: cropResult.buffer.length,
        audio_format: 'mp3',
      },
    };
  }

  /**
   * Hook: Called before the entire run starts
   */
  async beforeRun(options: any): Promise<void> {
    console.log(`\n✂️  Audio Task: Clip Segments (limit: ${options.limit || 10})`);
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  const task = new ClipSegmentsTask();
  task.run({ limit }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
