/**
 * Artist Images Domain - Database Operations
 * Tracks generated derivative artist images from fal.ai
 */

import { NeonDBBase } from './base';

export interface ArtistImageData {
  spotify_artist_id: string;
  original_image_url: string;
  fal_request_id: string;
  generated_image_url?: string;
  seed?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export class ArtistImagesDB extends NeonDBBase {
  /**
   * Upsert artist image generation record
   */
  async upsertArtistImage(data: ArtistImageData): Promise<void> {
    await this.sql`
      INSERT INTO artist_images (
        spotify_artist_id,
        original_image_url,
        fal_request_id,
        generated_image_url,
        seed,
        status,
        error,
        created_at,
        updated_at
      )
      VALUES (
        ${data.spotify_artist_id},
        ${data.original_image_url},
        ${data.fal_request_id},
        ${data.generated_image_url || null},
        ${data.seed || null},
        ${data.status},
        ${data.error || null},
        NOW(),
        NOW()
      )
      ON CONFLICT (spotify_artist_id)
      DO UPDATE SET
        original_image_url = EXCLUDED.original_image_url,
        fal_request_id = EXCLUDED.fal_request_id,
        generated_image_url = EXCLUDED.generated_image_url,
        seed = EXCLUDED.seed,
        status = EXCLUDED.status,
        error = EXCLUDED.error,
        updated_at = NOW()
    `;
  }

  /**
   * Get artists that need image generation (have Spotify images but no generated images)
   */
  async getArtistsNeedingImages(limit: number = 50): Promise<Array<{
    spotify_artist_id: string;
    name: string;
    image_url: string;
  }>> {
    const result = await this.sql`
      SELECT
        sa.spotify_artist_id,
        sa.name,
        sa.images->0->>'url' as image_url
      FROM spotify_artists sa
      LEFT JOIN artist_images ai ON sa.spotify_artist_id = ai.spotify_artist_id
      WHERE
        sa.images IS NOT NULL
        AND jsonb_array_length(sa.images) > 0
        AND (
          ai.spotify_artist_id IS NULL
          OR ai.status = 'failed'
        )
      ORDER BY sa.popularity DESC NULLS LAST
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      spotify_artist_id: row.spotify_artist_id,
      name: row.name,
      image_url: row.image_url,
    }));
  }

  /**
   * Get pending image generation requests
   */
  async getPendingImageRequests(limit: number = 20): Promise<Array<{
    spotify_artist_id: string;
    fal_request_id: string;
    original_image_url: string;
  }>> {
    const result = await this.sql`
      SELECT
        spotify_artist_id,
        fal_request_id,
        original_image_url
      FROM artist_images
      WHERE status IN ('pending', 'processing')
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      spotify_artist_id: row.spotify_artist_id,
      fal_request_id: row.fal_request_id,
      original_image_url: row.original_image_url,
    }));
  }

  /**
   * Get artist image generation statistics
   */
  async getImageStats(): Promise<{
    total_artists: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    needs_generation: number;
  }> {
    const result = await this.sql`
      WITH artist_counts AS (
        SELECT COUNT(*) as total_artists
        FROM spotify_artists
        WHERE images IS NOT NULL AND jsonb_array_length(images) > 0
      ),
      image_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'processing') as processing,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM artist_images
      ),
      needs_gen AS (
        SELECT COUNT(*) as needs_generation
        FROM spotify_artists sa
        LEFT JOIN artist_images ai ON sa.spotify_artist_id = ai.spotify_artist_id
        WHERE
          sa.images IS NOT NULL
          AND jsonb_array_length(sa.images) > 0
          AND ai.spotify_artist_id IS NULL
      )
      SELECT
        (SELECT total_artists FROM artist_counts) as total_artists,
        COALESCE((SELECT pending FROM image_stats), 0) as pending,
        COALESCE((SELECT processing FROM image_stats), 0) as processing,
        COALESCE((SELECT completed FROM image_stats), 0) as completed,
        COALESCE((SELECT failed FROM image_stats), 0) as failed,
        (SELECT needs_generation FROM needs_gen) as needs_generation
    `;

    return result[0] as any;
  }

  /**
   * Get artist image by Spotify artist ID
   */
  async getArtistImage(spotifyArtistId: string): Promise<ArtistImageData | null> {
    const result = await this.sql`
      SELECT
        spotify_artist_id,
        original_image_url,
        fal_request_id,
        generated_image_url,
        seed,
        status,
        error
      FROM artist_images
      WHERE spotify_artist_id = ${spotifyArtistId}
    `;

    if (result.length === 0) return null;

    return result[0] as ArtistImageData;
  }
}
