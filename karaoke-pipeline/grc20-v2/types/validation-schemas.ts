/**
 * Zod Validation Schemas for GRC-20 v2 Minting
 * Songverse v2 - Complete music metadata with Web3 integration
 *
 * Pre-mint validation ensures:
 * - Data quality and completeness
 * - Proper identifiers (ISNI, ISWC, ISRC)
 * - Web3 account links (Lens, PKP)
 * - Saves gas by blocking incomplete entities
 */

import { z } from 'zod';

// ============ Format Validators ============

/**
 * ISRC format: 2 country letters + 3 registrant code + 2 year + 5 designation
 * Example: USRC17607839
 */
export const ISRCSchema = z.string().regex(
  /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/,
  'Invalid ISRC format (e.g., USRC17607839)'
);

/**
 * ISWC format: T-DDD.DDD.DDD-C (where D=digit, C=check digit)
 * Example: T-345246800-1
 */
export const ISWCSchema = z.string().regex(
  /^T-\d{9}-\d$/,
  'Invalid ISWC format (e.g., T-345246800-1)'
);

/**
 * ISNI format: 16 digits in 4 groups (with or without spaces)
 * Example: 0000 0001 2150 090X or 0000000121500  90X
 */
export const ISNISchema = z.string().regex(
  /^\d{4}\s?\d{4}\s?\d{4}\s?\d{3}[0-9X]$/,
  'Invalid ISNI format (e.g., 0000 0001 2150 090X)'
);

/**
 * IPI format: 9-11 digits
 * Example: 00052210040
 */
export const IPISchema = z.string().regex(
  /^\d{9,11}$/,
  'Invalid IPI format (9-11 digits)'
);

/**
 * MusicBrainz ID (UUID format)
 */
export const MBIDSchema = z.string().uuid('Invalid MusicBrainz ID');

/**
 * Social media handle (alphanumeric, underscores, dots, hyphens)
 */
export const SocialHandleSchema = z.string().regex(
  /^[a-zA-Z0-9._-]{1,30}$/,
  'Invalid social handle'
);

/**
 * Ethereum address (0x + 40 hex chars)
 */
export const EthAddressSchema = z.string().regex(
  /^0x[a-fA-F0-9]{40}$/,
  'Invalid Ethereum address'
);

/**
 * Lens handle (lowercase alphanumeric + hyphens, 1-30 chars)
 * Examples: beyonc, 50-cent, grimes-ks
 */
export const LensHandleSchema = z.string().regex(
  /^[a-z0-9-]{1,30}$/,
  'Invalid Lens handle (lowercase, alphanumeric, hyphens only)'
);

/**
 * PKP Token ID (large integer as string)
 */
export const PKPTokenIdSchema = z.string().regex(
  /^\d{1,78}$/,
  'Invalid PKP token ID (should be numeric string)'
);

// ============ Musical Artist Schema (v2 with Web3) ============

export const MusicalArtistMintSchema = z.object({
  // === CORE IDENTITY (REQUIRED) ===
  name: z.string().min(1, 'Artist name required').max(255),

  // Spotify ID is primary identifier (more reliable than Genius for artists)
  spotifyId: z.string().min(1, 'Spotify artist ID required'),

  // === WEB3 ACCOUNTS (REQUIRED) ===
  lensHandle: LensHandleSchema,
  lensAccountAddress: EthAddressSchema,
  pkpAddress: EthAddressSchema,
  pkpTokenId: PKPTokenIdSchema,

  // === INDUSTRY IDENTIFIERS (ISNI REQUIRED) ===
  isni: ISNISchema.optional(), // Strongly recommended but not enforced yet
  ipi: IPISchema.nullish(),

  // === EXTERNAL IDS ===
  mbid: MBIDSchema.optional(), // MusicBrainz ID
  wikidataId: z.string().nullish(),
  discogsId: z.string().nullish(),
  geniusId: z.number().int().positive().nullish(),

  // === URLS ===
  geniusUrl: z.string().url().nullish(),
  spotifyUrl: z.string().url().nullish(),

  // === METADATA ===
  sortName: z.string().nullish(),
  disambiguation: z.string().nullish(),
  alternateNames: z.array(z.string()).nullish(),

  // === BIOGRAPHICAL ===
  artistType: z.enum(['Person', 'Group', 'Orchestra', 'Choir', 'Character', 'Other']).nullish(),
  country: z.string().length(2).nullish(), // ISO country code
  gender: z.enum(['Male', 'Female', 'Non-binary', 'Other']).nullish(),
  birthDate: z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/).nullish(), // YYYY or YYYY-MM or YYYY-MM-DD
  deathDate: z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/).nullish(),

  // === SOCIAL MEDIA ===
  instagramHandle: SocialHandleSchema.nullish(),
  tiktokHandle: SocialHandleSchema.nullish(),
  twitterHandle: SocialHandleSchema.nullish(),
  facebookHandle: SocialHandleSchema.nullish(),
  youtubeChannel: SocialHandleSchema.nullish(),
  soundcloudHandle: SocialHandleSchema.nullish(),

  // === IMAGES (Grove URIs preferred) ===
  imageUrl: z.string().url().nullish(),
  headerImageUrl: z.string().url().nullish(),

  // === POPULARITY ===
  genres: z.array(z.string()).nullish(),
  spotifyFollowers: z.number().int().nonnegative().nullish(),
  spotifyPopularity: z.number().int().min(0).max(100).nullish(),
  geniusFollowers: z.number().int().nonnegative().nullish(),
  isVerified: z.boolean().nullish(),

}).strict();

export type MusicalArtistMint = z.infer<typeof MusicalArtistMintSchema>;

// ============ Musical Work Schema (v2) ============

export const MusicalWorkMintSchema = z.object({
  // === CORE IDENTITY ===
  title: z.string().min(1, 'Work title required').max(500),

  // === IDENTIFIERS ===
  // ISWC is REQUIRED for Songverse v2
  iswc: ISWCSchema,

  // External IDs (at least Spotify recommended)
  spotifyId: z.string().nullish(),
  appleMusicId: z.string().nullish(),
  wikidataId: z.string().nullish(),
  geniusId: z.number().int().positive().nullish(),
  geniusUrl: z.string().url().nullish(),

  // === RELATIONSHIPS ===
  // Artist GRC-20 entity ID (must be minted first)
  composerEntityId: z.string().uuid('Composer must be a minted GRC-20 artist entity'),

  // === METADATA ===
  language: z.string().length(2).nullish(), // ISO 639-1 code
  releaseDate: z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/).nullish(),
  genres: z.array(z.string()).nullish(),
  explicitContent: z.boolean().nullish(),

  // === POPULARITY ===
  annotationCount: z.number().int().nonnegative().nullish(),
  pyongsCount: z.number().int().nonnegative().nullish(),

}).strict();

export type MusicalWorkMint = z.infer<typeof MusicalWorkMintSchema>;

// ============ Audio Recording Schema (v2) ============

export const AudioRecordingMintSchema = z.object({
  // === CORE IDENTITY ===
  title: z.string().min(1, 'Recording title required').max(500),

  // === REQUIRED RELATIONSHIP ===
  // Work GRC-20 entity ID (must be minted first)
  workEntityId: z.string().uuid('Work must be a minted GRC-20 work entity'),

  // === IDENTIFIERS ===
  // At least Spotify ID required
  spotifyId: z.string().min(1, 'Spotify track ID required'),
  isrc: ISRCSchema.optional(),
  mbid: MBIDSchema.optional(),

  // === PLATFORM URLS (from grc20_work_recordings table) ===
  spotifyUrl: z.string().url().nullish(),
  appleMusicUrl: z.string().url().nullish(),
  deezerUrl: z.string().url().nullish(),
  tidalUrl: z.string().url().nullish(),
  qobuzUrl: z.string().url().nullish(),
  soundcloudUrl: z.string().url().nullish(),
  youtubeMusicUrl: z.string().url().nullish(),
  melonUrl: z.string().url().nullish(),
  amazonMusicUrl: z.string().url().nullish(),

  // === METADATA ===
  album: z.string().nullish(),
  releaseDate: z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/).nullish(),
  durationMs: z.number().int().positive().nullish(),

  // === IMAGES (Grove URIs) ===
  imageUrl: z.string().url().nullish(),
  thumbnailUrl: z.string().url().nullish(),

  // === PERFORMER RELATIONSHIP ===
  // Artist GRC-20 entity ID (same as composer for most recordings)
  performerEntityId: z.string().uuid().optional(),

}).strict();

export type AudioRecordingMint = z.infer<typeof AudioRecordingMintSchema>;

// ============ Batch Validation Helper ============

export interface ValidationResult<T> {
  valid: T[];
  invalid: Array<{
    item: any;
    errors: z.ZodError;
  }>;
  stats: {
    total: number;
    validCount: number;
    invalidCount: number;
    validPercent: number;
  };
}

export function validateBatch<T>(
  items: any[],
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  const valid: T[] = [];
  const invalid: Array<{ item: any; errors: z.ZodError }> = [];

  for (const item of items) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ item, errors: result.error });
    }
  }

  return {
    valid,
    invalid,
    stats: {
      total: items.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      validPercent: items.length > 0
        ? Math.round((valid.length / items.length) * 100)
        : 0,
    },
  };
}

// ============ Error Formatting Helper ============

export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
}

// ============ Export All ============

export const MintSchemas = {
  Artist: MusicalArtistMintSchema,
  Work: MusicalWorkMintSchema,
  Recording: AudioRecordingMintSchema,
} as const;
