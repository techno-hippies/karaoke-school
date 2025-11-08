/**
 * FFmpeg Service - Audio Processing
 *
 * Handles cropping and concatenation with crossfade for chunked enhancement
 */

import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';

export interface CropOptions {
  startMs: number;
  endMs: number;
  bitrate?: number;        // Default: 192 kbps
}

export interface CropResult {
  buffer: Buffer;
  duration: number;        // Actual duration in seconds
}

export class FFmpegService {
  private tmpDir: string;

  constructor(tmpDir?: string) {
    this.tmpDir = tmpDir || join(tmpdir(), 'karaoke-ffmpeg');
    if (!existsSync(this.tmpDir)) {
      mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  /**
   * Crop audio segment from URL
   *
   * Downloads audio and extracts specified time range
   */
  async cropFromUrl(audioUrl: string, options: CropOptions): Promise<CropResult> {
    const jobId = `crop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const workDir = join(this.tmpDir, jobId);
    mkdirSync(workDir, { recursive: true });

    const outputFile = join(workDir, 'output.mp3');

    try {
      const startSec = options.startMs / 1000;
      const durationSec = (options.endMs - options.startMs) / 1000;
      const bitrate = options.bitrate || 192;

      console.log(`[FFmpeg] Cropping ${startSec}s - ${options.endMs / 1000}s (${durationSec}s)`);

      // Download and crop in one command
      const command = `ffmpeg -y -ss ${startSec} -t ${durationSec} -i "${audioUrl}" ` +
        `-c:a libmp3lame -b:a ${bitrate}k "${outputFile}" 2>&1`;

      execSync(command, { stdio: 'pipe' });

      // Read result
      const buffer = Buffer.from(await Bun.file(outputFile).arrayBuffer());

      console.log(`[FFmpeg] ✓ Cropped (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);

      return {
        buffer,
        duration: durationSec,
      };

    } finally {
      // Cleanup
      if (existsSync(outputFile)) {
        unlinkSync(outputFile);
      }
      try {
        const fs = await import('fs');
        fs.rmdirSync(workDir);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Concatenate audio files with crossfade
   *
   * For chunks with 2s overlap, creates smooth transitions
   *
   * @param inputFiles Array of audio file paths (must exist on disk)
   * @param outputFile Output file path
   * @param crossfadeDurationMs Crossfade duration in ms (default: 2000)
   */
  async concatenateWithCrossfade(
    inputFiles: string[],
    outputFile: string,
    crossfadeDurationMs: number = 2000
  ): Promise<void> {
    if (inputFiles.length === 0) {
      throw new Error('No input files provided');
    }

    if (inputFiles.length === 1) {
      // Single file, just convert to MP3
      console.log(`[FFmpeg] Single file, converting to MP3...`);
      execSync(
        `ffmpeg -y -i "${inputFiles[0]}" -c:a libmp3lame -b:a 192k "${outputFile}" 2>&1`,
        { stdio: 'pipe' }
      );
      return;
    }

    const crossfadeSec = crossfadeDurationMs / 1000;

    if (inputFiles.length === 2) {
      // Two files: simple acrossfade
      console.log(`[FFmpeg] Merging 2 chunks with ${crossfadeSec}s crossfade...`);

      execSync(
        `ffmpeg -y -i "${inputFiles[0]}" -i "${inputFiles[1]}" ` +
        `-filter_complex "[0][1]acrossfade=d=${crossfadeSec}:c1=tri:c2=tri[out]" ` +
        `-map "[out]" -c:a libmp3lame -b:a 192k "${outputFile}" 2>&1`,
        { stdio: 'pipe' }
      );

      console.log(`[FFmpeg] ✓ Merged 2 chunks`);
      return;
    }

    // Three or more files: chain crossfades
    console.log(`[FFmpeg] Merging ${inputFiles.length} chunks with ${crossfadeSec}s crossfade...`);

    // Build filter chain: [0][1]acrossfade[a01]; [a01][2]acrossfade[a012]; ...
    let filterComplex = '';
    let currentLabel = '';

    for (let i = 1; i < inputFiles.length; i++) {
      const inputLabel = i === 1 ? '[0]' : currentLabel;
      const nextInput = `[${i}]`;
      const outputLabel = i === inputFiles.length - 1 ? '[out]' : `[a${i}]`;

      filterComplex += `${inputLabel}${nextInput}acrossfade=d=${crossfadeSec}:c1=tri:c2=tri${outputLabel}`;

      if (i < inputFiles.length - 1) {
        filterComplex += '; ';
      }

      currentLabel = outputLabel;
    }

    // Build input flags
    const inputFlags = inputFiles.map(f => `-i "${f}"`).join(' ');

    const command = `ffmpeg -y ${inputFlags} ` +
      `-filter_complex "${filterComplex}" ` +
      `-map "[out]" -c:a libmp3lame -b:a 192k "${outputFile}" 2>&1`;

    execSync(command, { stdio: 'pipe' });

    console.log(`[FFmpeg] ✓ Merged ${inputFiles.length} chunks`);
  }

  /**
   * Get audio duration from URL (in seconds)
   */
  async getDuration(audioUrl: string): Promise<number> {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioUrl}"`;
    const output = execSync(command, { encoding: 'utf-8' });
    return parseFloat(output.trim());
  }
}

/**
 * Singleton instance
 */
let ffmpegServiceInstance: FFmpegService | null = null;

export function createFFmpegService(): FFmpegService {
  if (!ffmpegServiceInstance) {
    ffmpegServiceInstance = new FFmpegService();
  }
  return ffmpegServiceInstance;
}
