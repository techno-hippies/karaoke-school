/**
 * Step 10 (NEW): Full-Song Audio Enhancement with Chunking
 *
 * Enhances ENTIRE songs using fal.ai, splitting into 190s chunks if needed.
 *
 * FLOW:
 * 1. Calculate chunks (0-190s, 190-380s, etc.)
 * 2. Crop each chunk from full instrumental with FFmpeg
 * 3. Submit ALL chunks to fal.ai in parallel
 * 4. Download all enhanced chunks
 * 5. Concatenate chunks with FFmpeg
 * 6. Upload merged instrumental to Grove
 * 7. Store chunk metadata in database
 *
 * Processes tracks that have:
 * - Instrumental separation complete (song_audio.instrumental_grove_url)
 * - NO enhancement yet (karaoke_segments.merged_instrumental_cid IS NULL)
 */

import {
  updateFalChunks,
  getTracksNeedingFalEnhancement
} from '../db/karaoke-segments';
import { FalAudioService } from '../services/fal-audio';
import { FFmpegService } from '../services/ffmpeg';
import { uploadToGrove } from '../services/grove';
import type { Env } from '../types';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

interface Chunk {
  index: number;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
}

interface ProcessedChunk extends Chunk {
  fal_url: string;
  fal_request_id: string;
  grove_cid: string;
  grove_url: string;
}

/**
 * Calculate 190s chunks for a song with 2s overlap for crossfade
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
 * Process a single chunk: crop, enhance, upload
 */
async function processChunk(
  chunk: Chunk,
  instrumentalUrl: string,
  spotifyTrackId: string,
  falService: FalAudioService,
  ffmpegService: FFmpegService
): Promise<ProcessedChunk> {
  const tmpDir = tmpdir();
  const chunkPath = join(tmpDir, `chunk_${chunk.index}_${spotifyTrackId}.mp3`);

  try {
    // Step 1: Crop chunk from full instrumental
    console.log(`   [Chunk ${chunk.index}] Cropping ${chunk.start_ms}ms - ${chunk.end_ms}ms...`);

    const cropResult = await ffmpegService.cropFromUrl(instrumentalUrl, {
      startMs: chunk.start_ms,
      endMs: chunk.end_ms,
      bitrate: 192
    });

    // Save chunk to temp file
    writeFileSync(chunkPath, cropResult.buffer);
    console.log(`   [Chunk ${chunk.index}] ✓ Cropped (${(cropResult.buffer.length / 1024 / 1024).toFixed(2)}MB)`);

    // Step 2: Upload chunk to Grove (for fal.ai input)
    console.log(`   [Chunk ${chunk.index}] Uploading chunk to Grove...`);
    const chunkGrove = await uploadToGrove(
      cropResult.buffer,
      'audio/mpeg',
      `chunk-${chunk.index}-${spotifyTrackId}.mp3`
    );
    console.log(`   [Chunk ${chunk.index}] ✓ Uploaded: ${chunkGrove.cid}`);

    // Step 3: Send to fal.ai for enhancement
    console.log(`   [Chunk ${chunk.index}] Sending to fal.ai...`);
    const falResult = await falService.enhanceInstrumental({
      audioUrl: chunkGrove.url,
      prompt: 'instrumental',
      strength: 0.35
    });
    console.log(`   [Chunk ${chunk.index}] ✓ Enhanced in ${falResult.duration.toFixed(1)}s`);

    // Step 4: Download enhanced chunk
    console.log(`   [Chunk ${chunk.index}] Downloading enhanced audio...`);
    const enhancedBuffer = await falService.downloadAudio(falResult.audioUrl);

    // Step 5: Upload enhanced chunk to Grove
    console.log(`   [Chunk ${chunk.index}] Uploading enhanced chunk to Grove...`);
    const enhancedGrove = await uploadToGrove(
      Buffer.from(enhancedBuffer),
      'audio/mpeg',
      `enhanced-chunk-${chunk.index}-${spotifyTrackId}.mp3`
    );
    console.log(`   [Chunk ${chunk.index}] ✓ Final CID: ${enhancedGrove.cid}`);

    return {
      ...chunk,
      fal_url: falResult.audioUrl,
      fal_request_id: falResult.requestId || 'unknown',
      grove_cid: enhancedGrove.cid,
      grove_url: enhancedGrove.url
    };

  } finally {
    // Cleanup temp file
    if (existsSync(chunkPath)) {
      unlinkSync(chunkPath);
    }
  }
}

/**
 * Merge enhanced chunks with FFmpeg crossfade (for overlapping chunks)
 */
async function mergeChunks(
  chunks: ProcessedChunk[],
  spotifyTrackId: string,
  ffmpegService: FFmpegService
): Promise<Buffer> {
  if (chunks.length === 1) {
    console.log(`   Single chunk, no merge needed`);
    // Download the single chunk
    const response = await fetch(chunks[0].grove_url);
    return Buffer.from(await response.arrayBuffer());
  }

  console.log(`   Merging ${chunks.length} chunks with 2s crossfade...`);

  const tmpDir = join(tmpdir(), 'karaoke-merge');
  if (!existsSync(tmpDir)) {
    const fs = await import('fs');
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const chunkFiles: string[] = [];
  const outputPath = join(tmpDir, `merged-${spotifyTrackId}.mp3`);

  try {
    // Download all chunks to temp files
    for (const chunk of chunks) {
      const chunkFile = join(tmpDir, `download-chunk-${chunk.index}-${spotifyTrackId}.wav`);
      console.log(`   Downloading chunk ${chunk.index}...`);

      const response = await fetch(chunk.grove_url);
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(chunkFile, buffer);

      chunkFiles.push(chunkFile);
    }

    // Merge with FFmpeg crossfade
    console.log(`   Running FFmpeg crossfade merge...`);
    await ffmpegService.concatenateWithCrossfade(chunkFiles, outputPath, 2000); // 2s crossfade

    // Read merged file
    const mergedBuffer = await Bun.file(outputPath).arrayBuffer();
    console.log(`   ✓ Merged (${(mergedBuffer.byteLength / 1024 / 1024).toFixed(2)}MB)`);

    return Buffer.from(mergedBuffer);

  } finally {
    // Cleanup temp files
    chunkFiles.forEach(f => {
      if (existsSync(f)) unlinkSync(f);
    });
    if (existsSync(outputPath)) unlinkSync(outputPath);
  }
}

export async function processFalEnhancementChunked(env: Env, limit: number = 10): Promise<void> {
  console.log(`\n[Step 10] Full-Song fal.ai Enhancement with Chunking (limit: ${limit})`);

  if (!env.FAL_API_KEY) {
    console.log('⚠️ FAL_API_KEY not configured, skipping');
    return;
  }

  // Check if FFmpeg is available (REQUIRED for chunking)
  const hasFFmpeg = FFmpegService.isAvailable();
  if (!hasFFmpeg) {
    console.error('❌ FFmpeg not available - REQUIRED for chunking!');
    return;
  }

  console.log(`   FFmpeg: ✓ Available`);

  const falService = new FalAudioService(env.FAL_API_KEY, {
    maxPollAttempts: 180, // 6 minutes per chunk
    pollInterval: 2000     // 2 seconds
  });

  const ffmpegService = new FFmpegService();

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
    let totalCost = 0;

    for (const track of tracks) {
      try {
        console.log(`\n📍 Processing: ${track.spotify_track_id}`);
        console.log(`   Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);

        // Step 1: Calculate chunks
        const chunks = calculateChunks(track.duration_ms);
        console.log(`   Chunks: ${chunks.length} (cost: $${(chunks.length * 0.20).toFixed(2)})`);

        chunks.forEach(c => {
          console.log(`     - Chunk ${c.index}: ${c.start_ms}ms - ${c.end_ms}ms (${(c.duration_ms / 1000).toFixed(1)}s)`);
        });

        // Step 2: Process all chunks in parallel
        console.log(`\n   Processing ${chunks.length} chunk(s) in parallel...`);

        const processedChunks = await Promise.all(
          chunks.map(chunk =>
            processChunk(
              chunk,
              track.instrumental_grove_url,
              track.spotify_track_id,
              falService,
              ffmpegService
            )
          )
        );

        console.log(`\n   ✓ All ${chunks.length} chunks enhanced`);

        // Step 3: Merge chunks if needed
        console.log(`\n   Merging chunks...`);
        const mergedBuffer = await mergeChunks(
          processedChunks,
          track.spotify_track_id,
          ffmpegService
        );

        // Step 4: Upload merged instrumental to Grove
        console.log(`   Uploading merged instrumental to Grove...`);
        const mergedGrove = await uploadToGrove(
          mergedBuffer,
          'audio/mpeg',
          `full-instrumental-${track.spotify_track_id}.mp3`
        );
        console.log(`   ✓ Merged instrumental: ${mergedGrove.cid}`);

        // Step 5: Update database
        await updateFalChunks(env.DATABASE_URL, track.spotify_track_id, {
          chunks: processedChunks.map(c => ({
            index: c.index,
            start_ms: c.start_ms,
            end_ms: c.end_ms,
            duration_ms: c.duration_ms,
            fal_url: c.fal_url,
            fal_request_id: c.fal_request_id,
            grove_cid: c.grove_cid,
            grove_url: c.grove_url
          })),
          mergedInstrumentalCid: mergedGrove.cid
        });

        console.log(`   ✓ Database updated`);
        enhancedCount++;
        totalCost += chunks.length * 0.20;

      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
        failedCount++;
      }
    }

    console.log(`\n✓ Step 10 complete: ${enhancedCount} enhanced, ${failedCount} failed`);
    if (enhancedCount > 0) {
      console.log(`   Total cost: $${totalCost.toFixed(2)}`);
    }

  } catch (error: any) {
    console.error(`[Step 10] Fatal error: ${error.message}`);
    throw error;
  }
}
