/**
 * TikTok Service
 *
 * URL parsing and segment scraping utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Extract TikTok music ID from music page URL
 *
 * Examples:
 * - https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891
 * - https://www.tiktok.com/music/original-sound-1234567890
 *
 * @param url TikTok music page URL
 * @returns TikTok music ID (numeric string)
 */
export function extractTikTokMusicId(url: string): string {
  // Match pattern: /music/{slug}-{numeric-id}
  // The slug can contain hyphens, so we match the LAST sequence of digits
  const match = url.match(/\/music\/.+-(\d+)$/);

  if (!match || !match[1]) {
    throw new Error(`Invalid TikTok music URL: ${url}\nExpected format: https://www.tiktok.com/music/{name}-{id}`);
  }

  return match[1];
}

/**
 * Extract TikTok music slug from URL
 *
 * @param url TikTok music page URL
 * @returns Music slug (e.g., "TEXAS-HOLDEM")
 */
export function extractTikTokMusicSlug(url: string): string {
  // Match everything between /music/ and the last -{digits}
  const match = url.match(/\/music\/(.+)-\d+$/);

  if (!match || !match[1]) {
    throw new Error(`Invalid TikTok music URL: ${url}`);
  }

  return match[1];
}

/**
 * Validate TikTok music URL format
 *
 * @param url TikTok music page URL
 * @returns true if valid
 */
export function isValidTikTokMusicUrl(url: string): boolean {
  return /^https:\/\/www\.tiktok\.com\/music\/[^-]+-\d+/.test(url);
}

/**
 * Download TikTok segment from CDN URL
 *
 * @param segmentUrl TikTok CDN URL
 * @param outputPath Local file path to save segment
 */
export async function downloadTikTokSegment(
  segmentUrl: string,
  outputPath: string
): Promise<void> {
  console.log(`📥 Downloading TikTok segment...`);
  console.log(`   URL: ${segmentUrl}`);
  console.log(`   Output: ${outputPath}`);

  try {
    // Use curl to download
    await execAsync(`curl -s -o "${outputPath}" "${segmentUrl}"`);

    // Verify download
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`);
    const duration = parseFloat(stdout.trim());

    console.log(`   ✓ Downloaded (${duration.toFixed(1)}s)`);
  } catch (error: any) {
    throw new Error(`Failed to download TikTok segment: ${error.message}`);
  }
}
