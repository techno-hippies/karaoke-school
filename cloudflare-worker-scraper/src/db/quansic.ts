/**
 * Quansic Domain - Database Operations
 * Handles Quansic artist enrichment data
 */

import { NeonDBBase } from './base';
import type { QuansicArtistData } from '../quansic';

export class QuansicDB extends NeonDBBase {
  /**
   * Get MusicBrainz artists with ISNIs that need Quansic enrichment
   */
  async getUnenrichedQuansicArtists(limit: number = 10): Promise<Array<{
    mbid: string;
    name: string;
    isnis: string[];
  }>> {
    const result = await this.sql`
      SELECT ma.mbid, ma.name, ma.isnis
      FROM musicbrainz_artists ma
      LEFT JOIN quansic_artists qa ON ma.isnis[1] = qa.isni
      WHERE ma.isnis IS NOT NULL
        AND array_length(ma.isnis, 1) > 0
        AND qa.isni IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      mbid: row.mbid,
      name: row.name,
      isnis: row.isnis,
    }));
  }

  /**
   * Upsert Quansic artist data (idempotent)
   */
  async upsertQuansicArtist(artist: QuansicArtistData): Promise<void> {
    await this.sql`
      INSERT INTO quansic_artists (
        isni,
        musicbrainz_mbid,
        ipn,
        luminate_id,
        gracenote_id,
        amazon_id,
        apple_music_id,
        name_variants,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${artist.isni},
        ${artist.musicbrainz_mbid || null},
        ${artist.ipn},
        ${artist.luminate_id},
        ${artist.gracenote_id},
        ${artist.amazon_id},
        ${artist.apple_music_id},
        ${JSON.stringify(artist.name_variants)}::jsonb,
        ${JSON.stringify(artist.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (isni)
      DO UPDATE SET
        musicbrainz_mbid = COALESCE(EXCLUDED.musicbrainz_mbid, quansic_artists.musicbrainz_mbid),
        ipn = EXCLUDED.ipn,
        luminate_id = EXCLUDED.luminate_id,
        gracenote_id = EXCLUDED.gracenote_id,
        amazon_id = EXCLUDED.amazon_id,
        apple_music_id = EXCLUDED.apple_music_id,
        name_variants = EXCLUDED.name_variants,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert Quansic artists
   */
  async batchUpsertQuansicArtists(artists: QuansicArtistData[]): Promise<number> {
    if (artists.length === 0) return 0;

    let inserted = 0;
    for (const artist of artists) {
      try {
        await this.upsertQuansicArtist(artist);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert Quansic artist ${artist.isni}:`, error);
      }
    }

    return inserted;
  }
}
