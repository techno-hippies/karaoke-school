/**
 * Base Task Abstraction
 *
 * Eliminates boilerplate by providing a standard lifecycle for audio processing tasks.
 * All tasks follow the pattern: select → process → track lifecycle → update stage
 *
 * Benefits:
 * - DRY: Removes ~50 lines of repeated code per task file
 * - Consistency: Standardized error handling and retry logic
 * - Testability: Easy to mock and test individual methods
 * - Maintainability: Lifecycle changes happen in one place
 *
 * Usage:
 * ```typescript
 * export class TranslateLyricsTask extends BaseTask<TrackForTranslation, TranslationResult> {
 *   taskType = AudioTaskType.Translate;
 *
 *   async selectTracks(limit: number) {
 *     return query(`SELECT * FROM tracks WHERE stage = 'aligned' LIMIT $1`, [limit]);
 *   }
 *
 *   async processTrack(track: TrackForTranslation) {
 *     return translator.translate(track.lyrics, ['zh', 'vi', 'id']);
 *   }
 * }
 *
 * // Run the task
 * const task = new TranslateLyricsTask();
 * await task.run({ limit: 10 });
 * ```
 */

import { query } from '../db/connection';
import {
  ensureAudioTask,
  startTask,
  completeTask,
  failTask,
  type AudioTask,
} from '../db/audio-tasks';
import { updateTrackStage } from '../db/audio-tasks';
import type { AudioTaskType } from '../db/task-stages';

/**
 * Base interface for tracks that can be processed
 * All track types must have a spotify_track_id
 */
export interface BaseTrackInput {
  spotify_track_id: string;
  [key: string]: any;
}

/**
 * Result from task processing
 * Includes optional Grove storage URLs and processing metadata
 */
export interface TaskResult {
  grove_cid?: string;
  grove_url?: string;
  metadata?: Record<string, any>;
  duration_ms?: number;
}

/**
 * Options for running a task
 */
export interface RunOptions {
  limit?: number;
  trackId?: string;  // Process specific track
  skipStageUpdate?: boolean;  // Skip automatic stage update (for testing)
}

/**
 * Abstract base class for all audio processing tasks
 *
 * Subclasses must implement:
 * - taskType: The AudioTaskType enum value
 * - selectTracks(): Query to get pending tracks
 * - processTrack(): Core business logic
 */
export abstract class BaseTask<TInput extends BaseTrackInput, TResult extends TaskResult> {
  /**
   * Task type identifier (e.g., AudioTaskType.Translate)
   * Must be implemented by subclass
   */
  abstract readonly taskType: AudioTaskType;

  /**
   * Select tracks ready for processing
   *
   * @param limit Maximum number of tracks to return
   * @returns Array of tracks to process
   */
  abstract selectTracks(limit: number): Promise<TInput[]>;

  /**
   * Process a single track
   *
   * Core business logic goes here. Should be idempotent.
   *
   * @param track Track to process
   * @returns Processing result with optional Grove URLs and metadata
   */
  abstract processTrack(track: TInput): Promise<TResult>;

  /**
   * Optional hook: Called before processing starts
   * Override to add custom initialization logic
   */
  async beforeRun?(options: RunOptions): Promise<void>;

  /**
   * Optional hook: Called after all tracks are processed
   * Override to add custom cleanup or summary logic
   */
  async afterRun?(results: { success: number; failed: number }): Promise<void>;

  /**
   * Optional hook: Called before processing each track
   * Override for per-track setup (e.g., rate limiting, logging)
   */
  async beforeProcessTrack?(track: TInput): Promise<void>;

  /**
   * Optional hook: Called after processing each track (success or failure)
   * Override for per-track cleanup
   */
  async afterProcessTrack?(track: TInput, error?: Error): Promise<void>;

  /**
   * Run the task with automatic lifecycle management
   *
   * Handles:
   * - Track selection
   * - audio_tasks lifecycle (pending → running → completed/failed)
   * - Error handling and retry logic
   * - Stage updates
   * - Execution summary
   *
   * @param options Run options (limit, specific trackId, etc.)
   */
  async run(options: RunOptions = {}): Promise<void> {
    const { limit = 10, trackId, skipStageUpdate = false } = options;

    // Call beforeRun hook if defined
    if (this.beforeRun) {
      await this.beforeRun(options);
    }

    // Select tracks to process
    let tracks: TInput[];
    if (trackId) {
      // Process specific track
      const selected = await this.selectTracks(1);
      tracks = selected.filter(t => t.spotify_track_id === trackId);

      if (tracks.length === 0) {
        console.log(`Track ${trackId} not found or not ready for ${this.taskType}`);
        return;
      }
    } else {
      // Process batch
      tracks = await this.selectTracks(limit);
    }

    if (tracks.length === 0) {
      console.log(`No tracks ready for ${this.taskType}`);
      return;
    }

    console.log(`\n📋 Processing ${tracks.length} track(s) for task: ${this.taskType}\n`);

    let successCount = 0;
    let failedCount = 0;

    // Process each track with full lifecycle management
    for (const track of tracks) {
      try {
        await this.runWithLifecycle(track, skipStageUpdate);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed to process ${track.spotify_track_id}: ${error.message}`);
        failedCount++;
      }
    }

    // Print summary
    console.log(`\n✅ Task complete: ${successCount} succeeded, ${failedCount} failed\n`);

    // Call afterRun hook if defined
    if (this.afterRun) {
      await this.afterRun({ success: successCount, failed: failedCount });
    }
  }

  /**
   * Process a single track with full lifecycle management
   *
   * Private helper that wraps processTrack() with:
   * - audio_tasks updates (running → completed/failed)
   * - Error handling
   * - Stage recalculation
   * - Hooks
   *
   * @param track Track to process
   * @param skipStageUpdate Skip automatic stage update
   */
  private async runWithLifecycle(track: TInput, skipStageUpdate: boolean): Promise<void> {
    const trackId = track.spotify_track_id;

    // Ensure task record exists
    await ensureAudioTask(trackId, this.taskType);

    // Mark as running
    await startTask(trackId, this.taskType);

    try {
      // Call beforeProcessTrack hook if defined
      if (this.beforeProcessTrack) {
        await this.beforeProcessTrack(track);
      }

      // Execute core business logic
      const startTime = Date.now();
      const result = await this.processTrack(track);
      const duration = Date.now() - startTime;

      // Mark as completed with result
      await completeTask(trackId, this.taskType, {
        grove_cid: result.grove_cid,
        grove_url: result.grove_url,
        metadata: result.metadata,
        duration_ms: result.duration_ms || duration,
      });

      // Update track stage (unless explicitly skipped)
      if (!skipStageUpdate) {
        await updateTrackStage(trackId);
      }

      // Call afterProcessTrack hook if defined
      if (this.afterProcessTrack) {
        await this.afterProcessTrack(track);
      }

      console.log(`✓ Processed: ${trackId} (${duration}ms)`);
    } catch (error: any) {
      // Mark as failed with error details
      await failTask(trackId, this.taskType, error.message, {
        error_type: error.name,
        stack: error.stack,
      });

      // Call afterProcessTrack hook with error
      if (this.afterProcessTrack) {
        await this.afterProcessTrack(track, error);
      }

      // Re-throw to be caught by outer handler
      throw error;
    }
  }
}
