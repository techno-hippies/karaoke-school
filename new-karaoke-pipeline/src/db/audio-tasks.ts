/**
 * Audio Tasks Management
 * Helper functions for tracking audio processing tasks with retry logic
 */

import { query } from './connection';
import {
  AudioTaskType,
  TaskStatus,
  TrackStage,
  deriveStageFromTasks,
} from './task-stages';

export interface AudioTask {
  id: number;
  subject_type: 'track' | 'tiktok_video';
  subject_id: string;
  spotify_track_id: string | null;  // Nullable for TikTok videos
  task_type: AudioTaskType;
  status: TaskStatus;
  grove_cid: string | null;
  grove_url: string | null;
  metadata: any;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  processing_duration_ms: number | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

/**
 * Create or get audio task record (polymorphic)
 * @param subjectId Subject ID (spotify_track_id or video_id)
 * @param taskType Task type to ensure
 * @param subjectType Subject type ('track' or 'tiktok_video'), defaults to 'track' for backward compatibility
 */
export async function ensureAudioTask(
  subjectId: string,
  taskType: AudioTaskType,
  subjectType: 'track' | 'tiktok_video' = 'track'
): Promise<AudioTask> {
  const existing = await query<AudioTask>(
    `SELECT * FROM audio_tasks
     WHERE subject_type = $1 AND subject_id = $2 AND task_type = $3`,
    [subjectType, subjectId, taskType]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  // For track subjects, set spotify_track_id for backward compatibility
  const spotifyTrackId = subjectType === 'track' ? subjectId : null;

  const created = await query<AudioTask>(
    `INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [subjectType, subjectId, spotifyTrackId, taskType]
  );

  return created[0];
}

/**
 * Mark task as running (polymorphic)
 */
export async function startTask(
  subjectId: string,
  taskType: AudioTaskType,
  subjectType: 'track' | 'tiktok_video' = 'track'
): Promise<void> {
  await query(
    `UPDATE audio_tasks
     SET status = 'running',
         attempts = attempts + 1,
         last_attempt_at = NOW(),
         updated_at = NOW()
     WHERE subject_type = $1 AND subject_id = $2 AND task_type = $3`,
    [subjectType, subjectId, taskType]
  );
}

/**
 * Mark task as completed with optional results (polymorphic)
 */
export async function completeTask(
  subjectId: string,
  taskType: AudioTaskType,
  subjectType: 'track' | 'tiktok_video' = 'track',
  result?: {
    grove_cid?: string;
    grove_url?: string;
    metadata?: any;
    duration_ms?: number;
  }
): Promise<void> {
  await query(
    `UPDATE audio_tasks
     SET status = 'completed',
         grove_cid = COALESCE($4, grove_cid),
         grove_url = COALESCE($5, grove_url),
         metadata = COALESCE($6::jsonb, metadata),
         processing_duration_ms = COALESCE($7, processing_duration_ms),
         completed_at = NOW(),
         updated_at = NOW()
     WHERE subject_type = $1 AND subject_id = $2 AND task_type = $3`,
    [
      subjectType,
      subjectId,
      taskType,
      result?.grove_cid || null,
      result?.grove_url || null,
      result?.metadata ? JSON.stringify(result.metadata) : null,
      result?.duration_ms || null
    ]
  );
}

/**
 * Mark task as failed with error details (polymorphic)
 */
export async function failTask(
  subjectId: string,
  taskType: AudioTaskType,
  subjectType: 'track' | 'tiktok_video' = 'track',
  error: string,
  errorDetails?: any
): Promise<void> {
  const task = await ensureAudioTask(subjectId, taskType, subjectType);

  // Calculate next retry time (exponential backoff: 5min, 15min, 30min)
  const retryDelays = [5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000];
  const nextRetry = task.attempts < task.max_attempts
    ? new Date(Date.now() + (retryDelays[task.attempts - 1] || retryDelays[2]))
    : null;

  await query(
    `UPDATE audio_tasks
     SET status = 'failed',
         error_message = $4,
         error_details = $5::jsonb,
         next_retry_at = $6,
         updated_at = NOW()
     WHERE subject_type = $1 AND subject_id = $2 AND task_type = $3`,
    [
      subjectType,
      subjectId,
      taskType,
      error,
      errorDetails ? JSON.stringify(errorDetails) : null,
      nextRetry
    ]
  );
}

/**
 * Get tasks ready for retry
 */
export async function getRetryableTasks(
  taskType: AudioTaskType,
  limit: number = 10
): Promise<AudioTask[]> {
  return query<AudioTask>(
    `SELECT * FROM audio_tasks
     WHERE task_type = $1
       AND status = 'failed'
       AND attempts < max_attempts
       AND next_retry_at <= NOW()
     ORDER BY next_retry_at ASC
     LIMIT $2`,
    [taskType, limit]
  );
}

/**
 * Get pending tasks for a specific type
 */
export async function getPendingTasks(
  taskType: AudioTaskType,
  limit: number = 10
): Promise<AudioTask[]> {
  return query<AudioTask>(
    `SELECT at.*, t.title, t.artists
     FROM audio_tasks at
     JOIN tracks t ON at.spotify_track_id = t.spotify_track_id
     WHERE at.task_type = $1
       AND at.status = 'pending'
     ORDER BY at.created_at ASC
     LIMIT $2`,
    [taskType, limit]
  );
}

/**
 * Update track stage based on completed audio tasks
 * Uses deriveStageFromTasks() for centralized stage derivation logic
 */
export async function updateTrackStage(spotifyTrackId: string): Promise<void> {
  const tasks = await query<{ task_type: string; status: string }>(
    `SELECT task_type, status FROM audio_tasks
     WHERE spotify_track_id = $1`,
    [spotifyTrackId]
  );

  // Get completed task types
  const completedTaskTypes = tasks
    .filter(t => t.status === 'completed')
    .map(t => t.task_type as AudioTaskType);

  // Derive new stage using centralized logic
  const newStage = deriveStageFromTasks(completedTaskTypes);

  await query(
    `UPDATE tracks
     SET stage = $2, updated_at = NOW()
     WHERE spotify_track_id = $1`,
    [spotifyTrackId, newStage]
  );
}

/**
 * Get task completion summary for a track
 */
export async function getTaskSummary(spotifyTrackId: string): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
  tasks: Record<string, string>;
}> {
  const tasks = await query<{ task_type: string; status: string }>(
    `SELECT task_type, status FROM audio_tasks
     WHERE spotify_track_id = $1
     ORDER BY task_type`,
    [spotifyTrackId]
  );

  const summary = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    tasks: {} as Record<string, string>
  };

  tasks.forEach(t => {
    summary.tasks[t.task_type] = t.status;
  });

  return summary;
}
