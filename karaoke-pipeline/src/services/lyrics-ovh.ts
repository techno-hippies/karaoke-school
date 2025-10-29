/**
 * Lyrics.ovh API Service
 * Fallback lyrics source when LRCLIB fails
 * https://lyricsovh.docs.apiary.io/
 */

const LYRICS_OVH_API_URL = 'https://api.lyrics.ovh/v1';

export interface LyricsOvhResult {
  lyrics: string;
}

/**
 * Search for lyrics by artist and title
 * Note: lyrics.ovh has ~20-30% failure rate, so always try LRCLIB first
 */
export async function searchLyrics(
  artist: string,
  title: string
): Promise<string | null> {
  try {
    const url = `${LYRICS_OVH_API_URL}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Lyrics.ovh API error: ${response.status}`);
    }

    const data: LyricsOvhResult = await response.json();

    if (!data.lyrics || data.lyrics.trim() === '') {
      return null;
    }

    // Clean up lyrics (remove extra whitespace)
    return data.lyrics.trim();
  } catch (error: any) {
    console.error(`Lyrics.ovh search failed:`, error.message);
    return null; // Fail silently, this is a fallback source
  }
}

/**
 * Normalize lyrics text for comparison
 * Removes extra whitespace, standardizes line breaks
 */
export function normalizeLyricsText(lyrics: string): string {
  return lyrics
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '\n\n')
    .replace(/[ \t]+/g, ' ');
}
