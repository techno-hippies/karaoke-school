/**
 * Spotify API Service
 * Fetches track metadata for enrichment
 */

export interface SpotifyTrackData {
  spotify_track_id: string;
  title: string;
  artists: string[];
  album: string;
  isrc: string;
  release_date: string;
  duration_ms: number;
  popularity: number;
  raw_data: Record<string, unknown>;
}

export interface SpotifyArtistData {
  spotify_artist_id: string;
  name: string;
  genres: string[];
  popularity: number;
  followers: number;
  images: Array<{ url: string; height: number; width: number }>;
  raw_data: Record<string, unknown>;
}

export class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private token?: { value: string; expiresAt: number };

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Get Spotify access token (cached)
   */
  private async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.token && Date.now() < this.token.expiresAt) {
      return this.token.value;
    }

    // Fetch new token using Client Credentials flow
    const authString = btoa(`${this.clientId}:${this.clientSecret}`);

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Spotify auth failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };

    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000) - 60000, // Refresh 1min early
    };

    return this.token.value;
  }

  /**
   * Fetch track metadata from Spotify
   */
  async fetchTrack(trackId: string): Promise<SpotifyTrackData> {
    const token = await this.getToken();

    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const track = await response.json() as any;

    return {
      spotify_track_id: trackId,
      title: track.name,
      artists: track.artists.map((a: any) => a.name),
      album: track.album.name,
      isrc: track.external_ids?.isrc || '',
      release_date: track.album.release_date,
      duration_ms: track.duration_ms,
      popularity: track.popularity || 0,
      raw_data: track,
    };
  }

  /**
   * Batch fetch multiple tracks (max 50 per request)
   */
  async fetchTracks(trackIds: string[]): Promise<SpotifyTrackData[]> {
    if (trackIds.length === 0) return [];

    const token = await this.getToken();
    const results: SpotifyTrackData[] = [];

    // Process in chunks of 50 (Spotify API limit)
    for (let i = 0; i < trackIds.length; i += 50) {
      const chunk = trackIds.slice(i, i + 50);
      const ids = chunk.join(',');

      const response = await fetch(
        `https://api.spotify.com/v1/tracks?ids=${ids}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.error(`Spotify batch API error: ${response.status}`);
        continue;
      }

      const data = await response.json() as { tracks: any[] };

      for (let j = 0; j < data.tracks.length; j++) {
        const track = data.tracks[j];
        if (!track) continue; // null = track not found

        results.push({
          spotify_track_id: chunk[j],
          title: track.name,
          artists: track.artists.map((a: any) => a.name),
          album: track.album.name,
          isrc: track.external_ids?.isrc || '',
          release_date: track.album.release_date,
          duration_ms: track.duration_ms,
          popularity: track.popularity || 0,
          raw_data: track,
        });
      }
    }

    return results;
  }

  /**
   * Fetch artist metadata from Spotify
   */
  async fetchArtist(artistId: string): Promise<SpotifyArtistData> {
    const token = await this.getToken();

    const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const artist = await response.json() as any;

    return {
      spotify_artist_id: artistId,
      name: artist.name,
      genres: artist.genres || [],
      popularity: artist.popularity || 0,
      followers: artist.followers?.total || 0,
      images: artist.images || [],
      raw_data: artist,
    };
  }

  /**
   * Batch fetch multiple artists (max 50 per request)
   */
  async fetchArtists(artistIds: string[]): Promise<SpotifyArtistData[]> {
    if (artistIds.length === 0) return [];

    const token = await this.getToken();
    const results: SpotifyArtistData[] = [];

    // Process in chunks of 50 (Spotify API limit)
    for (let i = 0; i < artistIds.length; i += 50) {
      const chunk = artistIds.slice(i, i + 50);
      const ids = chunk.join(',');

      const response = await fetch(
        `https://api.spotify.com/v1/artists?ids=${ids}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.error(`Spotify batch API error: ${response.status}`);
        continue;
      }

      const data = await response.json() as { artists: any[] };

      for (let j = 0; j < data.artists.length; j++) {
        const artist = data.artists[j];
        if (!artist) continue; // null = artist not found

        results.push({
          spotify_artist_id: chunk[j],
          name: artist.name,
          genres: artist.genres || [],
          popularity: artist.popularity || 0,
          followers: artist.followers?.total || 0,
          images: artist.images || [],
          raw_data: artist,
        });
      }
    }

    return results;
  }
}
