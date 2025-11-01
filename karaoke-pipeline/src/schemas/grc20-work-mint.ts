/**
 * GRC-20 Work Mint Schema
 *
 * Validates musical work data is ready for GRC-20 minting
 * Based on grc20_works + grc20_work_recordings tables (migrations 014 + recordings)
 */

import { z } from 'zod';

/**
 * ISWC format validator - unformatted: T + 10 digits
 * Example: T0719621610
 */
const ISWCSchema = z.string().regex(/^T\d{10}$/, 'ISWC must be T followed by 10 digits (unformatted)');

/**
 * Core work data required for GRC-20 minting
 */
export const GRC20WorkMintSchema = z.object({
  // Identity (REQUIRED)
  id: z.number().int().positive(),
  title: z.string().min(1).max(500),

  // Industry Identifiers (ISWC REQUIRED for GRC-20)
  iswc: ISWCSchema,
  iswc_source: z.enum(['quansic', 'musicbrainz', 'mlc']).nullable().optional(),
  mbid: z.string().uuid().nullable().optional(), // MusicBrainz Work ID

  // Artist Relationship (REQUIRED)
  primary_artist_id: z.number().int().positive(),
  primary_artist_name: z.string().min(1),

  // Additional Credits (optional)
  composers: z.string().nullable().optional(),
  lyricists: z.string().nullable().optional(),
  featured_artists: z.string().nullable().optional(),

  // Work Metadata
  language: z.string().length(2).nullable().optional(), // ISO 639-1
  work_type: z.string().nullable().optional(),
  genres: z.string().nullable().optional(),

  // Reference URLs
  musicbrainz_url: z.string().url().nullable().optional(),
  wikidata_url: z.string().url().nullable().optional(),

  // Minting State (must be unminted)
  grc20_entity_id: z.null(),
  minted_at: z.null(),
  needs_update: z.boolean().default(false),

  // Recording data (from grc20_work_recordings - at least one required)
  recordings: z.array(z.object({
    id: z.number().int().positive(),
    spotify_track_id: z.string().min(1),
    spotify_url: z.string().url(),
    spotify_release_date: z.string().nullable().optional(),
    spotify_duration_ms: z.number().int().positive().nullable().optional(),

    // Grove images (REQUIRED)
    grove_image_url: z.string().url().startsWith('https://api.grove.storage/', 'Must be Grove URL'),
    grove_thumbnail_url: z.string().url().startsWith('https://api.grove.storage/', 'Must be Grove URL').nullable().optional(),
  })).min(1, 'At least one recording required'),
});

/**
 * Minimal schema for checking if work is ready to mint
 */
export const GRC20WorkReadinessSchema = z.object({
  id: z.number(),
  title: z.string().min(1),
  iswc: ISWCSchema,
  primary_artist_id: z.number().int().positive(),
  grc20_entity_id: z.null(),
  has_recording_with_image: z.literal(true),
});

export type GRC20WorkMint = z.infer<typeof GRC20WorkMintSchema>;
export type GRC20WorkReadiness = z.infer<typeof GRC20WorkReadinessSchema>;

/**
 * Validate work is ready to mint
 */
export function validateWorkMintReadiness(data: unknown): {
  success: boolean;
  work?: GRC20WorkMint;
  errors?: z.ZodError;
  missingFields?: string[];
  blockers?: string[];
} {
  const result = GRC20WorkMintSchema.safeParse(data);

  if (result.success) {
    return { success: true, work: result.data };
  }

  const missingFields: string[] = [];
  const blockers: string[] = [];
  const errors = result.error.flatten().fieldErrors;

  for (const [field, messages] of Object.entries(errors)) {
    if (messages && messages.length > 0) {
      missingFields.push(field);

      // Identify critical blockers
      if (field === 'iswc') {
        blockers.push('ISWC required for GRC-20 (run ISWC discovery)');
      } else if (field === 'primary_artist_id') {
        blockers.push('Primary artist reference missing');
      } else if (field === 'recordings') {
        blockers.push('No recording with Grove image (run step 12)');
      }
    }
  }

  return {
    success: false,
    errors: result.error,
    missingFields,
    blockers: blockers.length > 0 ? blockers : undefined
  };
}

/**
 * SQL query to fetch works ready to mint (with recordings joined)
 */
export const GET_WORKS_READY_TO_MINT_QUERY = `
  SELECT
    gw.id,
    gw.title,
    gw.alternate_titles,
    gw.iswc,
    gw.iswc_source,
    gw.mbid,
    gw.primary_artist_id,
    gw.primary_artist_name,
    gw.featured_artists,
    gw.composers,
    gw.producers,
    gw.lyricists,
    gw.language,
    gw.work_type,
    gw.genres,
    gw.musicbrainz_url,
    gw.grc20_entity_id,
    gw.minted_at,
    gw.needs_update,
    gw.created_at,
    gw.updated_at,
    -- Aggregate recordings as JSONB array
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', gwr.id,
          'spotify_track_id', gwr.spotify_track_id,
          'spotify_url', gwr.spotify_url,
          'spotify_release_date', gwr.spotify_release_date,
          'spotify_duration_ms', gwr.spotify_duration_ms,
          'grove_image_url', gwr.grove_image_url,
          'grove_thumbnail_url', gwr.grove_thumbnail_url,
          'apple_music_url', gwr.apple_music_url
        )
      ) FILTER (WHERE gwr.id IS NOT NULL),
      '[]'::jsonb
    ) as recordings
  FROM grc20_works gw
  LEFT JOIN grc20_work_recordings gwr ON gwr.work_id = gw.id
  WHERE gw.grc20_entity_id IS NULL  -- Not yet minted
    AND gw.iswc IS NOT NULL          -- Has ISWC (REQUIRED!)
    AND gw.primary_artist_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM grc20_work_recordings r
      WHERE r.work_id = gw.id
        AND r.grove_image_url IS NOT NULL
    )
  GROUP BY gw.id
  ORDER BY gw.title ASC
`;

/**
 * SQL query to count works by mint status
 */
export const GET_WORK_MINT_STATS_QUERY = `
  SELECT
    COUNT(*) as total,
    COUNT(gw.grc20_entity_id) as minted,
    COUNT(*) FILTER (
      WHERE gw.grc20_entity_id IS NULL
        AND gw.iswc IS NOT NULL
        AND gw.primary_artist_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM grc20_work_recordings r
          WHERE r.work_id = gw.id AND r.grove_image_url IS NOT NULL
        )
    ) as ready_to_mint,
    COUNT(*) FILTER (WHERE gw.grc20_entity_id IS NULL AND gw.iswc IS NULL) as blocked_missing_iswc,
    COUNT(*) FILTER (
      WHERE gw.grc20_entity_id IS NULL
        AND gw.iswc IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM grc20_work_recordings r
          WHERE r.work_id = gw.id AND r.grove_image_url IS NOT NULL
        )
    ) as blocked_missing_image,
    COUNT(*) FILTER (WHERE gw.needs_update = TRUE) as needs_remint
  FROM grc20_works gw
`;

/**
 * SQL query to find works blocked from minting (with reasons)
 */
export const GET_BLOCKED_WORKS_QUERY = `
  SELECT
    gw.id,
    gw.title,
    gw.primary_artist_name,
    CASE
      WHEN gw.iswc IS NULL THEN 'Missing ISWC'
      WHEN gw.primary_artist_id IS NULL THEN 'Missing primary artist'
      WHEN NOT EXISTS (
        SELECT 1 FROM grc20_work_recordings r
        WHERE r.work_id = gw.id AND r.grove_image_url IS NOT NULL
      ) THEN 'Missing Grove image (run step 12)'
      ELSE 'Unknown blocker'
    END as blocker_reason,
    gw.iswc,
    (SELECT COUNT(*) FROM grc20_work_recordings WHERE work_id = gw.id) as recording_count,
    (SELECT COUNT(*) FROM grc20_work_recordings WHERE work_id = gw.id AND grove_image_url IS NOT NULL) as recordings_with_image
  FROM grc20_works gw
  WHERE gw.grc20_entity_id IS NULL
    AND (
      gw.iswc IS NULL
      OR gw.primary_artist_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM grc20_work_recordings r
        WHERE r.work_id = gw.id AND r.grove_image_url IS NOT NULL
      )
    )
  ORDER BY
    CASE
      WHEN gw.iswc IS NULL THEN 1
      WHEN NOT EXISTS (
        SELECT 1 FROM grc20_work_recordings r
        WHERE r.work_id = gw.id AND r.grove_image_url IS NOT NULL
      ) THEN 2
      ELSE 3
    END,
    gw.title
`;
