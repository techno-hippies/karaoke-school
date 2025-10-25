/**
 * Genius API Service
 * Searches and matches songs on Genius for lyrics metadata
 */

export interface GeniusSongData {
  genius_song_id: number;
  spotify_track_id: string;
  title: string;
  artist_name: string;
  genius_artist_id: number;
  url: string;
  raw_data: Record<string, unknown>;
}

export class GeniusService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search Genius for a song and validate artist match
   * @param title Song title (from Spotify)
   * @param artist Artist name (from Spotify)
   * @param spotifyTrackId Spotify track ID to link
   */
  async searchAndMatch(
    title: string,
    artist: string,
    spotifyTrackId: string
  ): Promise<GeniusSongData | null> {
    try {
      // Clean title: remove version suffixes that confuse Genius search
      const cleanTitle = title
        .replace(/\s*-\s*(Remastered|Live|Acoustic|Radio Edit|Extended|Remix|Version|Album Version|Single Version|Explicit|Clean).*$/i, '')
        .trim();

      const query = `${cleanTitle} ${artist}`;
      const response = await fetch(
        `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        console.error(`Genius API error: ${response.status}`);
        return null;
      }

      const data = await response.json() as any;
      const hits = data.response?.hits || [];

      if (hits.length === 0) {
        console.log(`No Genius results for: ${cleanTitle} by ${artist}`);
        return null;
      }

      // Validate: find first hit where artist name matches
      const normalizeArtist = (name: string) =>
        name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const expectedArtist = normalizeArtist(artist);

      for (const hit of hits) {
        const result = hit.result;
        const resultArtist = normalizeArtist(result.primary_artist?.name || '');

        // Check if artist names match (either direction for partial matches)
        if (resultArtist.includes(expectedArtist) || expectedArtist.includes(resultArtist)) {
          console.log(`✓ Genius match: "${result.title}" by ${result.primary_artist?.name}`);

          return {
            genius_song_id: result.id,
            spotify_track_id: spotifyTrackId,
            title: result.title,
            artist_name: result.primary_artist?.name || artist,
            genius_artist_id: result.primary_artist?.id || 0,
            url: result.url,
            raw_data: result,
          };
        }
      }

      // No validated match found
      console.log(`⚠️ No artist-validated Genius match for: ${cleanTitle} by ${artist}`);
      return null;
    } catch (error) {
      console.error('Genius search error:', error);
      return null;
    }
  }

  /**
   * Batch search multiple tracks (processes sequentially due to Genius API rate limits)
   */
  async searchBatch(
    tracks: Array<{ title: string; artist: string; spotifyTrackId: string }>
  ): Promise<GeniusSongData[]> {
    const results: GeniusSongData[] = [];

    for (const track of tracks) {
      try {
        const match = await this.searchAndMatch(
          track.title,
          track.artist,
          track.spotifyTrackId
        );

        if (match) {
          results.push(match);
        }

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to search Genius for ${track.title}:`, error);
      }
    }

    return results;
  }
}
