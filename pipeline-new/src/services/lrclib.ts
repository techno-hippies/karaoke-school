/**
 * LRCLIB Service
 *
 * Free lyrics API - no authentication required.
 * https://lrclib.net/docs
 */

const LRCLIB_API_URL = 'https://lrclib.net/api';

interface LRCLibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/**
 * Search for lyrics by track name and artist
 */
export async function searchLyrics(
  trackName: string,
  artistName: string
): Promise<LRCLibTrack | null> {
  const params = new URLSearchParams({
    track_name: trackName,
    artist_name: artistName,
  });

  const response = await fetch(`${LRCLIB_API_URL}/get?${params}`, {
    headers: {
      'User-Agent': 'KaraokeSchool/1.0 (https://github.com/karaoke-school)',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`LRCLIB error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search with fuzzy matching
 */
export async function searchLyricsFuzzy(query: string): Promise<LRCLibTrack[]> {
  const params = new URLSearchParams({ q: query });

  const response = await fetch(`${LRCLIB_API_URL}/search?${params}`, {
    headers: {
      'User-Agent': 'KaraokeSchool/1.0 (https://github.com/karaoke-school)',
    },
  });

  if (!response.ok) {
    throw new Error(`LRCLIB search error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get lyrics by LRCLIB ID
 */
export async function getLyricsById(id: number): Promise<LRCLibTrack | null> {
  const response = await fetch(`${LRCLIB_API_URL}/get/${id}`, {
    headers: {
      'User-Agent': 'KaraokeSchool/1.0 (https://github.com/karaoke-school)',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`LRCLIB error: ${response.status}`);
  }

  return response.json();
}

/**
 * Parse synced lyrics (LRC format) into plain lines
 * Removes timestamps like [00:12.34]
 */
export function parseSyncedLyrics(syncedLyrics: string): string[] {
  return syncedLyrics
    .split('\n')
    .map((line) => line.replace(/^\[\d{2}:\d{2}\.\d{2,3}\]\s*/, '').trim())
    .filter((line) => line.length > 0);
}
