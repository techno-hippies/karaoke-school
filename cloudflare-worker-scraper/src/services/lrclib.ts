/**
 * LRCLIB API Service
 * Fetches synchronized and plain lyrics from LRCLIB's crowdsourced database
 * API Documentation: https://lrclib.net/docs
 */

export interface LRCLIBLyricsData {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number; // seconds
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface LRCLIBSearchResult extends LRCLIBLyricsData {}

export class LRCLIBService {
  private baseUrl = 'https://lrclib.net/api';
  private userAgent = 'KaraokeSchool/1.0 (https://github.com/karaoke-school)';

  /**
   * Get lyrics by exact track signature (preferred method)
   * Returns best match when duration is within ±2 seconds
   */
  async getLyrics(params: {
    track_name: string;
    artist_name: string;
    album_name: string;
    duration: number; // seconds
  }): Promise<LRCLIBLyricsData | null> {
    const url = `${this.baseUrl}/get`;
    const queryParams = new URLSearchParams({
      track_name: params.track_name,
      artist_name: params.artist_name,
      album_name: params.album_name,
      duration: params.duration.toString(),
    });

    try {
      const response = await fetch(`${url}?${queryParams}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (response.status === 404) {
        // Cancel response body to prevent Cloudflare Worker deadlock
        await response.body?.cancel();
        return null; // Track not found
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`LRCLIB API error: ${response.status}`);
      }

      return await response.json() as LRCLIBLyricsData;
    } catch (error) {
      console.error('LRCLIB getLyrics error:', error);
      return null;
    }
  }

  /**
   * Search for lyrics (fallback when exact match fails)
   * Returns array of potential matches
   */
  async searchLyrics(params: {
    track_name?: string;
    artist_name?: string;
    album_name?: string;
    q?: string; // Generic search query
  }): Promise<LRCLIBSearchResult[]> {
    const url = `${this.baseUrl}/search`;
    const queryParams = new URLSearchParams();

    if (params.q) {
      queryParams.set('q', params.q);
    }
    if (params.track_name) {
      queryParams.set('track_name', params.track_name);
    }
    if (params.artist_name) {
      queryParams.set('artist_name', params.artist_name);
    }
    if (params.album_name) {
      queryParams.set('album_name', params.album_name);
    }

    try {
      const response = await fetch(`${url}?${queryParams}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`LRCLIB API error: ${response.status}`);
      }

      return await response.json() as LRCLIBSearchResult[];
    } catch (error) {
      console.error('LRCLIB searchLyrics error:', error);
      return [];
    }
  }

  /**
   * Get lyrics by LRCLIB ID (for retrieving specific known record)
   */
  async getLyricsById(id: number): Promise<LRCLIBLyricsData | null> {
    const url = `${this.baseUrl}/get/${id}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`LRCLIB API error: ${response.status}`);
      }

      return await response.json() as LRCLIBLyricsData;
    } catch (error) {
      console.error('LRCLIB getLyricsById error:', error);
      return null;
    }
  }
}

/**
 * Normalize track title for better matching
 * Removes version suffixes, parentheticals, and special characters
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '') // Remove (Remastered), (Live), etc.
    .replace(/\s*\[.*?\]\s*/g, '') // Remove [Explicit], [Clean], etc.
    .replace(/\s*-\s*(slowed|sped up|remix|edit|version|remaster).*$/i, '')
    .replace(/[^\w\s]/g, '') // Remove special chars
    .trim();
}

/**
 * Normalize artist name for better matching
 * Removes featured artists and special characters
 */
export function normalizeArtist(artist: string): string {
  return artist
    .toLowerCase()
    .replace(/\s*feat\.?\s*.*/i, '') // Remove features
    .replace(/\s*ft\.?\s*.*/i, '')
    .replace(/\s*&\s*/, ' ')
    .replace(/,.*$/, '') // Take first artist only
    .trim();
}

/**
 * Calculate match confidence score between LRCLIB result and track data
 * Returns score from 0.0 to 1.0
 */
export function calculateMatchScore(
  result: LRCLIBLyricsData,
  track: {
    title: string;
    artist: string;
    album: string;
    duration: number;
  }
): number {
  let score = 0.0;

  // Duration match (±3 seconds = perfect, ±10 seconds = acceptable)
  const durationDiff = Math.abs(result.duration - track.duration);
  if (durationDiff <= 3) {
    score += 0.4;
  } else if (durationDiff <= 10) {
    score += 0.2;
  }

  // Title match (exact normalized = 0.4, similar = 0.2)
  const normalizedTitle1 = normalizeTitle(track.title);
  const normalizedTitle2 = normalizeTitle(result.trackName);
  if (normalizedTitle1 === normalizedTitle2) {
    score += 0.4;
  } else if (normalizedTitle1.includes(normalizedTitle2) || normalizedTitle2.includes(normalizedTitle1)) {
    score += 0.2;
  }

  // Artist match (exact normalized = 0.2, contains = 0.1)
  const normalizedArtist1 = normalizeArtist(track.artist);
  const normalizedArtist2 = normalizeArtist(result.artistName);
  if (normalizedArtist1 === normalizedArtist2) {
    score += 0.2;
  } else if (normalizedArtist1.includes(normalizedArtist2) || normalizedArtist2.includes(normalizedArtist1)) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}
