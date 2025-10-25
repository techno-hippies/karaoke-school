/**
 * Spotify Domain - Database Operations
 * Handles Spotify tracks and artists
 */

import { NeonDBBase } from './base';
import type { SpotifyTrackData, SpotifyArtistData } from '../spotify';

export class SpotifyDB extends NeonDBBase {
  /**
   * Upsert Spotify track data (idempotent)
   * Also upserts artists and maintains track-artist relationships
   */
  async upsertSpotifyTrack(track: SpotifyTrackData): Promise<void> {
    // 1. Upsert the track
    await this.sql`
      INSERT INTO spotify_tracks (
        spotify_track_id,
        title,
        artists,
        album,
        isrc,
        release_date,
        duration_ms,
        popularity,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${track.spotify_track_id},
        ${track.title},
        ${track.artists}::text[],
        ${track.album},
        ${track.isrc},
        ${track.release_date},
        ${track.duration_ms},
        ${track.popularity},
        ${JSON.stringify(track.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (spotify_track_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        artists = EXCLUDED.artists,
        album = EXCLUDED.album,
        isrc = EXCLUDED.isrc,
        release_date = EXCLUDED.release_date,
        duration_ms = EXCLUDED.duration_ms,
        popularity = EXCLUDED.popularity,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;

    // 2. Extract artist data from raw_data
    const rawArtists = (track.raw_data as any).artists || [];

    // 3. Upsert each artist
    for (const artist of rawArtists) {
      await this.sql`
        INSERT INTO spotify_artists (
          spotify_artist_id,
          name,
          raw_data,
          fetched_at,
          updated_at
        )
        VALUES (
          ${artist.id},
          ${artist.name},
          ${JSON.stringify(artist)}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (spotify_artist_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `;
    }

    // 4. Delete existing track-artist relationships
    await this.sql`
      DELETE FROM spotify_track_artists
      WHERE spotify_track_id = ${track.spotify_track_id}
    `;

    // 5. Insert new track-artist relationships
    for (let i = 0; i < rawArtists.length; i++) {
      const artist = rawArtists[i];
      await this.sql`
        INSERT INTO spotify_track_artists (
          spotify_track_id,
          spotify_artist_id,
          artist_position
        )
        VALUES (
          ${track.spotify_track_id},
          ${artist.id},
          ${i}
        )
        ON CONFLICT (spotify_track_id, spotify_artist_id)
        DO UPDATE SET
          artist_position = EXCLUDED.artist_position
      `;
    }
  }

  /**
   * Batch upsert Spotify tracks
   */
  async batchUpsertSpotifyTracks(tracks: SpotifyTrackData[]): Promise<number> {
    if (tracks.length === 0) return 0;

    let inserted = 0;
    for (const track of tracks) {
      try {
        await this.upsertSpotifyTrack(track);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert Spotify track ${track.spotify_track_id}:`, error);
      }
    }

    return inserted;
  }

  /**
   * Get unique Spotify track IDs that need enrichment
   */
  async getUnenrichedSpotifyTracks(limit: number = 100): Promise<string[]> {
    const result = await this.sql`
      SELECT DISTINCT v.spotify_track_id
      FROM tiktok_scraped_videos v
      LEFT JOIN spotify_tracks s ON v.spotify_track_id = s.spotify_track_id
      WHERE v.spotify_track_id IS NOT NULL
        AND s.spotify_track_id IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => row.spotify_track_id);
  }

  /**
   * Extract unique Spotify artist IDs from spotify_tracks that need enrichment
   * Uses raw_data.artists[].id from Spotify API response
   */
  async getUnenrichedSpotifyArtists(limit: number = 50): Promise<string[]> {
    const result = await this.sql`
      WITH artist_ids AS (
        SELECT DISTINCT jsonb_array_elements(raw_data->'artists')->>'id' as artist_id
        FROM spotify_tracks
      )
      SELECT a.artist_id
      FROM artist_ids a
      LEFT JOIN spotify_artists s ON a.artist_id = s.spotify_artist_id
      WHERE a.artist_id IS NOT NULL
        AND s.spotify_artist_id IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => row.artist_id);
  }

  /**
   * Upsert Spotify artist data (idempotent)
   */
  async upsertSpotifyArtist(artist: SpotifyArtistData): Promise<void> {
    await this.sql`
      INSERT INTO spotify_artists (
        spotify_artist_id,
        name,
        genres,
        popularity,
        followers,
        images,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${artist.spotify_artist_id},
        ${artist.name},
        ${artist.genres}::text[],
        ${artist.popularity},
        ${artist.followers},
        ${JSON.stringify(artist.images)}::jsonb,
        ${JSON.stringify(artist.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (spotify_artist_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        genres = EXCLUDED.genres,
        popularity = EXCLUDED.popularity,
        followers = EXCLUDED.followers,
        images = EXCLUDED.images,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert Spotify artists
   */
  async batchUpsertSpotifyArtists(artists: SpotifyArtistData[]): Promise<number> {
    if (artists.length === 0) return 0;

    let inserted = 0;
    for (const artist of artists) {
      try {
        await this.upsertSpotifyArtist(artist);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert Spotify artist ${artist.spotify_artist_id}:`, error);
      }
    }

    return inserted;
  }
}
