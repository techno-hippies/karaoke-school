/**
 * GRC-20 Artist Mint Schema
 *
 * Validates artist data is ready for GRC-20 minting
 * Based on grc20_artists table schema (migration 013)
 */

import { z } from 'zod';

/**
 * Core artist data required for GRC-20 minting
 */
export const GRC20ArtistMintSchema = z.object({
  // Identity (REQUIRED)
  id: z.number().int().positive(),
  name: z.string().min(1).max(500),
  spotify_artist_id: z.string().min(1),

  // PKP & Lens (REQUIRED for Web3 integration)
  pkp_address: z.string().min(1, 'PKP address required'),
  lens_handle: z.string().min(1, 'Lens handle required'),
  lens_account_address: z.string().min(1, 'Lens account address required'),

  // Industry Identifiers (ISNI optional per docs: "only 49.8% have this")
  isni: z.string().nullable().optional(),
  isni_all: z.string().nullable().optional(),
  ipi_all: z.string().nullable().optional(),
  mbid: z.string().uuid().nullable().optional(),

  // Images (REQUIRED - Grove URL)
  image_url: z.string().url().startsWith('https://api.grove.storage/', 'Must be Grove URL'),
  image_source: z.literal('fal'), // All images are fal derivatives

  // Social Media Handles (optional but encouraged)
  instagram_handle: z.string().nullable().optional(),
  twitter_handle: z.string().nullable().optional(),
  tiktok_handle: z.string().nullable().optional(),

  // Reference URLs (optional)
  spotify_url: z.string().url().nullable().optional(),
  wikidata_url: z.string().url().nullable().optional(),

  // NOTE: Minting state is tracked in grc20_artist_mints table (separate source table)
  // No minting state columns in grc20_artists (aggregation table)
});

/**
 * Minimal schema for checking if artist is ready to mint
 */
export const GRC20ArtistReadinessSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  spotify_artist_id: z.string().min(1),
  pkp_address: z.string().min(1),
  lens_handle: z.string().min(1),
  image_url: z.string().url().startsWith('https://api.grove.storage/'),
  // grc20_entity_id checked via grc20_artist_mints table (not in grc20_artists)
});

export type GRC20ArtistMint = z.infer<typeof GRC20ArtistMintSchema>;
export type GRC20ArtistReadiness = z.infer<typeof GRC20ArtistReadinessSchema>;

/**
 * Validate artist is ready to mint
 */
export function validateArtistMintReadiness(data: unknown): {
  success: boolean;
  artist?: GRC20ArtistMint;
  errors?: z.ZodError;
  missingFields?: string[];
} {
  const result = GRC20ArtistMintSchema.safeParse(data);

  if (result.success) {
    return { success: true, artist: result.data };
  }

  const missingFields: string[] = [];
  const errors = result.error.flatten().fieldErrors;

  for (const [field, messages] of Object.entries(errors)) {
    if (messages && messages.length > 0) {
      missingFields.push(field);
    }
  }

  return {
    success: false,
    errors: result.error,
    missingFields
  };
}

/**
 * SQL query to fetch artists ready to mint
 */
export const GET_ARTISTS_READY_TO_MINT_QUERY = `
  SELECT
    ga.id,
    ga.name,
    ga.sort_name,
    ga.isni,
    ga.isni_all,
    ga.ipi_all,
    ga.mbid,
    ga.spotify_artist_id,
    ga.genius_artist_id,
    ga.artist_type,
    ga.gender,
    ga.birth_date,
    ga.country,
    ga.genres,
    ga.is_verified,
    ga.instagram_handle,
    ga.twitter_handle,
    ga.facebook_handle,
    ga.tiktok_handle,
    ga.youtube_channel,
    ga.soundcloud_handle,
    ga.image_url,
    ga.header_image_url,
    ga.image_source,
    ga.spotify_url,
    ga.wikidata_url,
    ga.viaf_url,
    ga.allmusic_url,
    ga.genius_url,
    ga.pkp_address,
    ga.pkp_token_id,
    ga.lens_handle,
    ga.lens_account_address,
    ga.lens_metadata_uri,
    ga.created_at,
    ga.updated_at
  FROM grc20_artists ga
  LEFT JOIN grc20_artist_mints gam ON ga.spotify_artist_id = gam.spotify_artist_id
  WHERE gam.grc20_entity_id IS NULL  -- Not yet minted
    AND ga.image_url IS NOT NULL     -- Has Grove image (REQUIRED)
    AND ga.pkp_address IS NOT NULL   -- Has PKP (REQUIRED)
    AND ga.lens_handle IS NOT NULL   -- Has Lens account (REQUIRED)
    AND ga.spotify_artist_id IS NOT NULL
  ORDER BY ga.name ASC
`;

/**
 * SQL query to count artists by mint status
 */
export const GET_ARTIST_MINT_STATS_QUERY = `
  SELECT
    COUNT(*) as total,
    COUNT(gam.grc20_entity_id) as minted,
    COUNT(*) FILTER (
      WHERE gam.grc20_entity_id IS NULL
        AND ga.image_url IS NOT NULL
        AND ga.pkp_address IS NOT NULL
        AND ga.lens_handle IS NOT NULL
    ) as ready_to_mint,
    COUNT(*) FILTER (WHERE gam.grc20_entity_id IS NULL AND ga.image_url IS NULL) as blocked_missing_image,
    COUNT(*) FILTER (WHERE gam.grc20_entity_id IS NULL AND ga.pkp_address IS NULL) as blocked_missing_pkp,
    COUNT(*) FILTER (WHERE gam.grc20_entity_id IS NULL AND ga.lens_handle IS NULL) as blocked_missing_lens,
    COUNT(*) FILTER (WHERE gam.needs_update = TRUE) as needs_remint
  FROM grc20_artists ga
  LEFT JOIN grc20_artist_mints gam ON ga.spotify_artist_id = gam.spotify_artist_id
`;
