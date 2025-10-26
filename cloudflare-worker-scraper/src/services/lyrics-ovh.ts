/**
 * Lyrics.ovh API Service
 * Fetches plain lyrics from lyrics.ovh public API
 * API: https://api.lyrics.ovh/v1/{artist}/{title}
 *
 * Note: This is a simple, free API with no authentication.
 * Rate limits unknown but appears permissive.
 */

export interface LyricsOvhData {
  lyrics: string;
}

export interface LyricsOvhError {
  error: string;
}

export class LyricsOvhService {
  private baseUrl = 'https://api.lyrics.ovh/v1';

  /**
   * Sanitize search strings for lyrics.ovh API
   * Replaces spaces with %2A (asterisk wildcard)
   */
  private sanitize(str: string): string {
    // Handle "Artist, The" -> "The Artist" format
    if (str.toLowerCase().includes(', the')) {
      str = 'the ' + str.replace(/, the/gi, '');
    }

    return str
      .replace(/\s+/g, '%2A')  // spaces -> wildcard
      .replace(/_/g, '%2A');    // underscores -> wildcard
  }

  /**
   * Get lyrics by artist and title
   * Returns null if not found
   */
  async getLyrics(params: {
    artist: string;
    title: string;
  }): Promise<string | null> {
    const artist = this.sanitize(params.artist);
    const title = this.sanitize(params.title);
    const url = `${this.baseUrl}/${artist}/${title}`;

    try {
      const response = await fetch(url);

      if (response.status === 404) {
        return null; // Track not found
      }

      if (!response.ok) {
        throw new Error(`Lyrics.ovh API error: ${response.status}`);
      }

      const data = await response.json() as LyricsOvhData | LyricsOvhError;

      if ('error' in data) {
        return null; // API returned error
      }

      // Lyrics come escaped with \n\n for paragraphs and \n for lines
      // Clean them up
      const lyrics = data.lyrics
        .replace(/\\n\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .trim();

      return lyrics || null;

    } catch (error) {
      console.error('Lyrics.ovh API error:', error);
      return null;
    }
  }

  /**
   * Check if lyrics are available without fetching full content
   * (Useful for quick availability checks)
   */
  async hasLyrics(params: {
    artist: string;
    title: string;
  }): Promise<boolean> {
    const lyrics = await this.getLyrics(params);
    return lyrics !== null && lyrics.length > 0;
  }
}
