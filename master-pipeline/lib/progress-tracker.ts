/**
 * Progress Tracking System
 *
 * Tracks video processing progress for robust batch operations with resume capability
 */

import { readJson, writeJson, ensureDir } from './fs.js';
import { paths } from './config.js';

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface VideoProgress {
  videoId: string;
  status: VideoStatus;
  videoHash?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
  lastRetryAt?: string;
  steps: {
    download?: boolean;
    stt?: boolean;
    translate?: boolean;
    grove?: boolean;
    story?: boolean;
    lens?: boolean;
  };
}

export interface BatchProgress {
  creatorHandle: string;
  startedAt: string;
  updatedAt: string;
  totalVideos: number;
  completed: number;
  failed: number;
  skipped: number;
  videos: Record<string, VideoProgress>;
}

export class ProgressTracker {
  private creatorHandle: string;
  private progressPath: string;
  private progress: BatchProgress;

  constructor(creatorHandle: string) {
    this.creatorHandle = creatorHandle;
    const creatorDir = paths.creator(creatorHandle);
    ensureDir(creatorDir);
    this.progressPath = `${creatorDir}/progress.json`;
    this.progress = this.load();
  }

  /**
   * Load existing progress or create new
   */
  private load(): BatchProgress {
    try {
      return readJson<BatchProgress>(this.progressPath);
    } catch {
      return {
        creatorHandle: this.creatorHandle,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalVideos: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        videos: {},
      };
    }
  }

  /**
   * Save progress to disk
   */
  private save() {
    this.progress.updatedAt = new Date().toISOString();
    writeJson(this.progressPath, this.progress);
  }

  /**
   * Initialize tracking for a list of videos
   */
  initializeVideos(videoIds: string[]) {
    this.progress.totalVideos = videoIds.length;

    for (const videoId of videoIds) {
      if (!this.progress.videos[videoId]) {
        this.progress.videos[videoId] = {
          videoId,
          status: 'pending',
          retryCount: 0,
          steps: {},
        };
      }
    }

    this.save();
  }

  /**
   * Mark video as started
   */
  markStarted(videoId: string) {
    const video = this.progress.videos[videoId];
    if (video) {
      video.status = 'processing';
      video.startedAt = new Date().toISOString();
      this.save();
    }
  }

  /**
   * Mark video as completed
   */
  markCompleted(videoId: string, videoHash: string) {
    const video = this.progress.videos[videoId];
    if (video) {
      video.status = 'completed';
      video.videoHash = videoHash;
      video.completedAt = new Date().toISOString();
      this.progress.completed++;
      this.save();
    }
  }

  /**
   * Mark video as failed
   */
  markFailed(videoId: string, error: Error, maxRetries: number = 3) {
    const video = this.progress.videos[videoId];
    if (video) {
      video.retryCount++;
      video.lastRetryAt = new Date().toISOString();
      video.error = error.message;

      if (video.retryCount >= maxRetries) {
        video.status = 'failed';
        this.progress.failed++;
      } else {
        video.status = 'pending'; // Reset to pending for retry
      }

      this.save();
    }
  }

  /**
   * Mark video as skipped (already processed)
   */
  markSkipped(videoId: string, videoHash: string) {
    const video = this.progress.videos[videoId];
    if (video) {
      video.status = 'skipped';
      video.videoHash = videoHash;
      video.completedAt = new Date().toISOString();
      this.progress.skipped++;
      this.save();
    }
  }

  /**
   * Update step completion
   */
  updateStep(videoId: string, step: keyof VideoProgress['steps'], completed: boolean) {
    const video = this.progress.videos[videoId];
    if (video) {
      video.steps[step] = completed;
      this.save();
    }
  }

  /**
   * Get videos ready for processing (pending or failed with retries available)
   */
  getResumableVideos(maxRetries: number = 3): VideoProgress[] {
    return Object.values(this.progress.videos).filter(
      (v) =>
        v.status === 'pending' ||
        (v.status === 'failed' && v.retryCount < maxRetries)
    );
  }

  /**
   * Get all failed videos
   */
  getFailedVideos(): VideoProgress[] {
    return Object.values(this.progress.videos).filter((v) => v.status === 'failed');
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      total: this.progress.totalVideos,
      completed: this.progress.completed,
      failed: this.progress.failed,
      skipped: this.progress.skipped,
      pending: Object.values(this.progress.videos).filter((v) => v.status === 'pending').length,
      processing: Object.values(this.progress.videos).filter((v) => v.status === 'processing')
        .length,
      successRate:
        this.progress.totalVideos > 0
          ? ((this.progress.completed / this.progress.totalVideos) * 100).toFixed(1)
          : '0.0',
    };
  }

  /**
   * Reset progress for all videos
   */
  reset() {
    this.progress = {
      creatorHandle: this.creatorHandle,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalVideos: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      videos: {},
    };
    this.save();
  }

  /**
   * Generate summary report
   */
  generateReport(): string {
    const stats = this.getStats();
    const failedVideos = this.getFailedVideos();

    let report = '\n════════════════════════════════════════════════════════════\n';
    report += '📊 Batch Processing Report\n';
    report += '════════════════════════════════════════════════════════════\n\n';
    report += `Creator: @${this.creatorHandle}\n`;
    report += `Started: ${this.progress.startedAt}\n`;
    report += `Updated: ${this.progress.updatedAt}\n\n`;
    report += 'Statistics:\n';
    report += `  • Total videos: ${stats.total}\n`;
    report += `  • Completed: ${stats.completed}\n`;
    report += `  • Skipped (already processed): ${stats.skipped}\n`;
    report += `  • Failed: ${stats.failed}\n`;
    report += `  • Pending: ${stats.pending}\n`;
    report += `  • Success rate: ${stats.successRate}%\n\n`;

    if (failedVideos.length > 0) {
      report += 'Failed Videos:\n';
      for (const video of failedVideos) {
        report += `  • ${video.videoId} (${video.retryCount} retries)\n`;
        report += `    Error: ${video.error}\n`;
      }
    }

    report += '════════════════════════════════════════════════════════════\n';

    return report;
  }
}

/**
 * Checkpoint Manager for sequential operations with rollback
 */
export class CheckpointManager {
  private creatorHandle: string;
  private checkpointPath: string;
  private checkpoints: Record<string, { completed: boolean; timestamp: string; error?: string }>;

  constructor(creatorHandle: string) {
    this.creatorHandle = creatorHandle;
    const creatorDir = paths.creator(creatorHandle);
    ensureDir(creatorDir);
    this.checkpointPath = `${creatorDir}/checkpoints.json`;
    this.checkpoints = this.load();
  }

  private load(): Record<string, { completed: boolean; timestamp: string; error?: string }> {
    try {
      return readJson(this.checkpointPath);
    } catch {
      return {};
    }
  }

  private save() {
    writeJson(this.checkpointPath, this.checkpoints);
  }

  /**
   * Run a checkpoint step
   */
  async run<T>(name: string, fn: () => Promise<T>): Promise<T> {
    // Skip if already completed
    if (this.checkpoints[name]?.completed) {
      console.log(`✓ Checkpoint '${name}' already completed, skipping...`);
      return undefined as T; // Return undefined for skipped checkpoints
    }

    try {
      console.log(`→ Running checkpoint: ${name}...`);
      const result = await fn();

      this.checkpoints[name] = {
        completed: true,
        timestamp: new Date().toISOString(),
      };
      this.save();

      console.log(`✓ Checkpoint '${name}' completed`);
      return result;
    } catch (error: any) {
      this.checkpoints[name] = {
        completed: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
      this.save();

      throw error;
    }
  }

  /**
   * Check if a checkpoint is completed
   */
  isCompleted(name: string): boolean {
    return this.checkpoints[name]?.completed || false;
  }

  /**
   * Get last completed checkpoint
   */
  getLastCompleted(): string | null {
    const completed = Object.entries(this.checkpoints)
      .filter(([_, v]) => v.completed)
      .sort((a, b) => new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime());

    return completed.length > 0 ? completed[0][0] : null;
  }

  /**
   * Reset all checkpoints
   */
  reset() {
    this.checkpoints = {};
    this.save();
  }
}
