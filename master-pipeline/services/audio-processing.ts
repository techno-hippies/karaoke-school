/**
 * Audio Processing Service
 *
 * Utilities for audio manipulation using ffmpeg:
 * - Crop/trim audio segments
 * - Format conversion
 * - Metadata extraction
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, basename, extname } from 'path';

const execAsync = promisify(exec);

export interface AudioMetadata {
  duration: number;
  format: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
}

export interface CropOptions {
  startTime: number;
  endTime: number;
  outputFormat?: 'mp3' | 'wav' | 'flac';
  bitrate?: number; // kbps for MP3
  copyCodec?: boolean; // If true, copy codec without re-encoding (faster)
}

export class AudioProcessingService {
  /**
   * Get audio file metadata using ffprobe
   */
  async getMetadata(audioPath: string): Promise<AudioMetadata> {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${audioPath}"`
    );

    const data = JSON.parse(stdout);
    const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');

    return {
      duration: parseFloat(data.format.duration),
      format: data.format.format_name,
      bitrate: parseInt(data.format.bit_rate) / 1000, // Convert to kbps
      sampleRate: parseInt(audioStream.sample_rate),
      channels: audioStream.channels,
    };
  }

  /**
   * Crop audio file to specified time range
   * IMPORTANT: Creates a copy, does not modify the original file
   *
   * @param inputPath Path to input audio file
   * @param outputPath Path for cropped output file
   * @param options Crop options (start/end time, format, bitrate)
   * @returns Path to cropped file
   */
  async crop(
    inputPath: string,
    outputPath: string,
    options: CropOptions
  ): Promise<string> {
    const { startTime, endTime, outputFormat, bitrate, copyCodec } = options;

    if (!existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    const duration = endTime - startTime;

    console.log(`🎵 Cropping audio: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${duration.toFixed(2)}s)`);
    console.log(`   Input:  ${inputPath}`);
    console.log(`   Output: ${outputPath}`);

    // Build ffmpeg command
    const args: string[] = [
      'ffmpeg',
      '-i', `"${inputPath}"`,
      '-ss', startTime.toString(),
      '-t', duration.toString(),
    ];

    if (copyCodec) {
      // Fast copy without re-encoding (preserves original quality)
      args.push('-c', 'copy');
    } else if (outputFormat === 'mp3') {
      // MP3 encoding
      args.push('-acodec', 'libmp3lame');
      if (bitrate) {
        args.push('-b:a', `${bitrate}k`);
      } else {
        args.push('-q:a', '2'); // High quality VBR
      }
    } else if (outputFormat === 'wav') {
      // WAV encoding
      args.push('-acodec', 'pcm_s16le');
    } else if (outputFormat === 'flac') {
      // FLAC encoding (lossless)
      args.push('-acodec', 'flac');
    }

    args.push('-y', `"${outputPath}"`);

    const command = args.join(' ');
    console.log(`   Command: ${command.replace(/-i "[^"]*"/, '-i [INPUT]')}`);

    try {
      const { stderr } = await execAsync(command);

      // ffmpeg outputs progress to stderr (not an error)
      if (stderr && !stderr.includes('time=') && !stderr.includes('video:0kB')) {
        console.warn('ffmpeg stderr:', stderr);
      }

      console.log(`   ✓ Cropped successfully\n`);
      return outputPath;
    } catch (error: any) {
      throw new Error(`ffmpeg crop failed: ${error.message}\nCommand: ${command}`);
    }
  }

  /**
   * Copy audio file with format conversion
   */
  async convert(
    inputPath: string,
    outputPath: string,
    options: {
      format: 'mp3' | 'wav' | 'flac';
      bitrate?: number;
    }
  ): Promise<string> {
    if (!existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    console.log(`🔄 Converting audio: ${basename(inputPath)} -> ${options.format}`);

    const args: string[] = [
      'ffmpeg',
      '-i', `"${inputPath}"`,
    ];

    if (options.format === 'mp3') {
      args.push('-acodec', 'libmp3lame');
      if (options.bitrate) {
        args.push('-b:a', `${options.bitrate}k`);
      } else {
        args.push('-q:a', '2');
      }
    } else if (options.format === 'wav') {
      args.push('-acodec', 'pcm_s16le');
    } else if (options.format === 'flac') {
      args.push('-acodec', 'flac');
    }

    args.push('-y', `"${outputPath}"`);

    const command = args.join(' ');

    try {
      await execAsync(command);
      console.log(`   ✓ Converted successfully\n`);
      return outputPath;
    } catch (error: any) {
      throw new Error(`ffmpeg convert failed: ${error.message}`);
    }
  }

  /**
   * Get duration of audio file in seconds
   */
  async getDuration(audioPath: string): Promise<number> {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
    );
    return parseFloat(stdout.trim());
  }
}
