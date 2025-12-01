/**
 * Zod Schemas for Pipeline Data Validation
 *
 * Ensures metadata is valid BEFORE uploading to Grove / emitting on-chain.
 */

import { z } from 'zod';

// ============================================================================
// AD LIB VALIDATION
// ============================================================================

/**
 * Check if text contains ad libs (background vocals in parentheses)
 * Rejects: "(Ooh)", "text (Ooh, poor boy)", etc.
 */
function hasAdLib(text: string): boolean {
  return /\([^)]*\)/.test(text);
}

/**
 * Zod refinement to reject text with ad libs
 */
const noAdLibsSchema = z.string().refine(
  (text) => !hasAdLib(text),
  { message: 'Text contains ad libs (parenthetical content). Strip ad libs before emission.' }
);

// Grove URL pattern - must be permanent storage, not CDN
const groveUrlSchema = z.string().url().refine(
  (url) => url.startsWith('https://api.grove.storage/'),
  { message: 'Must be a Grove URL (https://api.grove.storage/...)' }
);

// Optional Grove URL (null allowed)
const optionalGroveUrlSchema = groveUrlSchema.nullable();

// Ethereum address
const addressSchema = z.string().regex(
  /^0x[a-fA-F0-9]{40}$/,
  { message: 'Must be a valid Ethereum address' }
);

// Clip hash (bytes32)
const bytes32Schema = z.string().regex(
  /^0x[a-fA-F0-9]{64}$/,
  { message: 'Must be a valid bytes32 hash' }
);

// Spotify track ID
const spotifyTrackIdSchema = z.string().regex(
  /^[a-zA-Z0-9]{22}$/,
  { message: 'Must be a valid Spotify track ID (22 chars)' }
);

// ISWC format
const iswcSchema = z.string().regex(
  /^T\d{10}$/,
  { message: 'Must be a valid ISWC (T followed by 10 digits)' }
);

/**
 * Lyrics Preview Item Schema (for list display)
 */
const lyricsPreviewItemSchema = z.object({
  index: z.number().int().min(0),
  text: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
});

/**
 * Word timing schema (for word-by-word highlighting)
 */
const wordTimingSchema = z.object({
  text: z.string(),
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
});

/**
 * Karaoke Line Schema (for playback)
 * Contains all lyrics lines with timing for the karaoke player
 *
 * IMPORTANT: zh_text (Mandarin) is REQUIRED for clip lines - it's the default display language.
 * Users see Mandarin translation while learning to sing English lyrics.
 */
const karaokeLineSchema = z.object({
  line_index: z.number().int().min(0),
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
  original_text: z.string(),  // English lyrics
  text: z.string().optional(), // Same as original_text (for compatibility)
  words: z.array(wordTimingSchema).optional(), // Word-level timing for highlighting
  zh_text: z.string().min(1),  // Chinese translation (REQUIRED - default display language)
  vi_text: z.string().optional(), // Vietnamese translation
  id_text: z.string().optional(), // Indonesian translation
});

/**
 * Full Karaoke Line Schema (for full song - subscribers only)
 * zh_text is optional for full lyrics since translations may be incomplete
 */
const fullKaraokeLineSchema = z.object({
  line_index: z.number().int().min(0),
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
  original_text: z.string(),
  text: z.string().optional(),
  words: z.array(wordTimingSchema).optional(),
  zh_text: z.string().optional(), // Optional for full song
  vi_text: z.string().optional(),
  id_text: z.string().optional(),
});

/**
 * Timing Schema
 * Validates that clip timing is sensible
 */
const timingSchema = z.object({
  clipStartMs: z.number().int().min(0),
  clipEndMs: z.number().int().min(1),
  fullDurationMs: z.number().int().min(1).nullable(),
}).refine(
  (timing) => timing.clipEndMs > timing.clipStartMs,
  { message: 'clipEndMs must be greater than clipStartMs' }
).refine(
  (timing) => timing.fullDurationMs === null || timing.clipEndMs <= timing.fullDurationMs,
  { message: 'clipEndMs cannot exceed fullDurationMs' }
);

/**
 * Assets Schema - Free tier audio/lyrics
 *
 * IMPORTANT: Full audio is ONLY accessible via encryption.encryptionMetadataUri
 * Do NOT include fullInstrumental here - that would leak the unencrypted URL!
 */
const assetsSchema = z.object({
  clipInstrumental: groveUrlSchema,
  clipLyrics: optionalGroveUrlSchema,
  alignment: optionalGroveUrlSchema,
});

/**
 * Encryption Schema v2 - Hybrid AES-GCM + Lit Protocol
 *
 * Uses hybrid encryption to avoid 413 errors:
 * - Audio encrypted locally with AES-256-GCM
 * - Only the 32-byte symmetric key is encrypted with Lit Protocol
 * - Frontend fetches encryptionMetadataUri to get all decryption params
 */
const encryptionSchema = z.object({
  version: z.enum(['1.0.0', '2.0.0']).default('2.0.0'),
  environment: z.enum(['testnet', 'mainnet']),
  // v2: Points to encryption metadata JSON (contains encrypted key + audio URL)
  encryptionMetadataUri: groveUrlSchema,
  // v1 (deprecated): Points to encrypted audio blob
  encryptedFullUri: optionalGroveUrlSchema,
  manifestUri: optionalGroveUrlSchema,
  litNetwork: z.string().min(1),
  unlockLockAddress: addressSchema,
  unlockChainId: z.number().int().positive(),
}).nullable();

/**
 * Stats Schema
 * Ensures we have meaningful content
 */
const statsSchema = z.object({
  totalLyricsLines: z.number().int().min(1, 'Must have at least 1 total lyrics line'),
  clipLyricsLines: z.number().int().min(1, 'Must have at least 1 clip lyrics line'),
  fullLyricsLines: z.number().int().min(1).optional(),
});

/**
 * Complete Clip Metadata Schema (v2.0.0)
 *
 * This is the metadata uploaded to Grove and referenced by ClipRegistered events.
 */
export const ClipMetadataSchema = z.object({
  // Version & Type
  version: z.literal('2.0.0'),
  type: z.literal('karaoke-clip'),
  generatedAt: z.string().datetime(),

  // Identifiers
  clipHash: bytes32Schema,
  iswc: iswcSchema,
  spotifyTrackId: spotifyTrackIdSchema,

  // Song Info
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  artistSlug: z.string().min(1).max(100),
  artistImageUri: groveUrlSchema, // Artist image (REQUIRED - from Spotify artist endpoint, stored on Grove)

  // Cover Images - MUST be on Grove, not Spotify CDN
  coverUri: groveUrlSchema,           // Full size (640x640) - REQUIRED
  thumbnailUri: groveUrlSchema,       // Small (100x100) for lists - REQUIRED

  // Timing
  timing: timingSchema,

  // Assets
  assets: assetsSchema,

  // Encryption (optional - only for premium content)
  encryption: encryptionSchema,

  // Lyrics Preview (first few lines for list display) - REQUIRED, at least 1
  lyricsPreview: z.array(lyricsPreviewItemSchema).min(1, 'Must have at least 1 preview line').max(10),

  // Full karaoke lyrics (all lines with timing for playback) - REQUIRED, at least 1
  karaoke_lines: z.array(karaokeLineSchema).min(1, 'Must have at least 1 karaoke line'),

  // Full song lyrics for subscribers (optional - may not exist for all clips)
  full_karaoke_lines: z.array(fullKaraokeLineSchema).min(1).optional(),

  // Stats
  stats: statsSchema,
});

export type ClipMetadata = z.infer<typeof ClipMetadataSchema>;

// ============================================================================
// EXERCISE SCHEMAS
// ============================================================================

/**
 * Exercise Question Schema
 * Validates that prompts don't contain ad libs (background vocals)
 */
export const ExerciseQuestionSchema = z.object({
  prompt: noAdLibsSchema,
  correct_answer: z.string().min(1),
  distractors: z.array(z.string()).min(2),
  explanation: z.string().optional(),
});

export type ExerciseQuestion = z.infer<typeof ExerciseQuestionSchema>;

/**
 * Validate exercise question before emission
 */
export function validateExerciseQuestion(data: unknown): ExerciseQuestion {
  return ExerciseQuestionSchema.parse(data);
}

/**
 * Validate clip metadata before upload
 * Throws ZodError with detailed messages if invalid
 */
export function validateClipMetadata(data: unknown): ClipMetadata {
  return ClipMetadataSchema.parse(data);
}

/**
 * Safe validation - returns result object instead of throwing
 */
export function safeValidateClipMetadata(data: unknown): z.SafeParseReturnType<unknown, ClipMetadata> {
  return ClipMetadataSchema.safeParse(data);
}

/**
 * Format Zod errors for CLI output
 */
export function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
}

// ============================================================================
// POST METADATA SCHEMAS
// ============================================================================

/**
 * Psychographic tag schema
 * Tags should be lowercase, single words or hyphenated phrases
 */
const psychographicTagSchema = z.string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9-]+$/, { message: 'Tags must be lowercase alphanumeric with hyphens only' });

/**
 * Post Metadata Schema
 *
 * Validates Lens post metadata before uploading to Grove.
 * Ensures visual_tags and lyric_tags are present for psychographic profiling.
 */
export const PostMetadataSchema = z.object({
  // Required content
  content: z.string().min(1),
  title: z.string().min(1).max(200),

  // Video (required for clip posts)
  videoUrl: groveUrlSchema,
  coverImageUrl: groveUrlSchema, // Video thumbnail (frame from video) - NOT album art!

  // Song identifiers
  artistSlug: z.string().min(1).max(100).optional(),
  songSlug: z.string().min(1).max(100).nullable().optional(),
  songName: z.string().min(1).max(200),
  artistName: z.string().min(1).max(200),

  // Psychographic tags (REQUIRED for AI chat context)
  visualTags: z.array(psychographicTagSchema)
    .min(1, 'Must have at least 1 visual tag (e.g., "anime", "streetwear")')
    .max(10),
  lyricTags: z.array(psychographicTagSchema)
    .min(1, 'Must have at least 1 lyric tag - run generate-lyric-tags.ts first')
    .max(10),

  // Optional
  audioUrl: z.string().url().optional(),
  albumArt: z.string().url().optional(), // Spotify album art (reference)
  spotifyTrackId: spotifyTrackIdSchema.optional(),
  tags: z.array(z.string()).optional(), // General hashtags

  // For validation: song's Grove album art URLs (to ensure coverImageUrl is different)
  _songCoverGroveUrl: z.string().optional(),
  _songThumbnailGroveUrl: z.string().optional(),
}).refine(
  (data) => {
    // Ensure coverImageUrl is NOT the song's album art
    if (data._songCoverGroveUrl && data.coverImageUrl === data._songCoverGroveUrl) {
      return false;
    }
    if (data._songThumbnailGroveUrl && data.coverImageUrl === data._songThumbnailGroveUrl) {
      return false;
    }
    return true;
  },
  {
    message: 'coverImageUrl must be a video frame thumbnail, not album art. Extract thumbnail from video first.',
    path: ['coverImageUrl']
  }
);

export type PostMetadata = z.infer<typeof PostMetadataSchema>;

/**
 * Validate post metadata before upload
 * Throws ZodError with detailed messages if invalid
 */
export function validatePostMetadata(data: unknown): PostMetadata {
  return PostMetadataSchema.parse(data);
}

/**
 * Safe validation for post metadata
 */
export function safeValidatePostMetadata(data: unknown): z.SafeParseReturnType<unknown, PostMetadata> {
  return PostMetadataSchema.safeParse(data);
}
