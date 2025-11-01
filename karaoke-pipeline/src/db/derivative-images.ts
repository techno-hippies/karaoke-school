/**
 * Derivative Images Database Operations
 *
 * Manages watercolor-style derivative images for karaoke tracks/artists
 * These are app-generated, NOT GRC-20 related
 */

import { neon } from '@neondatabase/serverless';

export interface TrackWithImage {
  spotify_track_id: string;
  title: string;
  artist_name: string;
  image_url: string | null;
  image_source: string | null;
  genius_image_url: string | null;
}

export interface ArtistWithImage {
  artist_name: string;
  spotify_artist_id: string;
  image_url: string;
}

/**
 * Get tracks needing derivative images
 * (karaoke segments with artist images, no derivative yet)
 */
export async function getTracksNeedingDerivativeImages(
  databaseUrl: string,
  limit: number = 10
): Promise<TrackWithImage[]> {
  const sql = neon(databaseUrl);

  const result = await sql`
    SELECT
      ks.spotify_track_id,
      st.title,
      sa.name as artist_name,
      st.image_url,
      'spotify' as image_source,
      gs.raw_data->>'song_art_image_url' as genius_image_url
    FROM karaoke_segments ks
    JOIN spotify_tracks st ON ks.spotify_track_id = st.spotify_track_id
    JOIN spotify_artists sa ON sa.spotify_artist_id = (st.artists->0->>'id')
    LEFT JOIN genius_songs gs ON gs.spotify_track_id = ks.spotify_track_id
    WHERE st.image_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM derivative_images di
        WHERE di.spotify_track_id = ks.spotify_track_id
          AND di.asset_type = 'track'
      )
    ORDER BY ks.spotify_track_id ASC
    LIMIT ${limit}
  `;

  return result as TrackWithImage[];
}

/**
 * Get artists needing derivative images
 * (unique artists from karaoke_segments that have images)
 */
export async function getArtistsNeedingDerivativeImages(
  databaseUrl: string,
  limit: number = 10
): Promise<ArtistWithImage[]> {
  const sql = neon(databaseUrl);

  const result = await sql`
    SELECT DISTINCT
      sa.name as artist_name,
      sa.spotify_artist_id,
      sa.image_url
    FROM karaoke_segments ks
    JOIN spotify_tracks st ON ks.spotify_track_id = st.spotify_track_id
    JOIN spotify_artists sa ON sa.spotify_artist_id = (st.artists->0->>'id')
    WHERE sa.image_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM derivative_images di
        WHERE di.artist_name = sa.name
          AND di.asset_type = 'artist'
      )
    ORDER BY sa.name ASC
    LIMIT ${limit}
  `;

  return result as ArtistWithImage[];
}

/**
 * Store track derivative image (full-size + optional thumbnail)
 */
export async function saveTrackDerivativeImage(
  databaseUrl: string,
  spotifyTrackId: string,
  groveData: {
    cid: string;
    url: string;
  },
  imageSource: string = 'spotify',
  thumbnailGroveData?: {
    cid: string;
    url: string;
  },
  sourceImageUrl?: string
): Promise<void> {
  const sql = neon(databaseUrl);

  // Check if image already exists
  const existing = await sql`
    SELECT id FROM derivative_images
    WHERE spotify_track_id = ${spotifyTrackId} AND asset_type = 'track'
  `;

  if (existing.length > 0) {
    // Update existing record
    await sql`
      UPDATE derivative_images
      SET grove_cid = ${groveData.cid},
          grove_url = ${groveData.url},
          thumbnail_grove_cid = ${thumbnailGroveData?.cid || null},
          thumbnail_grove_url = ${thumbnailGroveData?.url || null},
          source_image_url = ${sourceImageUrl || null},
          generated_at = NOW()
      WHERE spotify_track_id = ${spotifyTrackId} AND asset_type = 'track'
    `;
  } else {
    // Insert new record
    await sql`
      INSERT INTO derivative_images (asset_type, spotify_track_id, grove_cid, grove_url, thumbnail_grove_cid, thumbnail_grove_url, image_source, source_image_url)
      VALUES ('track', ${spotifyTrackId}, ${groveData.cid}, ${groveData.url}, ${thumbnailGroveData?.cid || null}, ${thumbnailGroveData?.url || null}, ${imageSource}, ${sourceImageUrl || null})
    `;
  }
}

/**
 * Store artist derivative image (full-size + optional thumbnail)
 */
export async function saveArtistDerivativeImage(
  databaseUrl: string,
  artistName: string,
  spotifyArtistId: string | null,
  groveData: {
    cid: string;
    url: string;
  },
  imageSource: string = 'spotify',
  thumbnailGroveData?: {
    cid: string;
    url: string;
  },
  sourceImageUrl?: string
): Promise<void> {
  const sql = neon(databaseUrl);

  await sql`
    INSERT INTO derivative_images (asset_type, artist_name, spotify_artist_id, grove_cid, grove_url, thumbnail_grove_cid, thumbnail_grove_url, image_source, source_image_url)
    VALUES ('artist', ${artistName}, ${spotifyArtistId}, ${groveData.cid}, ${groveData.url}, ${thumbnailGroveData?.cid || null}, ${thumbnailGroveData?.url || null}, ${imageSource}, ${sourceImageUrl || null})
  `;
}

/**
 * Check if a derivative already exists for this source image URL
 * Prevents duplicate processing of the same image across artists/tracks
 */
export async function getExistingDerivativeForImageUrl(
  databaseUrl: string,
  sourceImageUrl: string
): Promise<{ cid: string; url: string; thumbnail_cid: string | null; thumbnail_url: string | null } | null> {
  const sql = neon(databaseUrl);

  const result = await sql`
    SELECT grove_cid, grove_url, thumbnail_grove_cid, thumbnail_grove_url
    FROM derivative_images
    WHERE source_image_url = ${sourceImageUrl}
    LIMIT 1
  `;

  if (result.length === 0) return null;

  const row = result[0] as any;
  return {
    cid: row.grove_cid,
    url: row.grove_url,
    thumbnail_cid: row.thumbnail_grove_cid,
    thumbnail_url: row.thumbnail_grove_url,
  };
}

/**
 * Get derivative image statistics
 */
export async function getDerivativeImageStats(
  databaseUrl: string
): Promise<{
  tracks_total?: number;
  tracks_with_derivatives: number;
  artists_total?: number;
  artists_with_derivatives: number;
}> {
  const sql = neon(databaseUrl);

  const result = await sql`
    SELECT
      COUNT(*) FILTER (WHERE asset_type = 'track') as tracks_with_derivatives,
      COUNT(*) FILTER (WHERE asset_type = 'artist') as artists_with_derivatives
    FROM derivative_images
  `;

  const row = result[0] as any;
  return {
    tracks_with_derivatives: parseInt(row.tracks_with_derivatives) || 0,
    artists_with_derivatives: parseInt(row.artists_with_derivatives) || 0,
  };
}
