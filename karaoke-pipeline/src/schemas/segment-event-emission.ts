/**
 * Segment Event Emission Schemas
 *
 * Validates data before emitting contract events to prevent gas waste
 * Follows pattern from grc20-artist-mint.ts and grc20-work-mint.ts
 */

import { z } from 'zod';

// ============ Base Validators ============

/**
 * Grove URL validator - must be https://api.grove.storage/<cid>
 */
const GroveUrlSchema = z
  .string()
  .url()
  .startsWith('https://api.grove.storage/', 'Must be Grove URL');

/**
 * Segment hash (bytes32 in Solidity) - 0x + 64 hex chars
 */
const SegmentHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be bytes32 hex string (0x + 64 hex chars)');

/**
 * GRC-20 UUID validator
 */
const GRC20UuidSchema = z.string().uuid('Must be valid UUID');

/**
 * ISO 639-1 language code (2 letters)
 */
const LanguageCodeSchema = z
  .string()
  .length(2, 'Must be ISO 639-1 (2 letters)')
  .toLowerCase();

/**
 * Confidence score (0-10000 for basis points)
 */
const ConfidenceScoreSchema = z
  .number()
  .int()
  .min(0)
  .max(10000, 'Must be 0-10000 (basis points)');

// ============ Database Query Result Schema ============

/**
 * Raw data from database query (before validation)
 * Represents joined data from karaoke_segments, grc20_work_mints,
 * elevenlabs_word_alignments, and lyrics_translations
 */
export const SegmentEmissionDataSchema = z.object({
  // From karaoke_segments
  spotify_track_id: z.string().min(1, 'Spotify track ID required'),
  optimal_segment_start_ms: z.number().int().nonnegative('Start time must be >= 0'),
  optimal_segment_end_ms: z.number().int().positive('End time must be > 0'),
  cropped_instrumental_grove_url: GroveUrlSchema,
  clip_start_ms: z.number().int().nonnegative('Clip start must be >= 0'),
  clip_end_ms: z.number().int().positive('Clip end must be > 0'),
  clip_cropped_grove_url: GroveUrlSchema.describe('TikTok clip audio (50s)'),

  // From grc20_work_mints (via join)
  grc20_work_id: GRC20UuidSchema,

  // From grc20_works (song metadata - required for display)
  title: z.string().min(1, 'Song title required'),
  artist_name: z.string().min(1, 'Artist name required'),

  // From elevenlabs_word_alignments
  alignment_words: z
    .array(z.any())
    .min(1, 'At least one word required for alignment'),

  // From lyrics_translations (aggregated as JSONB array)
  translations: z
    .array(
      z.object({
        language_code: LanguageCodeSchema,
        lines: z.array(z.any()).min(1, 'At least one line required'),
        confidence_score: z.number().nullable().optional(),
        translation_source: z.string().default('gemini-flash-2.5'),
        grove_url: z.string().nullable().optional(), // NULL until we upload
      })
    )
    .min(1, 'At least one translation required'),
});

export type SegmentEmissionData = z.infer<typeof SegmentEmissionDataSchema>;

// ============ Grove Metadata Schemas ============

/**
 * Translation JSON structure for Grove upload
 */
export const TranslationMetadataSchema = z.object({
  spotify_track_id: z.string(),
  language_code: LanguageCodeSchema,
  translation_source: z.string(),
  confidence_score: z.number(),
  lines: z.array(z.any()), // Line-level translation data
});

export type TranslationMetadata = z.infer<typeof TranslationMetadataSchema>;

/**
 * Alignment JSON structure for Grove upload
 */
export const AlignmentMetadataSchema = z.object({
  spotify_track_id: z.string(),
  total_words: z.number().int().positive(),
  words: z.array(z.any()), // Word-level timing data from ElevenLabs
});

export type AlignmentMetadata = z.infer<typeof AlignmentMetadataSchema>;

/**
 * Segment metadata JSON for Grove upload
 * This is the primary metadata file that links to all assets
 */
export const SegmentMetadataSchema = z.object({
  segment_hash: SegmentHashSchema,
  grc20_work_id: GRC20UuidSchema,
  spotify_track_id: z.string(),

  // Song metadata from GRC-20 work (required)
  title: z.string(),
  artist: z.string(),

  timing: z.object({
    // Reference: Full karaoke segment timing
    full_segment_start_ms: z.number().int().nonnegative(),
    full_segment_end_ms: z.number().int().positive(),
    full_segment_duration_ms: z.number().int().positive(),

    // Primary: TikTok clip timing (what users karaoke over)
    tiktok_clip_start_ms: z.number().int().nonnegative(),
    tiktok_clip_end_ms: z.number().int().positive(),
    tiktok_clip_duration_ms: z.number().int().positive(),
  }),

  assets: z.object({
    // Primary: TikTok clip audio (~50s) - users karaoke over this
    instrumental: GroveUrlSchema,
    // Reference: Full karaoke segment (~190s) - optional, for reference only
    full_instrumental: GroveUrlSchema,
    // Alignment: ElevenLabs word-level timing
    alignment: GroveUrlSchema,
  }),

  translations: z.array(
    z.object({
      language_code: LanguageCodeSchema,
      grove_url: GroveUrlSchema,
    })
  ),
});

export type SegmentMetadata = z.infer<typeof SegmentMetadataSchema>;

// ============ Contract Event Schemas ============

/**
 * Data for SegmentRegistered event
 * Validates before calling emitSegmentRegistered()
 */
export const SegmentRegisteredEventSchema = z.object({
  segment_hash: SegmentHashSchema,
  grc20_work_id: GRC20UuidSchema,
  spotify_track_id: z.string().min(1),
  segment_start_ms: z.number().int().nonnegative(),
  segment_end_ms: z.number().int().positive(),
  metadata_uri: GroveUrlSchema,
});

export type SegmentRegisteredEvent = z.infer<typeof SegmentRegisteredEventSchema>;

/**
 * Data for SegmentProcessed event
 * Validates before calling emitSegmentProcessed()
 */
export const SegmentProcessedEventSchema = z.object({
  segment_hash: SegmentHashSchema,
  instrumental_uri: GroveUrlSchema,
  alignment_uri: GroveUrlSchema,
  translation_count: z.number().int().min(0).max(255, 'Max 255 translations (uint8)'),
  metadata_uri: GroveUrlSchema,
});

export type SegmentProcessedEvent = z.infer<typeof SegmentProcessedEventSchema>;

/**
 * Data for TranslationAdded event
 * Validates before calling emitTranslationAdded()
 */
export const TranslationAddedEventSchema = z.object({
  segment_hash: SegmentHashSchema,
  language_code: LanguageCodeSchema,
  translation_uri: GroveUrlSchema,
});

export type TranslationAddedEvent = z.infer<typeof TranslationAddedEventSchema>;

// ============ Validation Helpers ============

/**
 * Validate segment data from database query
 */
export function validateSegmentData(data: unknown): {
  success: boolean;
  segment?: SegmentEmissionData;
  error?: z.ZodError;
  missingFields?: string[];
} {
  const result = SegmentEmissionDataSchema.safeParse(data);

  if (result.success) {
    return { success: true, segment: result.data };
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
    error: result.error,
    missingFields,
  };
}

/**
 * Validate segment metadata before Grove upload
 */
export function validateSegmentMetadata(data: unknown): {
  success: boolean;
  metadata?: SegmentMetadata;
  error?: z.ZodError;
} {
  const result = SegmentMetadataSchema.safeParse(data);

  if (result.success) {
    return { success: true, metadata: result.data };
  }

  return { success: false, error: result.error };
}

/**
 * Validate event data before contract call
 */
export function validateSegmentRegisteredEvent(data: unknown): {
  success: boolean;
  event?: SegmentRegisteredEvent;
  error?: z.ZodError;
} {
  const result = SegmentRegisteredEventSchema.safeParse(data);
  return result.success
    ? { success: true, event: result.data }
    : { success: false, error: result.error };
}

export function validateSegmentProcessedEvent(data: unknown): {
  success: boolean;
  event?: SegmentProcessedEvent;
  error?: z.ZodError;
} {
  const result = SegmentProcessedEventSchema.safeParse(data);
  return result.success
    ? { success: true, event: result.data }
    : { success: false, error: result.error };
}

export function validateTranslationAddedEvent(data: unknown): {
  success: boolean;
  event?: TranslationAddedEvent;
  error?: z.ZodError;
} {
  const result = TranslationAddedEventSchema.safeParse(data);
  return result.success
    ? { success: true, event: result.data }
    : { success: false, error: result.error };
}

// ============ SQL Query ============

/**
 * SQL query to fetch segments ready for event emission
 * Joins karaoke_segments with GRC-20 mints, alignments, and translations
 */
export const GET_SEGMENTS_FOR_EMISSION_QUERY = `
  SELECT
    ks.spotify_track_id,
    ks.optimal_segment_start_ms,
    ks.optimal_segment_end_ms,
    ks.clip_start_ms,
    ks.clip_end_ms,
    ks.cropped_instrumental_grove_url,
    ks.clip_cropped_grove_url,

    -- GRC-20 work ID (via join through grc20_work_recordings)
    gwm.grc20_entity_id as grc20_work_id,

    -- Song metadata for UI display
    gw.title,
    ga.name as artist_name,

    -- ElevenLabs alignment (word-level timing, filtered & offset to clip window)
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'text', word->>'text',
          'start', (CAST(word->>'start' AS NUMERIC) - ks.clip_start_ms::numeric / 1000),
          'end', (CAST(word->>'end' AS NUMERIC) - ks.clip_start_ms::numeric / 1000),
          'loss', word->'loss',
          'confidence', word->'confidence'
        ) ORDER BY CAST(word->>'start' AS NUMERIC)
      )
      FROM jsonb_array_elements(ewa.words) as word
      WHERE CAST(word->>'end' AS NUMERIC) >= ks.clip_start_ms::numeric / 1000
        AND CAST(word->>'start' AS NUMERIC) <= ks.clip_end_ms::numeric / 1000
    ) as alignment_words,

    -- Translations (aggregated as JSONB array, filtered & offset to clip window)
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'language_code', lt.language_code,
          'lines', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'lineIndex', line->>'lineIndex',
                'originalText', line->>'originalText',
                'translatedText', line->>'translatedText',
                'start', (CAST(line->>'start' AS NUMERIC) - ks.clip_start_ms::numeric / 1000),
                'end', (CAST(line->>'end' AS NUMERIC) - ks.clip_start_ms::numeric / 1000),
                'words', (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'text', word->>'text',
                      'start', (CAST(word->>'start' AS NUMERIC) - ks.clip_start_ms::numeric / 1000),
                      'end', (CAST(word->>'end' AS NUMERIC) - ks.clip_start_ms::numeric / 1000)
                    ) ORDER BY CAST(word->>'start' AS NUMERIC)
                  )
                  FROM jsonb_array_elements(line->'words') as word
                  WHERE CAST(word->>'end' AS NUMERIC) >= ks.clip_start_ms::numeric / 1000
                    AND CAST(word->>'start' AS NUMERIC) <= ks.clip_end_ms::numeric / 1000
                )
              ) ORDER BY CAST(line->>'start' AS NUMERIC)
            )
            FROM jsonb_array_elements(lt.lines) as line
            WHERE CAST(line->>'end' AS NUMERIC) >= ks.clip_start_ms::numeric / 1000
              AND CAST(line->>'start' AS NUMERIC) <= ks.clip_end_ms::numeric / 1000
          ),
          'confidence_score', lt.confidence_score,
          'translation_source', lt.translation_source,
          'grove_url', lt.grove_url
        ) ORDER BY lt.language_code
      ) FILTER (WHERE lt.id IS NOT NULL),
      '[]'::jsonb
    ) as translations

  FROM karaoke_segments ks
  INNER JOIN grc20_work_recordings gwr ON gwr.spotify_track_id = ks.spotify_track_id
  INNER JOIN grc20_works gw ON gw.id = gwr.work_id
  INNER JOIN grc20_work_mints gwm ON (
    (gw.iswc IS NOT NULL AND gw.iswc = gwm.iswc) OR
    (gw.iswc IS NULL AND gw.genius_song_id = gwm.genius_song_id)
  )
  LEFT JOIN grc20_artists ga ON gw.primary_artist_id = ga.id
  LEFT JOIN elevenlabs_word_alignments ewa ON ks.spotify_track_id = ewa.spotify_track_id
  LEFT JOIN lyrics_translations lt ON ks.spotify_track_id = lt.spotify_track_id

  WHERE ks.cropped_instrumental_grove_url IS NOT NULL  -- Must have full instrumental
    AND ks.clip_cropped_grove_url IS NOT NULL          -- Must have TikTok clip
    AND ks.clip_start_ms IS NOT NULL                   -- Must have clip timing
    AND ks.clip_end_ms IS NOT NULL
    AND ks.optimal_segment_start_ms IS NOT NULL         -- Must have segment timing
    AND ks.optimal_segment_end_ms IS NOT NULL
    AND gwm.grc20_entity_id IS NOT NULL                 -- Must have GRC-20 work
    AND ewa.words IS NOT NULL                           -- Must have alignment

  GROUP BY
    ks.spotify_track_id,
    ks.optimal_segment_start_ms,
    ks.optimal_segment_end_ms,
    ks.clip_start_ms,
    ks.clip_end_ms,
    ks.cropped_instrumental_grove_url,
    ks.clip_cropped_grove_url,
    gwm.grc20_entity_id,
    gw.title,
    ga.name,
    ewa.words

  ORDER BY ks.spotify_track_id
`;
