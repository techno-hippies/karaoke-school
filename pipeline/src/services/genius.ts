/**
 * Genius API Service
 *
 * Fetch lyrics and annotations from Genius.
 */

import { GENIUS_API_KEY } from '../config';

const GENIUS_API_URL = 'https://api.genius.com';

interface GeniusSong {
  id: number;
  title: string;
  url: string;
  primary_artist: {
    id: number;
    name: string;
  };
}

interface GeniusSearchResult {
  response: {
    hits: Array<{
      result: GeniusSong;
    }>;
  };
}

interface GeniusSongResponse {
  response: {
    song: GeniusSong & {
      description: {
        plain: string;
      };
    };
  };
}

/**
 * Search for a song on Genius
 */
export async function searchGenius(query: string): Promise<GeniusSong | null> {
  if (!GENIUS_API_KEY) {
    throw new Error('GENIUS_API_KEY not configured');
  }

  const response = await fetch(
    `${GENIUS_API_URL}/search?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${GENIUS_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Genius search failed: ${response.status}`);
  }

  const data: GeniusSearchResult = await response.json();
  return data.response.hits[0]?.result || null;
}

/**
 * Scrape lyrics from Genius page
 *
 * Note: Genius doesn't provide lyrics via API, we need to scrape the page.
 */
export async function scrapeLyrics(geniusUrl: string): Promise<string> {
  const response = await fetch(geniusUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Genius page: ${response.status}`);
  }

  const html = await response.text();

  // Extract lyrics from the page
  // Genius uses data-lyrics-container="true" for lyrics divs
  const lyricsMatch = html.match(
    /data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g
  );

  if (!lyricsMatch) {
    throw new Error('Could not find lyrics on Genius page');
  }

  // Clean HTML tags and decode entities
  let lyrics = lyricsMatch
    .map((div) => {
      return div
        .replace(/data-lyrics-container="true"[^>]*>/, '')
        .replace(/<\/div>$/, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&nbsp;/g, ' ');
    })
    .join('\n');

  // Clean up extra whitespace
  lyrics = lyrics
    .split('\n')
    .map((line) => line.trim())
    .filter((line, i, arr) => {
      // Remove consecutive empty lines
      if (line === '' && arr[i - 1] === '') return false;
      return true;
    })
    .join('\n')
    .trim();

  return lyrics;
}

/**
 * Fetch referents (annotations) for a song
 */
export async function fetchReferents(
  songId: number
): Promise<
  Array<{
    id: number;
    fragment: string;
    classification: string;
    annotations: Array<{
      body: { plain: string };
      verified: boolean;
      votes_total: number;
    }>;
  }>
> {
  if (!GENIUS_API_KEY) {
    throw new Error('GENIUS_API_KEY not configured');
  }

  const response = await fetch(
    `${GENIUS_API_URL}/referents?song_id=${songId}&per_page=50&text_format=plain`,
    {
      headers: {
        Authorization: `Bearer ${GENIUS_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Genius referents fetch failed: ${response.status}`);
  }

  const data = await response.json();
  return data.response.referents || [];
}
