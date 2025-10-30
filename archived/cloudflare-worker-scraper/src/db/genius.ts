/**
 * Genius Domain - Database Operations
 * Handles Genius songs and artists
 */

import { NeonDBBase } from './base';
import type { GeniusSongData } from '../services/genius';

export class GeniusDB extends NeonDBBase {
  /**
   * Upsert Genius song data (idempotent)
   */
  async upsertGeniusSong(song: GeniusSongData): Promise<void> {
    await this.sql`
      INSERT INTO genius_songs (
        genius_song_id,
        spotify_track_id,
        title,
        artist_name,
        genius_artist_id,
        url,
        language,
        release_date,
        lyrics_state,
        annotation_count,
        pyongs_count,
        apple_music_id,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${song.genius_song_id},
        ${song.spotify_track_id},
        ${song.title},
        ${song.artist_name},
        ${song.genius_artist_id},
        ${song.url},
        ${song.language},
        ${song.release_date},
        ${song.lyrics_state},
        ${song.annotation_count},
        ${song.pyongs_count},
        ${song.apple_music_id},
        ${JSON.stringify(song.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (genius_song_id)
      DO UPDATE SET
        spotify_track_id = EXCLUDED.spotify_track_id,
        title = EXCLUDED.title,
        artist_name = EXCLUDED.artist_name,
        genius_artist_id = EXCLUDED.genius_artist_id,
        url = EXCLUDED.url,
        language = EXCLUDED.language,
        release_date = EXCLUDED.release_date,
        lyrics_state = EXCLUDED.lyrics_state,
        annotation_count = EXCLUDED.annotation_count,
        pyongs_count = EXCLUDED.pyongs_count,
        apple_music_id = EXCLUDED.apple_music_id,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert Genius songs
   */
  async batchUpsertGeniusSongs(songs: GeniusSongData[]): Promise<number> {
    if (songs.length === 0) return 0;

    let inserted = 0;
    for (const song of songs) {
      try {
        await this.upsertGeniusSong(song);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert Genius song ${song.genius_song_id}:`, error);
      }
    }

    return inserted;
  }

  /**
   * Get Spotify tracks that need Genius enrichment
   * Returns tracks that have Spotify data but no Genius match yet
   */
  async getUnenrichedGeniusTracks(limit: number = 50): Promise<Array<{
    spotify_track_id: string;
    title: string;
    artist: string;
  }>> {
    const result = await this.sql`
      SELECT
        s.spotify_track_id,
        s.title,
        s.artists[1] as artist
      FROM spotify_tracks s
      LEFT JOIN genius_songs g ON s.spotify_track_id = g.spotify_track_id
      WHERE g.genius_song_id IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      spotify_track_id: row.spotify_track_id,
      title: row.title,
      artist: row.artist,
    }));
  }
}
