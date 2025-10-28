/**
 * Segment Helper Functions
 * Utilities for checking segment existence and building TikTok music URLs
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { gql } from 'graphql-request';
import { graphClient } from './graphql-client.js';

/**
 * Slugify a string for URL formatting
 * Removes special characters, replaces spaces with hyphens
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .trim();
}

/**
 * Build TikTok music URL from video music data
 *
 * @param musicTitle - Song title (e.g., "3 Strikes")
 * @param musicId - TikTok music ID (e.g., "249620626724917248")
 * @returns TikTok music URL
 *
 * @example
 * buildTikTokMusicUrl("3 Strikes", "249620626724917248")
 * // => "https://www.tiktok.com/music/3-Strikes-249620626724917248"
 */
export function buildTikTokMusicUrl(musicTitle: string, musicId: string): string {
  const slug = slugify(musicTitle);
  return `https://www.tiktok.com/music/${slug}-${musicId}`;
}

/**
 * Check if a segment exists for a given song (via The Graph)
 *
 * @param geniusId - The Genius song ID
 * @returns True if segment exists in The Graph subgraph
 */
export async function checkSegmentExistsInGraph(geniusId: number): Promise<boolean> {
  const SEGMENT_CHECK_QUERY = gql`
    query CheckSegmentExists($geniusId: BigInt!) {
      songs(where: { geniusId: $geniusId }) {
        id
        geniusId
        segmentCount
        segments {
          id
        }
      }
    }
  `;

  try {
    const data = await graphClient.request<{ songs: any[] }>(
      SEGMENT_CHECK_QUERY,
      { geniusId: geniusId.toString() }
    );

    if (!data.songs || data.songs.length === 0) {
      return false; // Song not registered yet
    }

    const song = data.songs[0];
    return song.segmentCount > 0 && song.segments && song.segments.length > 0;
  } catch (error) {
    console.warn(`⚠️  Failed to check segment in Graph: ${error}`);
    return false;
  }
}

/**
 * Check if a segment directory exists locally
 *
 * @param geniusId - The Genius song ID
 * @returns True if segment directory exists
 */
export function checkSegmentExistsLocally(geniusId: number): boolean {
  const dataDir = join(process.cwd(), 'data', 'songs', geniusId.toString());

  // Check if song directory exists and has segment files
  if (!existsSync(dataDir)) {
    return false;
  }

  // Look for manifest or processed segment files
  const segmentManifest = join(dataDir, 'segment-manifest.json');
  const segmentMetadata = join(dataDir, 'segment-metadata.json');

  return existsSync(segmentManifest) || existsSync(segmentMetadata);
}

/**
 * Check if a segment exists for a song (checks both Graph and local)
 *
 * @param geniusId - The Genius song ID
 * @param checkGraph - Whether to check The Graph (default: false, local only for speed)
 * @returns True if segment exists
 */
export async function segmentExists(
  geniusId: number,
  checkGraph = false
): Promise<boolean> {
  // Check local first (faster)
  const localExists = checkSegmentExistsLocally(geniusId);
  if (localExists) {
    return true;
  }

  // Optionally check The Graph
  if (checkGraph) {
    return await checkSegmentExistsInGraph(geniusId);
  }

  return false;
}

/**
 * Get the segment directory path for a song
 *
 * @param geniusId - The Genius song ID
 * @returns Path to segment directory
 */
export function getSegmentDir(geniusId: number): string {
  return join(process.cwd(), 'data', 'songs', geniusId.toString());
}
