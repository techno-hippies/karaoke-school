/**
 * Zod Validation Schemas for GRC-20 Minting
 *
 * Pre-mint validation to ensure data quality and completeness.
 * Blocks minting of incomplete entities to save gas and maintain catalog quality.
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
 * ISNI format: 16 digits in 4 groups
 * Example: 0000 0001 2150 090X
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
 * Social media handle (alphanumeric, underscores, dots)
 */
export const SocialHandleSchema = z.string().regex(
  /^[a-zA-Z0-9._]{1,30}$/,
  'Invalid social handle'
);

// ============ Musical Artist Schema ============

export const MusicalArtistMintSchema = z.object({
  // Core identity (REQUIRED)
  name: z.string().min(1, 'Artist name required').max(255),

  // Genius ID is REQUIRED (primary source of truth)
  geniusId: z.number().int().positive('Genius artist ID required'),

  // External IDs (MBID required for linking)
  mbid: MBIDSchema, // REQUIRED - needed for MusicBrainz ecosystem
  spotifyId: z.string().nullish(),
  wikidataId: z.string().nullish(),
  discogsId: z.string().nullish(),

  // Industry identifiers (ISNI strongly recommended, IPI optional)
  isni: ISNISchema, // REQUIRED - authoritative artist identifier
  ipi: IPISchema.nullish(), // Optional but valuable for rights management

  // Alternate names & metadata
  alternateNames: z.array(z.string()).nullish(),
  sortName: z.string().nullish(),
  disambiguation: z.string().nullish(),

  // Social media handles (at least ONE recommended)
  instagramHandle: SocialHandleSchema.nullish(),
  tiktokHandle: SocialHandleSchema.nullish(),
  twitterHandle: SocialHandleSchema.nullish(),
  facebookHandle: SocialHandleSchema.nullish(),
  youtubeChannel: SocialHandleSchema.nullish(),
  soundcloudHandle: SocialHandleSchema.nullish(),

  // External profile URLs
  geniusUrl: z.string().url().nullish(),
  spotifyUrl: z.string().url().nullish(),
  appleMusicUrl: z.string().url().nullish(),

  // Visual assets (REQUIRED for now - but allow missing temporarily)
  imageUrl: z.string().url().nullish(), // TODO: Make required after generating all images
  headerImageUrl: z.string().url().nullish(),

  // Biographical info
  type: z.enum(['Person', 'Group', 'Orchestra', 'Choir', 'Character', 'Other']).nullish(),
  country: z.string().length(2).nullish(), // ISO country code
  gender: z.enum(['Male', 'Female', 'Non-binary', 'Other']).nullish(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(), // YYYY-MM-DD
  deathDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),

  // Popularity metrics
  genres: z.array(z.string()).nullish(),
  spotifyFollowers: z.number().int().nonnegative().nullish(),
  spotifyPopularity: z.number().int().min(0).max(100).nullish(),
  geniusFollowers: z.number().int().nonnegative().nullish(),
  isVerified: z.boolean().nullish(),

  // App-specific (optional - social layer)
  lensAccount: z.string().regex(/^0x[a-fA-F0-9]{40}$/).nullish(), // Ethereum address

}).strict().refine(
  (data) => {
    // Require at least ONE music-oriented social platform
    const musicPlatforms = [
      data.tiktokHandle,
      data.youtubeChannel,
      data.soundcloudHandle,
      data.spotifyUrl,
      data.geniusUrl
    ].filter(Boolean);
    return musicPlatforms.length >= 1;
  },
  {
    message: 'Artist must have at least one music-oriented platform (TikTok/YouTube/SoundCloud/Spotify/Genius)',
    path: ['tiktokHandle']
  }
);

export type MusicalArtistMint = z.infer<typeof MusicalArtistMintSchema>;

// ============ Musical Work Schema ============

export const MusicalWorkMintSchema = z.object({
  // Core identity
  title: z.string().min(1, 'Work title required').max(500),

  // Genius ID is REQUIRED (primary source of truth)
  geniusId: z.number().int().positive('Genius song ID required'),

  // Genius URL (derived from ID but useful for direct access)
  geniusUrl: z.string().url(),

  // Industry identifiers (ISWC REQUIRED for Songverse_v1)
  iswc: ISWCSchema, // REQUIRED - authoritative work identifier

  // External IDs (optional but recommended)
  spotifyId: z.string().nullish(), // Representative recording
  appleMusicId: z.string().nullish(),
  wikidataId: z.string().nullish(),

  // Relationships (at least one composer recommended but not enforced yet)
  composerMbids: z.array(MBIDSchema).default([]), // TODO: Enforce min(1) after linking composers

  // Metadata
  language: z.string().length(2).nullish(), // ISO 639-1 code
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),

  // Popularity/engagement
  geniusAnnotationCount: z.number().int().nonnegative().nullish(),
  geniusPyongsCount: z.number().int().nonnegative().nullish(),

}).strict();

export type MusicalWorkMint = z.infer<typeof MusicalWorkMintSchema>;

// ============ Audio Recording Schema ============

export const AudioRecordingMintSchema = z.object({
  // Core identity
  title: z.string().min(1, 'Recording title required').max(500),

  // Required relationship
  workId: z.string().uuid('Must link to a Musical Work entity'),

  // Industry identifiers (ISRC strongly preferred)
  isrc: ISRCSchema.optional(),
  recordingMbid: MBIDSchema.optional(),

  // External IDs (at least ONE required if no ISRC)
  spotifyId: z.string().optional(),
  appleMusicId: z.string().optional(),

  // Technical metadata
  durationMs: z.number().int().positive('Duration must be positive'),

  // Release info
  album: z.string().optional(),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Performer relationships
  performerMbids: z.array(MBIDSchema).optional(),

  // Popularity
  spotifyPopularity: z.number().int().min(0).max(100).optional(),

  // Streaming URLs
  spotifyUrl: z.string().url().optional(),
  appleMusicUrl: z.string().url().optional(),

}).strict().refine(
  (data) => Boolean(data.isrc || data.recordingMbid || data.spotifyId),
  {
    message: 'Recording must have ISRC, MusicBrainz ID, or Spotify ID',
    path: ['isrc']
  }
);

export type AudioRecordingMint = z.infer<typeof AudioRecordingMintSchema>;

// ============ Karaoke Segment Schema ============
// (Only if you decide to put these in GRC-20 vs keeping in contracts)

export const KaraokeSegmentMintSchema = z.object({
  // Core identity
  title: z.string().min(1),

  // Required relationship
  recordingId: z.string().uuid('Must link to an Audio Recording entity'),

  // Timing (required)
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  durationMs: z.number().int().positive(),

  // Grove asset URIs (required for karaoke functionality)
  instrumentalUri: z.string().url('Instrumental audio required'),
  alignmentUri: z.string().url('Word alignment required'),

  // Optional metadata
  groveMetadataUri: z.string().url().optional(),

}).strict().refine(
  (data) => data.endMs > data.startMs,
  {
    message: 'End time must be after start time',
    path: ['endMs']
  }
).refine(
  (data) => data.durationMs === data.endMs - data.startMs,
  {
    message: 'Duration must equal endMs - startMs',
    path: ['durationMs']
  }
);

export type KaraokeSegmentMint = z.infer<typeof KaraokeSegmentMintSchema>;

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
      validPercent: Math.round((valid.length / items.length) * 100),
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
  Segment: KaraokeSegmentMintSchema,
} as const;
