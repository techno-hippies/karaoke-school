/**
 * Local FFmpeg Service
 * Crops audio locally using system FFmpeg
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { mkdtemp } from 'fs/promises';

export interface CropOptions {
  startMs: number;
  endMs: number;
  outputFormat?: string; // 'mp3' | 'wav'
  bitrate?: number;      // kbps
}

export interface CropResult {
  buffer: Buffer;
  durationMs: number;
  fileSizeBytes: number;
}

export class FFmpegService {
  private tmpDir: string = '/tmp/ffmpeg-crop';

  constructor() {
    // Ensure tmp directory exists
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  /**
   * Crop audio from a Grove URL
   * Downloads the audio, crops it, and returns the buffer
   */
  async cropFromUrl(
    groveUrl: string,
    options: CropOptions
  ): Promise<CropResult> {
    const jobId = `crop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const workDir = path.join(this.tmpDir, jobId);
    fs.mkdirSync(workDir, { recursive: true });

    try {
      const inputFile = path.join(workDir, 'input.mp3');
      const outputFile = path.join(workDir, 'output.mp3');

      // Step 1: Download audio
      console.log(`[FFmpeg] Downloading audio from: ${groveUrl.slice(0, 60)}...`);
      const response = await fetch(groveUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      const audioBuffer = await response.arrayBuffer();
      fs.writeFileSync(inputFile, Buffer.from(audioBuffer));
      console.log(`[FFmpeg] ✓ Downloaded: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

      // Step 2: Crop with FFmpeg
      const startSec = (options.startMs / 1000).toFixed(3);
      const durationSec = ((options.endMs - options.startMs) / 1000).toFixed(3);
      const bitrate = options.bitrate || 192;

      console.log(`[FFmpeg] ✂️  Cropping: -ss ${startSec}s -t ${durationSec}s (${bitrate}kbps)`);

      try {
        execSync(
          `ffmpeg -y -ss ${startSec} -t ${durationSec} -i "${inputFile}" -c:a libmp3lame -b:a ${bitrate}k "${outputFile}" 2>&1`,
          { stdio: 'pipe' }
        );
      } catch (error: any) {
        // FFmpeg writes to stderr, check if output file was created
        if (!fs.existsSync(outputFile)) {
          throw new Error(`FFmpeg crop failed: ${error.message}`);
        }
      }

      // Step 3: Read cropped audio
      const croppedBuffer = fs.readFileSync(outputFile);
      const durationMs = options.endMs - options.startMs;

      console.log(
        `[FFmpeg] ✓ Cropped: ${(croppedBuffer.length / 1024 / 1024).toFixed(2)}MB, ${durationMs}ms`
      );

      return {
        buffer: croppedBuffer,
        durationMs,
        fileSizeBytes: croppedBuffer.length
      };
    } finally {
      // Cleanup
      try {
        execSync(`rm -rf "${workDir}"`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Concatenate multiple audio files using FFmpeg concat demuxer
   */
  async concatenateFiles(
    inputFiles: string[],
    outputFile: string
  ): Promise<void> {
    if (inputFiles.length === 0) {
      throw new Error('No input files provided');
    }

    if (inputFiles.length === 1) {
      // Single file, just copy
      fs.copyFileSync(inputFiles[0], outputFile);
      return;
    }

    const jobId = `concat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const workDir = path.join(this.tmpDir, jobId);
    fs.mkdirSync(workDir, { recursive: true });

    try {
      // Create concat list file
      const listFile = path.join(workDir, 'concat-list.txt');
      const listContent = inputFiles.map(f => `file '${f}'`).join('\n');
      fs.writeFileSync(listFile, listContent);

      console.log(`[FFmpeg] Concatenating ${inputFiles.length} files...`);

      // Run FFmpeg concat
      try {
        // Use libmp3lame encoding instead of -c copy since fal.ai returns WAV/PCM
        execSync(
          `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c:a libmp3lame -b:a 192k "${outputFile}" 2>&1`,
          { stdio: 'pipe' }
        );
      } catch (error: any) {
        // FFmpeg writes to stderr, check if output file was created
        if (!fs.existsSync(outputFile)) {
          throw new Error(`FFmpeg concat failed: ${error.message}`);
        }
        const stats = fs.statSync(outputFile);
        if (stats.size === 0) {
          throw new Error(`FFmpeg concat created empty file: ${error.message}`);
        }
      }

      console.log(`[FFmpeg] ✓ Concatenated to: ${outputFile}`);

    } finally {
      // Cleanup work directory
      try {
        execSync(`rm -rf "${workDir}"`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Concatenate audio files with crossfade between chunks
   * Uses FFmpeg's acrossfade filter for seamless transitions
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
      execSync(
        `ffmpeg -y -i "${inputFiles[0]}" -c:a libmp3lame -b:a 192k "${outputFile}" 2>&1`,
        { stdio: 'pipe' }
      );
      return;
    }

    const jobId = `crossfade-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const workDir = path.join(this.tmpDir, jobId);
    fs.mkdirSync(workDir, { recursive: true });

    try {
      const crossfadeSec = crossfadeDurationMs / 1000;

      if (inputFiles.length === 2) {
        // Two files: simple acrossfade
        console.log(`[FFmpeg] Applying ${crossfadeSec}s crossfade between 2 chunks...`);

        execSync(
          `ffmpeg -y -i "${inputFiles[0]}" -i "${inputFiles[1]}" ` +
          `-filter_complex "[0][1]acrossfade=d=${crossfadeSec}:c1=tri:c2=tri" ` +
          `-c:a libmp3lame -b:a 192k "${outputFile}" 2>&1`,
          { stdio: 'pipe' }
        );
      } else {
        // Multiple files: chain crossfades
        console.log(`[FFmpeg] Applying ${crossfadeSec}s crossfades between ${inputFiles.length} chunks...`);

        // Build filter chain: [0][1]acrossfade[a1]; [a1][2]acrossfade[a2]; ...
        let filterParts: string[] = [];
        let lastLabel = '0';

        for (let i = 1; i < inputFiles.length; i++) {
          const currentInput = i.toString();
          const outputLabel = i === inputFiles.length - 1 ? '' : `[a${i}]`;

          if (i === 1) {
            filterParts.push(`[${lastLabel}][${currentInput}]acrossfade=d=${crossfadeSec}:c1=tri:c2=tri${outputLabel}`);
          } else {
            filterParts.push(`[${lastLabel}][${currentInput}]acrossfade=d=${crossfadeSec}:c1=tri:c2=tri${outputLabel}`);
          }

          lastLabel = `a${i}`;
        }

        const filterComplex = filterParts.join('; ');
        const inputArgs = inputFiles.map(f => `-i "${f}"`).join(' ');

        execSync(
          `ffmpeg -y ${inputArgs} -filter_complex "${filterComplex}" ` +
          `-c:a libmp3lame -b:a 192k "${outputFile}" 2>&1`,
          { stdio: 'pipe' }
        );
      }

      console.log(`[FFmpeg] ✓ Crossfaded merge complete`);

    } finally {
      // Cleanup work directory
      try {
        execSync(`rm -rf "${workDir}"`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Check if FFmpeg is available on the system
   */
  static isAvailable(): boolean {
    try {
      execSync('ffmpeg -version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}
