/**
 * Genius API Service
 * Searches and matches songs on Genius for lyrics metadata and corroboration
 */

export interface GeniusSongData {
  genius_song_id: number;
  spotify_track_id: string;
  title: string;
  artist_name: string;
  genius_artist_id: number;
  url: string;

  // Structured metadata (extracted from raw_data)
  language: string | null;          // ISO 639-1 code (e.g., "en", "ko", "ja")
  release_date: string | null;      // YYYY-MM-DD format
  lyrics_state: string | null;      // "complete", "incomplete", etc.
  annotation_count: number;
  pyongs_count: number;
  apple_music_id: string | null;

  raw_data: Record<string, unknown>;
}

export interface GeniusArtistData {
  genius_artist_id: number;
  name: string;
  url: string;
  image_url: string | null;
  is_verified: boolean;
  alternate_names: string[];
}

export interface GeniusFullArtistData {
  genius_artist_id: number;
  name: string;
  alternate_names: string[];
  is_verified: boolean;
  is_meme_verified: boolean;
  followers_count: number;
  image_url: string | null;
  header_image_url: string | null;
  instagram_name: string | null;
  twitter_name: string | null;
  facebook_name: string | null;
  url: string;
  api_path: string;
  raw_data: Record<string, unknown>;
}

export interface GeniusReferent {
  referent_id: number;
  genius_song_id: number;
  fragment: string;           // The lyric snippet being annotated
  classification: string;     // 'verified', 'unverified', 'contributor'
  votes_total: number;
  comment_count: number;
  is_verified: boolean;
  annotator_id: number | null;
  annotator_login: string | null;
  url: string;
  path: string;
  api_path: string;
  annotations: any[];         // Array of annotation objects
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

            // Extract structured fields
            language: result.language || null,
            release_date: result.release_date || null,
            lyrics_state: result.lyrics_state || null,
            annotation_count: result.annotation_count || 0,
            pyongs_count: result.pyongs_count || 0,
            apple_music_id: result.apple_music_id || null,

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
   * Get artist details from Genius API
   */
  async getArtist(artistId: number): Promise<GeniusArtistData | null> {
    try {
      const response = await fetch(
        `https://api.genius.com/artists/${artistId}`,
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
      const artist = data.response?.artist;

      if (!artist) {
        return null;
      }

      return {
        genius_artist_id: artist.id,
        name: artist.name,
        url: artist.url,
        image_url: artist.image_url || null,
        is_verified: artist.is_verified || false,
        alternate_names: artist.alternate_names || [],
      };
    } catch (error) {
      console.error('Genius artist fetch error:', error);
      return null;
    }
  }

  /**
   * Extract Genius handle from MusicBrainz URL
   * @param geniusUrl e.g., "https://genius.com/artists/Natasha-bedingfield"
   * @returns "Natasha-bedingfield"
   */
  static extractHandleFromUrl(geniusUrl: string): string | null {
    const match = geniusUrl.match(/genius\.com\/artists\/([^/?#]+)/i);
    return match ? match[1] : null;
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

  /**
   * Get full song details from Genius API (for database storage)
   * This includes all metadata needed for genius_songs table
   */
  async getFullSong(songId: number, spotifyTrackId?: string): Promise<GeniusSongData | null> {
    try {
      const response = await fetch(
        `https://api.genius.com/songs/${songId}`,
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
      const song = data.response?.song;

      if (!song) {
        return null;
      }

      return {
        genius_song_id: song.id,
        spotify_track_id: spotifyTrackId || '',
        title: song.title,
        artist_name: song.primary_artist?.name || '',
        genius_artist_id: song.primary_artist?.id || 0,
        url: song.url,
        language: song.language || null,
        release_date: song.release_date || null,
        lyrics_state: song.lyrics_state || null,
        annotation_count: song.annotation_count || 0,
        pyongs_count: song.pyongs_count || 0,
        apple_music_id: song.apple_music_id || null,
        raw_data: song,
      };
    } catch (error) {
      console.error('Genius song fetch error:', error);
      return null;
    }
  }

  /**
   * Get full artist details from Genius API (for genius_artists table)
   * Includes all social media handles and verification status
   */
  async getFullArtist(artistId: number): Promise<GeniusFullArtistData | null> {
    try {
      const response = await fetch(
        `https://api.genius.com/artists/${artistId}`,
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
      const artist = data.response?.artist;

      if (!artist) {
        return null;
      }

      return {
        genius_artist_id: artist.id,
        name: artist.name,
        alternate_names: artist.alternate_names || [],
        is_verified: artist.is_verified || false,
        is_meme_verified: artist.is_meme_verified || false,
        followers_count: artist.followers_count || 0,
        image_url: artist.image_url || null,
        header_image_url: artist.header_image_url || null,
        instagram_name: artist.instagram_name || null,
        twitter_name: artist.twitter_name || null,
        facebook_name: artist.facebook_name || null,
        url: artist.url,
        api_path: artist.api_path,
        raw_data: artist,
      };
    } catch (error) {
      console.error('Genius artist fetch error:', error);
      return null;
    }
  }

  /**
   * Get referents (lyrics annotations) for a song
   * These are community-contributed annotations with votes and comments
   */
  async getReferents(songId: number): Promise<GeniusReferent[]> {
    try {
      const response = await fetch(
        `https://api.genius.com/referents?song_id=${songId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        console.error(`Genius API error: ${response.status}`);
        return [];
      }

      const data = await response.json() as any;
      const referents = data.response?.referents || [];

      return referents.map((ref: any) => ({
        referent_id: ref.id,
        genius_song_id: songId,
        fragment: ref.fragment || '',
        classification: ref.classification || 'unverified',
        votes_total: ref.votes_total || 0,
        comment_count: ref.comment_count || 0,
        is_verified: ref.classification === 'verified',
        annotator_id: ref.annotator_id || null,
        annotator_login: ref.annotator_login || null,
        url: ref.url || '',
        path: ref.path || '',
        api_path: ref.api_path || '',
        annotations: ref.annotations || [],
        raw_data: ref,
      }));
    } catch (error) {
      console.error('Genius referents fetch error:', error);
      return [];
    }
  }
}
