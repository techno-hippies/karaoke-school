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
