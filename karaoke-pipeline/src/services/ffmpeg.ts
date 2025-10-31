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
