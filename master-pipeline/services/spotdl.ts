/**
 * SpotDL Service
 *
 * Downloads songs from Spotify using spotdl CLI
 * Supports FLAC format for high-quality audio
 */

import { $ } from 'bun';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface SpotDLResult {
  path: string;
  title: string;
  artist: string;
  duration?: number;
}

export class SpotDLService {
  private outputDir: string;

  constructor(outputDir: string = '/tmp/spotdl-downloads') {
    this.outputDir = outputDir;

    // Ensure output directory exists
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Download a song from Spotify by track ID or URL
   *
   * @param spotifyIdOrUrl - Spotify track ID (e.g., "0V3wPSX9ygBnCm8psDIegu") or full URL
   * @param format - Audio format (flac, mp3, m4a, opus, ogg)
   * @returns Path to downloaded file and metadata
   */
  async download(
    spotifyIdOrUrl: string,
    format: 'flac' | 'mp3' | 'm4a' | 'opus' | 'ogg' = 'flac'
  ): Promise<SpotDLResult> {
    console.log(`[SpotDL] Downloading: ${spotifyIdOrUrl}`);

    // Build Spotify URL if just ID provided
    const spotifyUrl = spotifyIdOrUrl.startsWith('http')
      ? spotifyIdOrUrl
      : `https://open.spotify.com/track/${spotifyIdOrUrl}`;

    // Output template: "Artist - Title.format"
    const outputTemplate = join(this.outputDir, '{artist} - {title}.{output-ext}');

    try {
      // Run spotdl
      const result = await $`spotdl download ${spotifyUrl} \
        --output ${outputTemplate} \
        --format ${format} \
        --print-errors`.text();

      console.log(`[SpotDL] Download complete`);

      // Parse output to find the downloaded file
      // spotdl outputs: Downloaded "Artist - Title": URL
      const downloadMatch = result.match(/Downloaded "([^"]+)":/);

      if (!downloadMatch) {
        throw new Error('Failed to parse spotdl output');
      }

      const filename = downloadMatch[1];
      const path = join(this.outputDir, `${filename}.${format}`);

      // Verify file exists
      if (!existsSync(path)) {
        throw new Error(`Downloaded file not found: ${path}`);
      }

      // Parse artist and title from filename
      const [artist, title] = filename.split(' - ');

      return {
        path,
        artist,
        title,
      };
    } catch (error: any) {
      // Check for rate limit errors
      if (error.message?.includes('rate') || error.message?.includes('429')) {
        throw new Error('SpotDL rate limit reached. Wait a few minutes and try again.');
      }

      throw new Error(`SpotDL download failed: ${error.message}`);
    }
  }

  /**
   * Download multiple songs in batch
   */
  async downloadBatch(
    spotifyIds: string[],
    format: 'flac' | 'mp3' | 'm4a' = 'flac'
  ): Promise<SpotDLResult[]> {
    const results: SpotDLResult[] = [];

    for (const id of spotifyIds) {
      try {
        const result = await this.download(id, format);
        results.push(result);

        // Rate limit: wait 2s between downloads to avoid Spotify blocks
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`[SpotDL] Failed to download ${id}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Check if spotdl is installed
   */
  static async isInstalled(): Promise<boolean> {
    try {
      await $`spotdl --version`.quiet();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get spotdl version
   */
  static async getVersion(): Promise<string> {
    try {
      const version = await $`spotdl --version`.text();
      return version.trim();
    } catch {
      throw new Error('spotdl is not installed');
    }
  }
}
