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
 * Base interface for subjects that can be processed
 * Supports polymorphic subjects (tracks, TikTok videos, etc.)
 */
export interface BaseSubjectInput {
  subject_id: string;           // Polymorphic ID (spotify_track_id or video_id)
  subject_type: 'track' | 'tiktok_video';  // Subject type discriminator
  [key: string]: any;
}

/**
 * @deprecated Use BaseSubjectInput instead for polymorphic support
 * Kept for backward compatibility with track-specific tasks
 */
export interface BaseTrackInput extends BaseSubjectInput {
  spotify_track_id: string;
  subject_type: 'track';
  subject_id: string;  // Same as spotify_track_id for tracks
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
 * Helper: Build WHERE clause to filter by audio_tasks status/retry logic
 * This ensures we respect exponential backoff and max attempts
 *
 * Supports polymorphic subjects (tracks, TikTok videos) via subject_type/subject_id
 *
 * @param taskType Task type to filter for
 * @param subjectType Type of subject ('track' or 'tiktok_video')
 * @param subjectIdColumn Column name containing subject ID (default: 'spotify_track_id' for backward compatibility)
 */
export function buildAudioTasksFilter(
  taskType: string,
  subjectType: 'track' | 'tiktok_video' = 'track',
  subjectIdColumn: string = 'spotify_track_id'
): string {
  return `
    AND (
      -- No task record yet (pending)
      NOT EXISTS (
        SELECT 1 FROM audio_tasks
        WHERE subject_type = '${subjectType}'
          AND subject_id = t.${subjectIdColumn}
          AND task_type = '${taskType}'
      )
      -- Or task is pending/failed and ready for retry
      OR EXISTS (
        SELECT 1 FROM audio_tasks
        WHERE subject_type = '${subjectType}'
          AND subject_id = t.${subjectIdColumn}
          AND task_type = '${taskType}'
          AND status IN ('pending', 'failed')
          AND attempts < max_attempts
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      )
    )
  `;
}

/**
 * Abstract base class for all audio processing tasks
 *
 * Subclasses must implement:
 * - taskType: The AudioTaskType enum value
 * - selectTracks(): Query to get pending tracks
 * - processTrack(): Core business logic
 *
 * IMPORTANT: selectTracks() queries should use buildAudioTasksFilter(taskType, subjectType, subjectIdColumn)
 * to ensure proper retry logic and prevent reprocessing exhausted tasks
 */
export abstract class BaseTask<TInput extends BaseSubjectInput, TResult extends TaskResult> {
  /**
   * Task type identifier (e.g., AudioTaskType.Translate)
   * Must be implemented by subclass
   */
  abstract readonly taskType: AudioTaskType;

  /**
   * Subject type for this task ('track' or 'tiktok_video')
   * Defaults to 'track' for backward compatibility
   */
  readonly subjectType: 'track' | 'tiktok_video' = 'track';

  /**
   * Select tracks ready for processing
   *
   * @param limit Maximum number of tracks to return
   * @param trackId Optional specific track ID to select
   * @returns Array of tracks to process
   */
  abstract selectTracks(limit: number, trackId?: string): Promise<TInput[]>;

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
    const tracks = trackId
      ? await this.selectTracks(1, trackId)  // Pass trackId to selectTracks
      : await this.selectTracks(limit);

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
   * Process a single subject with full lifecycle management
   *
   * Private helper that wraps processTrack() with:
   * - audio_tasks updates (running → completed/failed)
   * - Error handling
   * - Stage recalculation
   * - Hooks
   *
   * @param subject Subject to process (track or TikTok video)
   * @param skipStageUpdate Skip automatic stage update
   */
  private async runWithLifecycle(subject: TInput, skipStageUpdate: boolean): Promise<void> {
    // Backward compatibility: infer subject_id/subject_type for legacy track tasks
    // that only project spotify_track_id without the new polymorphic fields
    const subjectId = subject.subject_id || (subject as any).spotify_track_id;
    const subjectType = subject.subject_type || this.subjectType;

    // Ensure task record exists
    await ensureAudioTask(subjectId, this.taskType, subjectType);

    // Mark as running
    await startTask(subjectId, this.taskType, subjectType);

    try {
      // Call beforeProcessTrack hook if defined
      if (this.beforeProcessTrack) {
        await this.beforeProcessTrack(subject);
      }

      // Execute core business logic
      const startTime = Date.now();
      const result = await this.processTrack(subject);
      const duration = Date.now() - startTime;

      // Mark as completed with result
      await completeTask(subjectId, this.taskType, subjectType, {
        grove_cid: result.grove_cid,
        grove_url: result.grove_url,
        metadata: result.metadata,
        duration_ms: result.duration_ms || duration,
      });

      // Update track stage (unless explicitly skipped or if subject is TikTok video)
      if (!skipStageUpdate && subjectType === 'track') {
        await updateTrackStage(subjectId);
      }

      // Call afterProcessTrack hook if defined
      if (this.afterProcessTrack) {
        await this.afterProcessTrack(subject);
      }

      console.log(`✓ Processed: ${subjectId} (${duration}ms)`);
    } catch (error: any) {
      // Mark as failed with error details
      await failTask(subjectId, this.taskType, subjectType, error.message, {
        error_type: error.name,
        stack: error.stack,
      });

      // Call afterProcessTrack hook with error
      if (this.afterProcessTrack) {
        await this.afterProcessTrack(subject, error);
      }

      // Re-throw to be caught by outer handler
      throw error;
    }
  }
}
