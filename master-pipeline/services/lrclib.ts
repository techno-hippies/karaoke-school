/**
 * LRCLib Service
 *
 * Fetch synced lyrics from LRCLib API
 * https://lrclib.net/docs
 */

import { BaseService, ServiceConfig } from './base.js';

export interface LRCLibSearchResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string;
}

export class LRCLibService extends BaseService {
  constructor(config: ServiceConfig = {}) {
    super('LRCLib', {
      baseUrl: 'https://lrclib.net/api',
      timeout: 15000,
      ...config,
    });
  }

  /**
   * Search for lyrics by track name and artist name
   *
   * @param trackName Song title
   * @param artistName Artist name
   * @returns Array of search results
   */
  async search(trackName: string, artistName: string): Promise<LRCLibSearchResult[]> {
    this.log(`Searching for: ${trackName} by ${artistName}`);

    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });

    const url = `${this.config.baseUrl}/search?${params}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`LRCLib API error: ${response.status} - ${await response.text()}`);
      }

      const results = await response.json();

      this.log(`Found ${results.length} results`);

      return results;
    } catch (error: any) {
      throw new Error(`Failed to search LRCLib: ${error.message}`);
    }
  }

  /**
   * Get lyrics by LRCLib ID
   *
   * @param id LRCLib track ID
   * @returns Lyrics data
   */
  async getById(id: number): Promise<LRCLibSearchResult> {
    this.log(`Fetching lyrics for ID: ${id}`);

    const url = `${this.config.baseUrl}/get/${id}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`LRCLib API error: ${response.status} - ${await response.text()}`);
      }

      const result = await response.json();

      this.log(`Fetched: ${result.trackName} by ${result.artistName}`);

      return result;
    } catch (error: any) {
      throw new Error(`Failed to fetch from LRCLib: ${error.message}`);
    }
  }

  /**
   * Get best matching lyrics with album fallback
   * Follows match-and-segment logic: try with album first, then retry without
   *
   * @param trackName Song title
   * @param artistName Artist name
   * @param albumName Optional album name (will retry without if no matches)
   * @returns Best match or null if not found
   */
  async getBestMatch(
    trackName: string,
    artistName: string,
    albumName?: string
  ): Promise<LRCLibSearchResult | null> {
    // Try with album first (if provided)
    if (albumName) {
      this.log(`Searching with album: ${albumName}`);
      const params = new URLSearchParams({
        artist_name: artistName,
        track_name: trackName,
        album_name: albumName,
      });

      const url = `${this.config.baseUrl}/search?${params}`;
      const response = await fetch(url);

      if (response.ok) {
        const results = await response.json();
        if (results.length > 0) {
          this.log(`Found ${results.length} matches with album`);
          const best = results[0];
          this.log(`Best match: ${best.trackName} by ${best.artistName} (ID: ${best.id})`);
          return best;
        }
      }

      // If no matches with album, retry without
      this.log('No matches with album, retrying without album...');
    }

    // Search without album
    const results = await this.search(trackName, artistName);

    if (results.length === 0) {
      this.log('No results found');
      return null;
    }

    // Return first result (best match)
    const best = results[0];
    this.log(`Best match: ${best.trackName} by ${best.artistName} (ID: ${best.id})`);

    return best;
  }

  /**
   * Get plain text lyrics from synced lyrics (for forced alignment)
   * Strips timestamps and returns just the text
   */
  getPlainLyrics(syncedLyrics: string): string {
    const lines = syncedLyrics.split('\n').filter((line) => line.trim());
    const plainLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/\[[\d:.]+\]\s*(.+)/);
      if (match && match[1].trim()) {
        plainLines.push(match[1].trim());
      }
    }

    return plainLines.join('\n');
  }
}
