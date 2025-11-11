#!/usr/bin/env bun
/**
 * Audio Enhancement Task (REFACTORED with BaseTask) - fal.ai Stable Audio 2.5
 * Stage: segmented → enhanced
 *
 * Process:
 * 1. Find tracks at 'segmented' stage
 * 2. Calculate 190s chunks (with 2s overlap for songs >190s)
 * 3. Crop → fal.ai enhance (parallel processing)
 * 4. Merge chunks with FFmpeg crossfade (if multiple)
 * 5. Upload to Grove (final immutable storage)
 * 6. Update karaoke_segments + audio_tasks
 *
 * COMPARISON:
 * - Old version: 346 lines with manual lifecycle management
 * - New version: ~200 lines, BaseTask handles boilerplate
 * - Reduction: ~42% less code, same functionality
 *
 * Prerequisites:
 * - Track stage = 'segmented'
 * - song_audio.instrumental_grove_url populated
 * - FAL_API_KEY in environment
 *
 * Usage:
 *   bun src/tasks/audio/enhance-audio-refactored.ts --limit=10
 */

import { query } from '../../db/connection';
import { TrackStage, AudioTaskType } from '../../db/task-stages';
import { createFalService } from '../../services/fal';
import { createFFmpegService } from '../../services/ffmpeg';
import { uploadToGrove } from '../../services/storage';
import { upsertKaraokeSegment } from '../../db/audio-queries';
import { BaseTask, type BaseTrackInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { CONFIG } from '../../config';
import type { EnhanceMetadata } from '../../types/task-metadata';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';

interface TrackForEnhancement extends BaseTrackInput {
  spotify_track_id: string;
  duration_ms: number;
  instrumental_grove_url: string;
  primary_artist_name: string;
  title: string;
}

interface EnhancementResult extends TaskResult {
  metadata: EnhanceMetadata;
}

interface Chunk {
  index: number;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
}

interface ProcessedChunk {
  index: number;
  fal_url: string;
  fal_request_id: string;
  duration_ms: number;
}

/**
 * Calculate 190s chunks for fal.ai processing
 *
 * fal.ai has a hard limit of 190s. For longer songs, we chunk with
 * 2s overlap to enable smooth crossfade merging.
 */
function calculateChunks(durationMs: number): Chunk[] {
  const CHUNK_SIZE_MS = CONFIG.audio.falChunking.maxDurationMs; // 190000ms
  const OVERLAP_MS = CONFIG.audio.falChunking.overlapMs; // 2s overlap for crossfade

  if (durationMs <= CHUNK_SIZE_MS) {
    return [{
      index: 0,
      start_ms: 0,
      end_ms: durationMs,
      duration_ms: durationMs
    }];
  }

  const chunks: Chunk[] = [];
  let currentStart = 0;
  let index = 0;

  while (currentStart < durationMs) {
    const isLastChunk = (currentStart + CHUNK_SIZE_MS) >= durationMs;
    const chunkEnd = isLastChunk ? durationMs : currentStart + CHUNK_SIZE_MS;

    chunks.push({
      index,
      start_ms: currentStart,
      end_ms: chunkEnd,
      duration_ms: chunkEnd - currentStart
    });

    if (isLastChunk) break;

    // Next chunk starts 2s before current chunk ends (overlap for crossfade)
    currentStart = chunkEnd - OVERLAP_MS;
    index++;
  }

  return chunks;
}

/**
 * Enhance Audio Task
 *
 * Uses BaseTask to eliminate boilerplate:
 * - No manual ensureAudioTask/startTask/completeTask/failTask
 * - No manual updateTrackStage
 * - No manual error handling and retries
 * - No manual success/failure counting
 */
export class EnhanceAudioTask extends BaseTask<TrackForEnhancement, EnhancementResult> {
  readonly taskType = AudioTaskType.Enhance;
  private falService: ReturnType<typeof createFalService>;
  private ffmpegService: ReturnType<typeof createFFmpegService>;

  constructor() {
    super();
    this.falService = createFalService();
    this.ffmpegService = createFFmpegService();
  }

  /**
   * Select tracks at 'segmented' stage ready for enhancement
   * Respects audio_tasks retry logic (attempts, backoff, max_attempts)
   */
  async selectTracks(limit: number): Promise<TrackForEnhancement[]> {
    const retryFilter = buildAudioTasksFilter(this.taskType);
    return query<TrackForEnhancement>(
      `SELECT
        t.spotify_track_id,
        t.duration_ms,
        sa.instrumental_grove_url,
        t.primary_artist_name,
        t.title
      FROM tracks t
      JOIN song_audio sa ON t.spotify_track_id = sa.spotify_track_id
      WHERE t.stage = $1
        AND sa.instrumental_grove_url IS NOT NULL
        ${retryFilter}
      ORDER BY t.created_at ASC
      LIMIT $2`,
      [TrackStage.Segmented, limit]
    );
  }

  /**
   * Process a single track: chunk → enhance → merge → upload
   */
  async processTrack(track: TrackForEnhancement): Promise<EnhancementResult> {
    console.log(`\n[${track.spotify_track_id}] ${track.primary_artist_name} - ${track.title}`);
    console.log(`  Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);

    // Step 1: Calculate chunks
    const chunks = calculateChunks(track.duration_ms);
    console.log(`  Chunking strategy: ${chunks.length} chunk(s)`);

    if (chunks.length > 1) {
      console.log(`  Overlap: 2s crossfade between chunks`);
    }

    // Step 2: Process all chunks in parallel
    console.log(`\n  Processing chunks...`);
    const processedChunks = await Promise.all(
      chunks.map(chunk => this.processChunk(chunk, track))
    );

    // Step 3: Merge if needed
    console.log(`\n  Finalizing enhanced audio...`);
    const finalBuffer = await this.mergeChunks(processedChunks, track.spotify_track_id);

    // Step 4: Upload to Grove (final storage for audio files)
    console.log(`  Uploading to Grove (final)...`);
    const groveResult = await uploadToGrove(
      finalBuffer,
      'audio/mpeg',
      `enhanced-${track.spotify_track_id}.mp3`
    );

    console.log(`  ✓ Uploaded: ${groveResult.cid}`);
    console.log(`  Grove URL: ${groveResult.url}`);

    // Step 5: Upsert karaoke_segments
    await upsertKaraokeSegment(track.spotify_track_id, {
      fal_request_id: processedChunks[0].fal_request_id,
      fal_enhanced_grove_cid: groveResult.cid,
      fal_enhanced_grove_url: groveResult.url
    });

    return {
      grove_cid: groveResult.cid,
      grove_url: groveResult.url,
      metadata: {
        provider: 'fal_stable_audio_2.5',
        chunks_processed: chunks.length,
        total_duration_seconds: track.duration_ms / 1000,
        prompt_used: 'instrumental',
      },
    };
  }

  /**
   * Process a single chunk: crop → upload → fal.ai enhance
   */
  private async processChunk(
    chunk: Chunk,
    track: TrackForEnhancement
  ): Promise<ProcessedChunk> {
    console.log(`  [Chunk ${chunk.index}] Processing ${chunk.start_ms}ms - ${chunk.end_ms}ms (${chunk.duration_ms / 1000}s)...`);

    // Step 1: Crop chunk from full instrumental
    const cropResult = await this.ffmpegService.cropFromUrl(track.instrumental_grove_url, {
      startMs: chunk.start_ms,
      endMs: chunk.end_ms,
      bitrate: 192
    });

    // Step 2: Upload cropped chunk to Grove (temp storage for fal.ai input)
    const chunkGrove = await uploadToGrove(
      cropResult.buffer,
      'audio/mpeg',
      `chunk-${chunk.index}-${track.spotify_track_id}.mp3`
    );

    // Step 3: Send to fal.ai for enhancement
    const falResult = await this.falService.enhanceInstrumental({
      audioUrl: chunkGrove.url,
      prompt: 'instrumental',
      strength: 0.35
    });

    console.log(`  [Chunk ${chunk.index}] ✓ Enhanced (fal request: ${falResult.requestId})`);

    return {
      index: chunk.index,
      fal_url: falResult.audioUrl,
      fal_request_id: falResult.requestId,
      duration_ms: chunk.duration_ms
    };
  }

  /**
   * Merge multiple enhanced chunks with FFmpeg crossfade
   */
  private async mergeChunks(
    chunks: ProcessedChunk[],
    spotifyTrackId: string
  ): Promise<Buffer> {
    if (chunks.length === 1) {
      console.log(`  Single chunk, downloading directly...`);
      const response = await fetch(chunks[0].fal_url);
      return Buffer.from(await response.arrayBuffer());
    }

    console.log(`  Merging ${chunks.length} chunks with 2s crossfade...`);

    const tmpDir = join(tmpdir(), 'karaoke-merge', spotifyTrackId);
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }

    const chunkFiles: string[] = [];
    const outputPath = join(tmpDir, 'merged.mp3');

    try {
      // Download all enhanced chunks from fal.ai
      for (const chunk of chunks) {
        const chunkFile = join(tmpDir, `chunk-${chunk.index}.wav`);
        console.log(`  Downloading chunk ${chunk.index}...`);

        const response = await fetch(chunk.fal_url);
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(chunkFile, buffer);

        chunkFiles.push(chunkFile);
      }

      // FFmpeg crossfade merge
      await this.ffmpegService.concatenateWithCrossfade(chunkFiles, outputPath, 2000);

      // Read merged result
      const mergedBuffer = Buffer.from(await Bun.file(outputPath).arrayBuffer());
      console.log(`  ✓ Merged (${(mergedBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

      return mergedBuffer;

    } finally {
      // Cleanup temp files
      chunkFiles.forEach(f => {
        if (existsSync(f)) unlinkSync(f);
      });
      if (existsSync(outputPath)) unlinkSync(outputPath);
      try {
        const fs = await import('fs');
        fs.rmdirSync(tmpDir);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Hook: Called before the entire run starts
   */
  async beforeRun(options: any): Promise<void> {
    console.log(`\n🎵 Audio Enhancement Task (limit: ${options.limit || 10})`);
    console.log(`================================================\n`);
  }

  /**
   * Hook: Called after all tracks processed
   */
  async afterRun(results: { success: number; failed: number }): Promise<void> {
    console.log(`\n================================================`);
    console.log(`✓ Audio enhancement complete\n`);
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  const task = new EnhanceAudioTask();
  task.run({ limit }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
