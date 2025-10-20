/**
 * TikTok utilities
 * Scrapes TikTok music pages to extract canonical song segments
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface TikTokMusicInfo {
  url: string;
  musicId: string;
  songName: string;
  artistName: string;
  segmentUrl: string;
  duration: number;
}

/**
 * Extract music info from TikTok music page URL
 * Example: https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891
 * Returns: { musicId: '7334542274145454891', songName: 'TEXAS-HOLDEM' }
 */
export function parseTikTokMusicUrl(url: string): { musicId: string; songName: string } {
  // Extract from URL pattern: /music/{SONG_NAME}-{ID}
  const match = url.match(/\/music\/([^-]+)-(\d+)/);

  if (!match) {
    throw new Error(`Invalid TikTok music URL: ${url}`);
  }

  return {
    songName: match[1].replace(/%20/g, ' '),
    musicId: match[2],
  };
}

/**
 * Scrape TikTok music page using Chrome DevTools Protocol
 * Extracts the canonical segment URL from the video element
 *
 * Prerequisites:
 * - Chrome running with --remote-debugging-port=9222
 * - Chrome DevTools MCP server available
 *
 * @param url TikTok music page URL
 * @returns Segment video URL
 */
export async function scrapeTikTokMusicPage(url: string): Promise<string> {
  // This function should be called from within an MCP context
  // For now, we'll throw an error directing users to use Chrome DevTools
  throw new Error(
    'scrapeTikTokMusicPage must be called with Chrome DevTools MCP. ' +
      'Use the mcp__chrome-devtools__navigate_page and mcp__chrome-devtools__evaluate_script tools instead.'
  );
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

    console.log(`✅ Downloaded segment (${duration.toFixed(1)}s)`);
  } catch (error: any) {
    throw new Error(`Failed to download TikTok segment: ${error.message}`);
  }
}

/**
 * Get TikTok segment info from music page
 * This is a convenience function that combines parsing and metadata extraction
 *
 * Note: The actual scraping must be done via Chrome DevTools MCP
 * This function just helps organize the data
 */
export function getTikTokSegmentInfo(url: string, segmentUrl: string): TikTokMusicInfo {
  const { musicId, songName } = parseTikTokMusicUrl(url);

  // Extract artist name from song name if present
  // Example: "TEXAS-HOLDEM" or "House-Tour"
  const artistName = 'Unknown'; // Will be provided by user or Genius API

  return {
    url,
    musicId,
    songName,
    artistName,
    segmentUrl,
    duration: 60, // Standard TikTok segment length
  };
}
