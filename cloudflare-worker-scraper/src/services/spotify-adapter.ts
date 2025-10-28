/**
 * Spotify Adapter - Dump-First Pattern
 *
 * Checks local 2.1M track dump first, falls back to API only if needed.
 * Reduces API calls by 90%+
 */

import { NeonDB } from '../neon';
import { SpotifyAPI } from './spotify';

interface SpotifyTrack {
  spotify_track_id: string;
  title: string;
  artists: string[];
  isrc: string | null;
  duration_ms: number;
  album_name: string;
  album_id: string;
  popularity: number;
  explicit: boolean;
  release_date: string;
  image_url: string | null;
  source: 'dump' | 'api'; // Track where data came from
}

interface SpotifyArtist {
  spotify_artist_id: string;
  name: string;
  genres: string[];
  popularity: number;
  image_url: string | null;
  followers: number | null;
  source: 'dump' | 'api';
}

export class SpotifyAdapter {
  constructor(
    private db: NeonDB,
    private api: SpotifyAPI
  ) {}

  /**
   * Get track - checks dump first, then API
   */
  async getTrack(spotifyTrackId: string): Promise<SpotifyTrack | null> {
    // 1. Try dump first (2.1M tracks, instant lookup)
    const dumpTrack = await this.getTrackFromDump(spotifyTrackId);
    if (dumpTrack) {
      console.log(`✅ Track ${spotifyTrackId} found in dump`);
      return dumpTrack;
    }

    // 2. Fallback to API
    console.log(`⚠️ Track ${spotifyTrackId} not in dump, calling API`);
    const apiTrack = await this.getTrackFromAPI(spotifyTrackId);

    // 3. Cache API response in our spotify_tracks table
    if (apiTrack) {
      await this.cacheTrack(apiTrack);
    }

    return apiTrack;
  }

  /**
   * Get artist - checks dump first, then API
   */
  async getArtist(spotifyArtistId: string): Promise<SpotifyArtist | null> {
    // 1. Try dump first
    const dumpArtist = await this.getArtistFromDump(spotifyArtistId);
    if (dumpArtist) {
      console.log(`✅ Artist ${spotifyArtistId} found in dump`);
      return dumpArtist;
    }

    // 2. Fallback to API
    console.log(`⚠️ Artist ${spotifyArtistId} not in dump, calling API`);
    const apiArtist = await this.getArtistFromAPI(spotifyArtistId);

    // 3. Cache API response
    if (apiArtist) {
      await this.cacheArtist(apiArtist);
    }

    return apiArtist;
  }

  /**
   * Get ISRC for a track (prioritizes dump)
   */
  async getISRC(spotifyTrackId: string): Promise<string | null> {
    // Try dump first
    const result = await this.db.query<{ value: string }>(`
      SELECT value
      FROM spotify_track_externalid
      WHERE trackid = $1 AND name = 'isrc'
      LIMIT 1
    `, [spotifyTrackId]);

    if (result[0]?.value) {
      return result[0].value;
    }

    // Fallback to our cached spotify_tracks table
    const cached = await this.db.query<{ isrc: string }>(`
      SELECT isrc FROM spotify_tracks
      WHERE spotify_track_id = $1
      LIMIT 1
    `, [spotifyTrackId]);

    if (cached[0]?.isrc) {
      return cached[0].isrc;
    }

    // Last resort: API
    const track = await this.getTrackFromAPI(spotifyTrackId);
    return track?.isrc || null;
  }

  /**
   * Batch get tracks (optimized for dump lookups)
   */
  async getTracks(spotifyTrackIds: string[]): Promise<Map<string, SpotifyTrack>> {
    const results = new Map<string, SpotifyTrack>();

    // 1. Batch query dump
    const dumpTracks = await this.getTracksFromDump(spotifyTrackIds);
    for (const track of dumpTracks) {
      results.set(track.spotify_track_id, track);
    }

    // 2. Find missing IDs
    const missingIds = spotifyTrackIds.filter(id => !results.has(id));

    // 3. Batch fetch from API (Spotify allows 50 at a time)
    if (missingIds.length > 0) {
      console.log(`⚠️ ${missingIds.length} tracks not in dump, calling API`);
      const apiTracks = await this.getTracksFromAPI(missingIds);
      for (const track of apiTracks) {
        results.set(track.spotify_track_id, track);
      }
    }

    return results;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Query dump tables (imported from 2.1M track dataset)
   */
  private async getTrackFromDump(trackId: string): Promise<SpotifyTrack | null> {
    const result = await this.db.query<{
      trackid: string;
      name: string;
      durationms: number;
      explicit: boolean;
      popularity: number;
      albumid: string;
      album_name: string;
      release_date: string;
      isrc: string | null;
      artists: string[];
      image_url: string | null;
    }>(`
      SELECT
        t.trackid,
        t.name,
        t.durationms,
        t.explicit,
        t.popularity,
        t.albumid,
        a.name as album_name,
        a.releasedate as release_date,
        e.value as isrc,
        COALESCE(
          array_agg(DISTINCT art.name ORDER BY art.name) FILTER (WHERE art.name IS NOT NULL),
          ARRAY[]::text[]
        ) as artists,
        (SELECT url FROM spotify_album_image WHERE albumid = t.albumid ORDER BY height DESC LIMIT 1) as image_url
      FROM spotify_track t
      LEFT JOIN spotify_album a ON t.albumid = a.id
      LEFT JOIN spotify_track_externalid e ON t.trackid = e.trackid AND e.name = 'isrc'
      LEFT JOIN spotify_track_artist ta ON t.trackid = ta.trackid
      LEFT JOIN spotify_artist art ON ta.artistid = art.id
      WHERE t.trackid = $1
      GROUP BY t.trackid, t.name, t.durationms, t.explicit, t.popularity, t.albumid, a.name, a.releasedate, e.value
    `, [trackId]);

    if (!result[0]) return null;

    const row = result[0];
    return {
      spotify_track_id: row.trackid,
      title: row.name,
      artists: row.artists,
      isrc: row.isrc,
      duration_ms: row.durationms,
      album_name: row.album_name,
      album_id: row.albumid,
      popularity: row.popularity,
      explicit: row.explicit,
      release_date: row.release_date,
      image_url: row.image_url,
      source: 'dump'
    };
  }

  private async getArtistFromDump(artistId: string): Promise<SpotifyArtist | null> {
    const result = await this.db.query<{
      id: string;
      name: string;
      popularity: number;
      image_url: string | null;
    }>(`
      SELECT
        a.id,
        a.name,
        a.popularity,
        (SELECT url FROM spotify_artist_image WHERE artistid = a.id ORDER BY height DESC LIMIT 1) as image_url
      FROM spotify_artist a
      WHERE a.id = $1
    `, [artistId]);

    if (!result[0]) return null;

    const row = result[0];
    return {
      spotify_artist_id: row.id,
      name: row.name,
      genres: [], // Dump doesn't have genres
      popularity: row.popularity,
      image_url: row.image_url,
      followers: null, // Dump doesn't have followers
      source: 'dump'
    };
  }

  private async getTracksFromDump(trackIds: string[]): Promise<SpotifyTrack[]> {
    const result = await this.db.query<{
      trackid: string;
      name: string;
      durationms: number;
      explicit: boolean;
      popularity: number;
      albumid: string;
      album_name: string;
      release_date: string;
      isrc: string | null;
      artists: string[];
      image_url: string | null;
    }>(`
      SELECT
        t.trackid,
        t.name,
        t.durationms,
        t.explicit,
        t.popularity,
        t.albumid,
        a.name as album_name,
        a.releasedate as release_date,
        e.value as isrc,
        COALESCE(
          array_agg(DISTINCT art.name ORDER BY art.name) FILTER (WHERE art.name IS NOT NULL),
          ARRAY[]::text[]
        ) as artists,
        (SELECT url FROM spotify_album_image WHERE albumid = t.albumid ORDER BY height DESC LIMIT 1) as image_url
      FROM spotify_track t
      LEFT JOIN spotify_album a ON t.albumid = a.id
      LEFT JOIN spotify_track_externalid e ON t.trackid = e.trackid AND e.name = 'isrc'
      LEFT JOIN spotify_track_artist ta ON t.trackid = ta.trackid
      LEFT JOIN spotify_artist art ON ta.artistid = art.id
      WHERE t.trackid = ANY($1)
      GROUP BY t.trackid, t.name, t.durationms, t.explicit, t.popularity, t.albumid, a.name, a.releasedate, e.value
    `, [trackIds]);

    return result.map(row => ({
      spotify_track_id: row.trackid,
      title: row.name,
      artists: row.artists,
      isrc: row.isrc,
      duration_ms: row.durationms,
      album_name: row.album_name,
      album_id: row.albumid,
      popularity: row.popularity,
      explicit: row.explicit,
      release_date: row.release_date,
      image_url: row.image_url,
      source: 'dump' as const
    }));
  }

  /**
   * Call Spotify API (fallback)
   */
  private async getTrackFromAPI(trackId: string): Promise<SpotifyTrack | null> {
    try {
      const apiResponse = await this.api.getTrack(trackId);

      return {
        spotify_track_id: apiResponse.id,
        title: apiResponse.name,
        artists: apiResponse.artists.map((a: any) => a.name),
        isrc: apiResponse.external_ids?.isrc || null,
        duration_ms: apiResponse.duration_ms,
        album_name: apiResponse.album.name,
        album_id: apiResponse.album.id,
        popularity: apiResponse.popularity,
        explicit: apiResponse.explicit,
        release_date: apiResponse.album.release_date,
        image_url: apiResponse.album.images[0]?.url || null,
        source: 'api'
      };
    } catch (error) {
      console.error(`Failed to fetch track ${trackId} from API:`, error);
      return null;
    }
  }

  private async getArtistFromAPI(artistId: string): Promise<SpotifyArtist | null> {
    try {
      const apiResponse = await this.api.getArtist(artistId);

      return {
        spotify_artist_id: apiResponse.id,
        name: apiResponse.name,
        genres: apiResponse.genres || [],
        popularity: apiResponse.popularity,
        image_url: apiResponse.images[0]?.url || null,
        followers: apiResponse.followers?.total || null,
        source: 'api'
      };
    } catch (error) {
      console.error(`Failed to fetch artist ${artistId} from API:`, error);
      return null;
    }
  }

  private async getTracksFromAPI(trackIds: string[]): Promise<SpotifyTrack[]> {
    // Spotify API allows 50 tracks per request
    const chunks = [];
    for (let i = 0; i < trackIds.length; i += 50) {
      chunks.push(trackIds.slice(i, i + 50));
    }

    const tracks: SpotifyTrack[] = [];
    for (const chunk of chunks) {
      try {
        const response = await this.api.getTracks(chunk);
        for (const track of response.tracks) {
          if (track) {
            tracks.push({
              spotify_track_id: track.id,
              title: track.name,
              artists: track.artists.map((a: any) => a.name),
              isrc: track.external_ids?.isrc || null,
              duration_ms: track.duration_ms,
              album_name: track.album.name,
              album_id: track.album.id,
              popularity: track.popularity,
              explicit: track.explicit,
              release_date: track.album.release_date,
              image_url: track.album.images[0]?.url || null,
              source: 'api'
            });
          }
        }
      } catch (error) {
        console.error(`Failed to batch fetch tracks:`, error);
      }
    }

    return tracks;
  }

  /**
   * Cache API responses to our spotify_tracks table
   */
  private async cacheTrack(track: SpotifyTrack): Promise<void> {
    await this.db.query(`
      INSERT INTO spotify_tracks (
        spotify_track_id, title, artists, isrc,
        duration_ms, album_name, popularity, explicit,
        raw_data, fetched_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (spotify_track_id) DO UPDATE SET
        title = EXCLUDED.title,
        artists = EXCLUDED.artists,
        isrc = EXCLUDED.isrc,
        duration_ms = EXCLUDED.duration_ms,
        album_name = EXCLUDED.album_name,
        popularity = EXCLUDED.popularity,
        explicit = EXCLUDED.explicit,
        raw_data = EXCLUDED.raw_data,
        fetched_at = NOW()
    `, [
      track.spotify_track_id,
      track.title,
      track.artists,
      track.isrc,
      track.duration_ms,
      track.album_name,
      track.popularity,
      track.explicit,
      JSON.stringify(track) // Store full response
    ]);
  }

  private async cacheArtist(artist: SpotifyArtist): Promise<void> {
    await this.db.query(`
      INSERT INTO spotify_artists (
        spotify_artist_id, name, genres, popularity,
        raw_data, fetched_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (spotify_artist_id) DO UPDATE SET
        name = EXCLUDED.name,
        genres = EXCLUDED.genres,
        popularity = EXCLUDED.popularity,
        raw_data = EXCLUDED.raw_data,
        fetched_at = NOW()
    `, [
      artist.spotify_artist_id,
      artist.name,
      artist.genres,
      artist.popularity,
      JSON.stringify(artist)
    ]);
  }

  /**
   * Get statistics on dump vs API usage
   */
  async getUsageStats(): Promise<{
    dump_hits: number;
    api_calls: number;
    cache_rate: number;
  }> {
    const result = await this.db.query<{
      source: string;
      count: number;
    }>(`
      SELECT source, COUNT(*) as count
      FROM processing_log
      WHERE stage IN ('spotify_resolve', 'spotify_track', 'spotify_artist')
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY source
    `);

    const dumpHits = result.find(r => r.source === 'dump')?.count || 0;
    const apiCalls = result.find(r => r.source === 'api')?.count || 0;
    const total = dumpHits + apiCalls;

    return {
      dump_hits: dumpHits,
      api_calls: apiCalls,
      cache_rate: total > 0 ? dumpHits / total : 0
    };
  }
}
