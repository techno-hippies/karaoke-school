import { spawn } from 'child_process';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import type { ClipSection } from '../types.js';

const TEMP_DIR = './temp';

/**
 * Ensure temp directory exists
 */
async function ensureTempDir() {
  try {
    await mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

/**
 * Slice audio file into a clip using ffmpeg
 * @param inputPath Path to full audio file
 * @param section Clip section with start/end times
 * @param outputPath Path for output clip (optional, auto-generated if not provided)
 * @returns Path to sliced audio file
 */
export async function sliceAudio(
  inputPath: string,
  section: ClipSection,
  outputPath?: string
): Promise<string> {
  await ensureTempDir();

  const output = outputPath || join(TEMP_DIR, `${section.id}.mp3`);

  // Use ffmpeg to extract audio segment
  // -ss: start time
  // -to: end time
  // -c copy: copy codec (fast, no re-encoding)
  // -avoid_negative_ts make_zero: ensure timestamps start at 0
  const args = [
    '-i', inputPath,
    '-ss', section.startTime.toString(),
    '-to', section.endTime.toString(),
    '-c', 'copy',
    '-avoid_negative_ts', 'make_zero',
    '-y', // Overwrite output file
    output
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
    });
  });
}

/**
 * Check if ffmpeg is available
 */
export async function checkFFmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);

    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });

    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Slice audio with re-encoding (more accurate but slower)
 * Use when -c copy produces inaccurate cuts
 */
export async function sliceAudioReencode(
  inputPath: string,
  section: ClipSection,
  outputPath?: string
): Promise<string> {
  await ensureTempDir();

  const output = outputPath || join(TEMP_DIR, `${section.id}.mp3`);

  // Re-encode with libmp3lame for frame-accurate cuts
  const args = [
    '-i', inputPath,
    '-ss', section.startTime.toString(),
    '-to', section.endTime.toString(),
    '-c:a', 'libmp3lame',
    '-b:a', '192k',
    '-avoid_negative_ts', 'make_zero',
    '-y',
    output
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
    });
  });
}
