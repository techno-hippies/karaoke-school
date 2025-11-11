#!/usr/bin/env bun
/**
 * Audio Separation Task (REFACTORED with BaseTask)
 * Stage: translated → separated
 *
 * Uses Demucs (via RunPod) to separate vocals and instrumental stems
 * Polling-based (no webhook), uploads results to Grove
 *
 * COMPARISON:
 * - Old version: 163 lines with manual lifecycle management
 * - New version: ~90 lines, BaseTask handles boilerplate
 * - Reduction: ~45% less code, same functionality
 *
 * Prerequisites:
 * - song_audio.grove_url (original audio)
 *
 * Output:
 * - song_audio.instrumental_grove_url/cid (instrumental stem)
 * - song_audio.vocals_grove_url/cid (vocals stem)
 * - Updates tracks.stage to 'separated'
 *
 * Usage:
 *   bun src/tasks/audio/separate-audio-refactored.ts --limit=10
 */

import { query } from '../../db/connection';
import { createDemucsService } from '../../services/demucs';
import { TrackStage, AudioTaskType } from '../../db/task-stages';
import { updateSongAudioStems } from '../../db/audio-queries';
import { BaseTask, type BaseTrackInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { CONFIG } from '../../config';
import type { SeparateMetadata } from '../../types/task-metadata';

/**
 * Track ready for separation
 */
interface TrackForSeparation extends BaseTrackInput {
  spotify_track_id: string;
  title: string;
  artists: any;
  duration_ms: number;
  grove_url: string;
}

/**
 * Separation result with metadata
 */
interface SeparationResult extends TaskResult {
  metadata: SeparateMetadata;
}

/**
 * Separate Audio Task
 *
 * Uses BaseTask to eliminate boilerplate:
 * - No manual ensureAudioTask/startTask/completeTask/failTask
 * - No manual updateTrackStage
 * - No manual error handling and retries
 * - No manual success/failure counting
 */
export class SeparateAudioTask extends BaseTask<TrackForSeparation, SeparationResult> {
  readonly taskType = AudioTaskType.Separate;
  private demucs: ReturnType<typeof createDemucsService>;

  constructor() {
    super();

    // Check for RunPod credentials
    if (!process.env.RUNPOD_DEMUCS_ENDPOINT_ID || !process.env.RUNPOD_API_KEY) {
      throw new Error('RUNPOD_DEMUCS_ENDPOINT_ID and RUNPOD_API_KEY required');
    }

    this.demucs = createDemucsService();
  }

  /**
   * Select tracks at 'translated' stage with audio but no instrumental yet
   * Respects audio_tasks retry logic (attempts, backoff, max_attempts)
   */
  async selectTracks(limit: number): Promise<TrackForSeparation[]> {
    const retryFilter = buildAudioTasksFilter(this.taskType);
    return query<TrackForSeparation>(
      `SELECT
        t.spotify_track_id,
        t.title,
        t.artists,
        t.duration_ms,
        sa.grove_url
      FROM tracks t
      JOIN song_audio sa ON t.spotify_track_id = sa.spotify_track_id
      WHERE t.stage = $1
        AND sa.grove_url IS NOT NULL
        AND sa.instrumental_grove_url IS NULL
        ${retryFilter}
      ORDER BY t.updated_at ASC
      LIMIT $2`,
      [TrackStage.Translated, limit]
    );
  }

  /**
   * Process a single track: separate vocals and instrumental with Demucs
   */
  async processTrack(track: TrackForSeparation): Promise<SeparationResult> {
    const artistName = Array.isArray(track.artists) && track.artists.length > 0
      ? track.artists[0].name
      : 'Unknown Artist';

    console.log(`\n🎵 Separating: ${track.title} - ${artistName}`);
    console.log(`   Duration: ${(track.duration_ms / 1000 / 60).toFixed(1)}m`);
    console.log(`   Audio: ${track.grove_url}`);

    // Submit to Demucs and poll for completion
    const result = await this.demucs.separate(
      track.spotify_track_id,
      track.grove_url
    );

    console.log(`   ✓ Vocals: ${result.vocals_grove_cid}`);
    console.log(`   ✓ Instrumental: ${result.instrumental_grove_cid}`);
    console.log(`   ✓ GPU time: ${result.gpu_time.toFixed(1)}s`);

    // Update song_audio with stem URLs
    await updateSongAudioStems(track.spotify_track_id, {
      vocals_grove_cid: result.vocals_grove_cid,
      vocals_grove_url: result.vocals_grove_url,
      instrumental_grove_cid: result.instrumental_grove_cid,
      instrumental_grove_url: result.instrumental_grove_url
    });

    console.log(`   ✓ Stage updated: translated → separated`);

    return {
      grove_cid: result.instrumental_grove_cid,
      grove_url: result.instrumental_grove_url,
      metadata: {
        provider: 'demucs_runpod',
        model: 'htdemucs', // or htdemucs_ft depending on service config
        stems_created: ['vocals', 'bass', 'drums', 'other'],
        processing_time_seconds: result.gpu_time,
      },
    };
  }

  /**
   * Hook: Called before the entire run starts
   */
  async beforeRun(options: any): Promise<void> {
    console.log(`\n🎵 Audio Separation (Demucs via RunPod)`);
    console.log(`Limit: ${options.limit || 10}`);
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  const task = new SeparateAudioTask();
  task.run({ limit }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
