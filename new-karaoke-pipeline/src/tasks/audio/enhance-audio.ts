#!/usr/bin/env bun
/**
 * Audio Enhancement Task - fal.ai Stable Audio 2.5
 *
 * Process:
 * 1. Find tracks at 'segmented' stage
 * 2. Calculate 190s chunks (with 2s overlap for songs >190s)
 * 3. Crop → fal.ai enhance (parallel processing)
 * 4. Merge chunks with FFmpeg crossfade (if multiple)
 * 5. Upload to load.network (final immutable storage)
 * 6. Update karaoke_segments + audio_tasks
 *
 * Prerequisites:
 * - Track stage = 'segmented'
 * - song_audio.instrumental_grove_url populated
 * - FAL_API_KEY in environment
 * - PRIVATE_KEY for load.network wallet
 *
 * Usage:
 *   bun src/tasks/audio/enhance-audio.ts --limit=10
 */

import { query } from '../../db/connection';
import { ensureAudioTask, startTask, completeTask, failTask, updateTrackStage } from '../../db/audio-tasks';
import { TrackStage } from '../../db/task-stages';
import { createFalService } from '../../services/fal';
import { createFFmpegService } from '../../services/ffmpeg';
import { uploadToGrove } from '../../services/storage';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';

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
  const CHUNK_SIZE_MS = 190000; // fal.ai hard limit
  const OVERLAP_MS = 2000;      // 2s overlap for crossfade

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
 * Process a single chunk: crop → upload → fal.ai enhance
 */
async function processChunk(
  chunk: Chunk,
  track: { spotify_track_id: string; instrumental_grove_url: string },
  falService: ReturnType<typeof createFalService>,
  ffmpegService: ReturnType<typeof createFFmpegService>
): Promise<ProcessedChunk> {
  console.log(`  [Chunk ${chunk.index}] Processing ${chunk.start_ms}ms - ${chunk.end_ms}ms (${chunk.duration_ms / 1000}s)...`);

  // Step 1: Crop chunk from full instrumental
  const cropResult = await ffmpegService.cropFromUrl(track.instrumental_grove_url, {
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
  const falResult = await falService.enhanceInstrumental({
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
async function mergeChunks(
  chunks: ProcessedChunk[],
  spotifyTrackId: string,
  ffmpegService: ReturnType<typeof createFFmpegService>
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
    await ffmpegService.concatenateWithCrossfade(chunkFiles, outputPath, 2000);

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
 * Main enhancement processor
 *
 * Finds tracks ready for enhancement and processes them through
 * fal.ai → load.network pipeline
 */
export async function processAudioEnhancement(limit: number = 10): Promise<void> {
  console.log(`\n🎵 Audio Enhancement Task (limit: ${limit})`);
  console.log(`================================================\n`);

  const falService = createFalService();
  const ffmpegService = createFFmpegService();

  // Find tracks ready for enhancement
  const tracks = await query<{
    spotify_track_id: string;
    duration_ms: number;
    instrumental_grove_url: string;
    primary_artist_name: string;
    title: string;
  }>(`
    SELECT
      t.spotify_track_id,
      t.duration_ms,
      sa.instrumental_grove_url,
      t.primary_artist_name,
      t.title
    FROM tracks t
    JOIN song_audio sa ON t.spotify_track_id = sa.spotify_track_id
    WHERE t.stage = $1
      AND sa.instrumental_grove_url IS NOT NULL
      AND (
        SELECT status FROM audio_tasks
        WHERE spotify_track_id = t.spotify_track_id AND task_type = 'enhance'
      ) IS NULL OR (
        SELECT status FROM audio_tasks
        WHERE spotify_track_id = t.spotify_track_id AND task_type = 'enhance'
      ) = 'pending'
    ORDER BY t.created_at ASC
    LIMIT $2
  `, [TrackStage.Segmented, limit]);

  if (tracks.length === 0) {
    console.log('✓ No tracks need enhancement');
    return;
  }

  console.log(`Found ${tracks.length} tracks to enhance:\n`);

  for (const track of tracks) {
    const startTime = Date.now();

    console.log(`\n[${track.spotify_track_id}] ${track.primary_artist_name} - ${track.title}`);
    console.log(`  Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);

    // Ensure task record exists
    await ensureAudioTask(track.spotify_track_id, 'enhance');
    await startTask(track.spotify_track_id, 'enhance');

    try {
      // Step 1: Calculate chunks
      const chunks = calculateChunks(track.duration_ms);
      console.log(`  Chunking strategy: ${chunks.length} chunk(s)`);

      if (chunks.length > 1) {
        console.log(`  Overlap: 2s crossfade between chunks`);
      }

      // Step 2: Process all chunks in parallel
      console.log(`\n  Processing chunks...`);
      const processedChunks = await Promise.all(
        chunks.map(chunk => processChunk(chunk, track, falService, ffmpegService))
      );

      // Step 3: Merge if needed
      console.log(`\n  Finalizing enhanced audio...`);
      const finalBuffer = await mergeChunks(processedChunks, track.spotify_track_id, ffmpegService);

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
      await query(`
        INSERT INTO karaoke_segments (
          spotify_track_id,
          fal_request_id,
          fal_enhanced_grove_cid,
          fal_enhanced_grove_url
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (spotify_track_id)
        DO UPDATE SET
          fal_request_id = EXCLUDED.fal_request_id,
          fal_enhanced_grove_cid = EXCLUDED.fal_enhanced_grove_cid,
          fal_enhanced_grove_url = EXCLUDED.fal_enhanced_grove_url,
          updated_at = NOW()
      `, [
        track.spotify_track_id,
        processedChunks[0].fal_request_id,
        groveResult.cid,
        groveResult.url
      ]);

      // Step 6: Complete task
      const processingTime = Date.now() - startTime;
      await completeTask(track.spotify_track_id, 'enhance', {
        grove_cid: groveResult.cid,
        grove_url: groveResult.url,
        chunks: chunks.length,
        fal_request_ids: processedChunks.map(c => c.fal_request_id),
        duration_ms: processingTime
      });

      // Step 7: Update track stage (will become 'enhanced')
      await updateTrackStage(track.spotify_track_id);

      console.log(`\n✓ ${track.spotify_track_id} enhanced in ${(processingTime / 1000).toFixed(1)}s\n`);

    } catch (error) {
      console.error(`\n❌ ${track.spotify_track_id} failed:`, error);
      await failTask(track.spotify_track_id, 'enhance', error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\n================================================`);
  console.log(`✓ Audio enhancement complete\n`);
}

// ============================================================================
// CLI Runner
// ============================================================================

if (import.meta.main) {
  const { parseArgs } = await import('util');

  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      limit: {
        type: 'string',
        short: 'l',
        default: '10'
      }
    },
    strict: true,
    allowPositionals: false
  });

  const limit = parseInt(values.limit || '10', 10);

  try {
    await processAudioEnhancement(limit);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}
