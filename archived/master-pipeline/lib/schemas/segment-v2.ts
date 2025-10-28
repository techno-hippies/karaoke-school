/**
 * Segment Schema v2.0.0
 *
 * Enhanced schema with:
 * - Line-level lyrics (from LRCLib) for frontend display
 * - Word-level lyrics (from ElevenLabs) for karaoke timing
 * - Mutable translations via Grove ACL
 * - PKP-controlled updates via Lit Actions
 */

import { z } from 'zod';

/**
 * Word-level timing (from ElevenLabs forced alignment)
 * All timing is relative to segment start (not line start!)
 * This makes MP3 playback sync easier
 */
export const SyncedWordSchema = z.object({
  start: z.number().gte(0).describe('Word start time in seconds (relative to segment start, NOT line start)'),
  end: z.number().gte(0).describe('Word end time in seconds (relative to segment start, NOT line start)'),
  text: z.string().describe('Word text (including spaces/punctuation)'),
}).refine(
  (data) => data.end >= data.start,
  { message: "End time must be >= start time" }
);

export type SyncedWord = z.infer<typeof SyncedWordSchema>;

/**
 * Line-level lyrics (from LRCLib synced lyrics)
 * Cropped to segment timeframe, timestamps relative to segment start
 * Contains nested word-level timing for karaoke
 */
export const SyncedLineSchema = z.object({
  start: z.number().gte(0).describe('Line start time in seconds (relative to segment start)'),
  end: z.number().gte(0).describe('Line end time in seconds (relative to segment start)'),
  text: z.string().min(1).describe('Full line text'),
  words: z.array(SyncedWordSchema).describe('Word-level timing for this line (from ElevenLabs)'),
}).refine(
  (data) => data.end >= data.start,
  { message: "End time must be >= start time" }
);

export type SyncedLine = z.infer<typeof SyncedLineSchema>;

/**
 * Complete lyrics for a language
 * Lines contain nested word-level timing
 */
export const SegmentLyricsSchema = z.object({
  plain: z.string().describe('Plain text lyrics (no timing)'),
  lines: z.array(SyncedLineSchema).describe('Line-level lyrics with nested word timing'),
});

export type SegmentLyrics = z.infer<typeof SegmentLyricsSchema>;

/**
 * Segment Alignment Metadata (MUTABLE on Grove)
 *
 * Uploaded to Grove as alignmentUri with ACL:
 * - PKP can edit via Lit Actions
 * - Wallet can edit if authorized
 * - Frontend can add translations by updating this file
 *
 * Storage: ~30KB (en only) → ~150KB (en + 5 translations)
 */
export const SegmentAlignmentMetadataSchema = z.object({
  version: z.literal('2.0.0').describe('Metadata schema version'),
  geniusId: z.number().int().positive().describe('Genius song ID'),
  segmentHash: z.string().length(16).describe('Local segment hash (sha256)'),
  tiktokMusicId: z.string().min(1).describe('TikTok music ID'),

  timeRange: z.object({
    startTime: z.number().gte(0).describe('Start time in full song (seconds)'),
    endTime: z.number().gt(0).describe('End time in full song (seconds)'),
    duration: z.number().gt(0).describe('Duration in seconds'),
  }).refine(
    (data) => data.endTime > data.startTime,
    { message: "End time must be greater than start time" }
  ),

  /**
   * Lyrics by language code (ISO 639-1: en, vi, zh, es, etc.)
   *
   * English is REQUIRED (source from LRCLib + ElevenLabs)
   * Other languages are OPTIONAL (added on-demand via translations)
   */
  lyrics: z.object({
    languages: z.record(
      z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/), // ISO 639-1 codes
      SegmentLyricsSchema
    ).refine(
      (languages) => 'en' in languages,
      { message: "English (en) lyrics are required" }
    ).describe('Lyrics by language code'),

    lrclib: z.object({
      id: z.number().int().describe('LRCLib lyrics ID'),
      source: z.literal('lrclib').describe('Lyrics source'),
    }),
  }),

  /**
   * Metadata about translations
   * Tracks who added which languages and when
   */
  translationMeta: z.object({
    backend: z.array(z.string()).optional()
      .describe('Languages added by backend pipeline (e.g., ["vi", "zh"])'),
    frontend: z.record(
      z.string(), // language code
      z.object({
        addedBy: z.string().optional().describe('Wallet address or PKP that added this'),
        addedAt: z.string().datetime().describe('When translation was added'),
        method: z.enum(['lit-action', 'wallet', 'api']).describe('How translation was added'),
      })
    ).optional().describe('Metadata for frontend-added translations'),
  }).optional(),

  createdAt: z.string().datetime().describe('Initial creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
});

export type SegmentAlignmentMetadata = z.infer<typeof SegmentAlignmentMetadataSchema>;

/**
 * Segment Manifest (Local tracking only)
 */
export const SegmentManifestSchema = z.object({
  segmentHash: z.string().length(16),
  geniusId: z.number().int().positive(),
  tiktokMusicId: z.string().min(1),
  tiktokUrl: z.string().url(),
  tiktokSlug: z.string().min(1),

  match: z.object({
    startTime: z.number().gte(0),
    endTime: z.number().gt(0),
    duration: z.number().gt(0),
    confidence: z.number().min(0).max(1),
    method: z.enum([
      'fingerprinting',
      'forced_alignment',
      'forced_alignment_with_gemini',
      'manual',
    ]),
  }),

  files: z.object({
    tiktokClip: z.string().min(1),
    fullSong: z.string().min(1),
    cropped: z.string().min(1),
    vocals: z.string().min(1).describe('Local vocals file (not uploaded to Grove)'),
    instrumental: z.string().min(1),
  }),

  grove: z.object({
    instrumentalUri: z.string().startsWith('lens://').describe('fal.ai enhanced instrumental only'),
    alignmentUri: z.string().startsWith('lens://').describe('Alignment metadata with lyrics'),
    alignmentStorageKey: z.string().optional().describe('Storage key for editing alignment'),
  }),

  processing: z.object({
    demucs: z.boolean(),
    falEnhancement: z.boolean().describe('REQUIRED: Must be true for copyright compliance'),
  }),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
}).refine(
  (data) => {
    // COPYRIGHT COMPLIANCE: If Grove URIs exist, fal.ai enhancement MUST have been applied
    if (data.grove?.instrumentalUri) {
      return data.processing.falEnhancement === true;
    }
    return true;
  },
  {
    message: "COPYRIGHT VIOLATION: Cannot upload instrumental to Grove without fal.ai audio-to-audio transformation. Set processing.falEnhancement to true.",
    path: ['processing', 'falEnhancement'],
  }
);

export type SegmentManifest = z.infer<typeof SegmentManifestSchema>;

/**
 * Validation helpers
 */
export function validateSegmentManifest(data: unknown): SegmentManifest {
  return SegmentManifestSchema.parse(data);
}

export function validateSegmentAlignmentMetadata(data: unknown): SegmentAlignmentMetadata {
  return SegmentAlignmentMetadataSchema.parse(data);
}

/**
 * Helper: Check if a language exists in alignment
 */
export function hasLanguage(
  alignment: SegmentAlignmentMetadata,
  languageCode: string
): boolean {
  return languageCode in alignment.lyrics.languages;
}

/**
 * Helper: Get available languages
 */
export function getAvailableLanguages(alignment: SegmentAlignmentMetadata): string[] {
  return Object.keys(alignment.lyrics.languages);
}

/**
 * COPYRIGHT COMPLIANCE: Verify segment is safe to upload
 *
 * This function ensures fal.ai audio-to-audio transformation has been applied
 * before uploading instrumental audio to Grove or registering on-chain.
 *
 * @throws Error if segment contains copyrighted audio
 */
export function assertCopyrightCompliance(manifest: SegmentManifest): void {
  if (!manifest.processing.falEnhancement) {
    throw new Error(
      'COPYRIGHT VIOLATION: Cannot upload segment without fal.ai audio-to-audio transformation. ' +
      'The instrumental track contains copyrighted audio and must be transformed first.'
    );
  }

  if (!manifest.processing.demucs) {
    throw new Error(
      'PROCESSING ERROR: Demucs vocal separation must be completed before upload.'
    );
  }
}
