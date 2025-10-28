/**
 * GRC20 Mint Schema
 *
 * Defines immutable vs mutable fields for GRC20 knowledge graph.
 * Based on your 19-step pipeline output.
 */

import { z } from 'zod';

// ==================== IMMUTABLE (On-Chain) ====================

/**
 * Core identity that CANNOT be changed after minting
 */
export const ImmutableTrackSchema = z.object({
  // Required identifiers (GATE: must have all of these)
  iswc: z.string().regex(/^T-\d{3}\.\d{3}\.\d{3}-\d{1}$/, 'Invalid ISWC format'),
  isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/, 'Invalid ISRC format'),

  // Core metadata
  title: z.string().min(1).max(500),

  // Artists (at least one required)
  artists: z.array(z.object({
    name: z.string().min(1),
    spotify_id: z.string().optional(),
    isni: z.string().optional(), // Only 49.8% have this, so optional
  })).min(1, 'At least one artist required'),

  // Timestamps
  created_at: z.string().datetime(),
});

// ==================== MUTABLE (Off-Chain / Updateable) ====================

/**
 * Metadata that CAN be updated after minting
 */
export const MutableTrackSchema = z.object({
  // Media files (can be re-processed with better algorithms)
  duration_ms: z.number().int().positive(),

  // Grove CIDs (can be replaced with higher quality versions)
  audio_cid: z.string().min(1),
  vocals_cid: z.string().min(1),
  instrumental_cid: z.string().min(1),
  enhanced_instrumental_cid: z.string().optional(), // Fal.ai output
  lyrics_cid: z.string().min(1),
  word_timing_cid: z.string().min(1),
  artist_image_cid: z.string().optional(),

  // Display metadata
  image_url: z.string().url().optional(),
  album_name: z.string().optional(),
  release_date: z.string().optional(),

  // Quality metrics
  lyrics_confidence: z.number().min(0).max(1).optional(),
  audio_verified: z.boolean().default(false), // AcoustID match

  // Updated timestamp
  updated_at: z.string().datetime(),
});

// ==================== COMBINED SCHEMA ====================

export const GRC20MintableTrackSchema = ImmutableTrackSchema.merge(MutableTrackSchema);

export type ImmutableTrack = z.infer<typeof ImmutableTrackSchema>;
export type MutableTrack = z.infer<typeof MutableTrackSchema>;
export type GRC20MintableTrack = z.infer<typeof GRC20MintableTrackSchema>;

// ==================== VALIDATION HELPERS ====================

/**
 * Validate a track is ready to mint
 */
export function validateMintableTrack(data: unknown): {
  success: boolean;
  track?: GRC20MintableTrack;
  errors?: z.ZodError;
} {
  const result = GRC20MintableTrackSchema.safeParse(data);

  if (result.success) {
    return { success: true, track: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * Check which fields are missing for a track to be mintable
 */
export function getMissingFields(data: Partial<GRC20MintableTrack>): string[] {
  const result = GRC20MintableTrackSchema.safeParse(data);

  if (result.success) {
    return [];
  }

  const missing: string[] = [];
  const errors = result.error.flatten().fieldErrors;

  for (const [field, messages] of Object.entries(errors)) {
    if (messages && messages.length > 0) {
      missing.push(field);
    }
  }

  return missing;
}

/**
 * Build mintable track from database row
 */
export function buildMintableTrack(row: {
  // Pipeline data
  iswc: string;
  isrc: string;

  // Spotify data
  title: string;
  artists: string[];
  duration_ms: number;
  album_name?: string;
  release_date?: string;
  image_url?: string;

  // Media data
  audio_grove_cid?: string;
  vocals_grove_cid?: string;
  instrumental_grove_cid?: string;
  enhanced_instrumental_grove_cid?: string;
  artist_image_grove_cid?: string;

  // Lyrics data
  lyrics_grove_cid?: string;
  lyrics_confidence?: number;

  // Word timing
  word_timing_grove_cid?: string;

  // Verification
  audio_verified?: boolean;

  // Metadata
  created_at: Date;
  updated_at: Date;
}): Partial<GRC20MintableTrack> {
  return {
    // Immutable
    iswc: row.iswc,
    isrc: row.isrc,
    title: row.title,
    artists: row.artists.map(name => ({ name })),
    created_at: row.created_at.toISOString(),

    // Mutable
    duration_ms: row.duration_ms,
    audio_cid: row.audio_grove_cid || '',
    vocals_cid: row.vocals_grove_cid || '',
    instrumental_cid: row.instrumental_grove_cid || '',
    enhanced_instrumental_cid: row.enhanced_instrumental_grove_cid,
    lyrics_cid: row.lyrics_grove_cid || '',
    word_timing_cid: row.word_timing_grove_cid || '',
    artist_image_cid: row.artist_image_grove_cid,
    image_url: row.image_url,
    album_name: row.album_name,
    release_date: row.release_date,
    lyrics_confidence: row.lyrics_confidence,
    audio_verified: row.audio_verified || false,
    updated_at: row.updated_at.toISOString(),
  };
}

// ==================== SQL QUERY FOR MINTABLE TRACKS ====================

/**
 * SQL query to fetch all tracks ready to mint
 */
export const GET_MINTABLE_TRACKS_QUERY = `
SELECT
  -- Pipeline data
  tp.iswc,
  tp.isrc,
  tp.spotify_track_id,

  -- Spotify track data
  st.title,
  st.artists,
  st.duration_ms,
  st.album_name,
  st.raw_data->>'release_date' as release_date,
  st.raw_data->>'image_url' as image_url,

  -- Media assets
  tm.audio_grove_cid,
  tm.vocals_grove_cid,
  tm.instrumental_grove_cid,
  tm.enhanced_instrumental_grove_cid,
  tm.artist_image_grove_cid,

  -- Lyrics
  tl.grove_cid as lyrics_grove_cid,
  tl.confidence_score as lyrics_confidence,

  -- Word timing
  tm.word_timing_grove_cid,

  -- Verification
  tm.audio_verified,

  -- Timestamps
  tp.created_at,
  tp.updated_at

FROM track_pipeline tp
JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
LEFT JOIN track_media tm ON tp.spotify_track_id = tm.spotify_track_id
LEFT JOIN track_lyrics tl ON tp.spotify_track_id = tl.spotify_track_id

WHERE tp.status = 'ready_to_mint'
  AND tp.has_iswc = TRUE
  AND tp.has_lyrics = TRUE
  AND tp.has_audio = TRUE
  AND tm.audio_grove_cid IS NOT NULL
  AND tl.grove_cid IS NOT NULL

ORDER BY tp.created_at ASC;
`;

// ==================== EXAMPLE USAGE ====================

/*
// In your minting script:

import { validateMintableTrack, GET_MINTABLE_TRACKS_QUERY } from './schemas/grc20-mint';

const tracks = await db.query(GET_MINTABLE_TRACKS_QUERY);

for (const row of tracks) {
  const track = buildMintableTrack(row);
  const validation = validateMintableTrack(track);

  if (validation.success) {
    // Mint to GRC20
    await mintToGRC20(validation.track);
  } else {
    console.error(`Track ${row.spotify_track_id} failed validation:`, validation.errors);
  }
}
*/
