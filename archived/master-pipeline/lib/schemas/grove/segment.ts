/**
 * Segment Metadata Schema (Grove Storage)
 *
 * REPLACES: SegmentRegistryV1 contract
 *
 * Segments are ~30-60 second portions of songs (typically from TikTok).
 * Includes audio assets (vocals, instrumental, alignment).
 *
 * Storage: Grove as lens://segment-{hash}.json (immutable)
 * Access: Via HTTP GET from Grove API
 * Updates: Only metadata URI changes (audio assets are immutable)
 *
 * Example URI: lens://segment-abc123.json
 *
 * NOTE: This is simpler than segment-v2.ts - it's the metadata ABOUT the segment,
 * not the alignment data itself. Alignment is stored separately.
 */

import { z } from 'zod';

/**
 * Time range within full song
 */
export const TimeRangeSchema = z.object({
  startTime: z.number().gte(0)
    .describe('Start time in full song (seconds)'),
  endTime: z.number().gt(0)
    .describe('End time in full song (seconds)'),
  duration: z.number().gt(0)
    .describe('Duration in seconds'),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: "End time must be greater than start time" }
).refine(
  (data) => Math.abs((data.endTime - data.startTime) - data.duration) < 0.1,
  { message: "Duration must equal endTime - startTime" }
);

export type TimeRange = z.infer<typeof TimeRangeSchema>;

/**
 * Audio matching metadata
 *
 * How the TikTok clip was matched to the full song
 */
export const MatchMetadataSchema = z.object({
  confidence: z.number().min(0).max(1)
    .describe('Match confidence (0-1)'),
  method: z.enum([
    'fingerprinting',
    'forced_alignment',
    'forced_alignment_with_gemini',
    'manual',
  ]).describe('Matching method used'),
}).describe('Audio matching metadata');

export type MatchMetadata = z.infer<typeof MatchMetadataSchema>;

/**
 * Processing status
 */
export const ProcessingStatusSchema = z.object({
  demucs: z.boolean().describe('Whether Demucs separation was performed'),
  falEnhancement: z.boolean().describe('Whether fal.ai audio2audio enhancement was performed'),
  alignment: z.boolean().describe('Whether ElevenLabs forced alignment was performed'),
}).describe('Processing steps completed');

export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>;

/**
 * Segment Metadata
 *
 * Complete segment information stored in Grove
 *
 * REPLACES: SegmentRegistryV1.Segment struct
 */
export const SegmentMetadataSchema = z.object({
  version: z.literal('1.0.0').describe('Metadata schema version'),

  // Identifiers
  segmentHash: z.string().min(1)
    .describe('Unique segment hash (keccak256 or sha256)'),
  geniusId: z.number().int().positive()
    .describe('Genius song ID (links to song metadata)'),
  tiktokSegmentId: z.string().min(1)
    .describe('TikTok music page ID'),
  tiktokUrl: z.string().url().optional()
    .describe('Original TikTok music URL (optional)'),

  // Time range in full song
  timeRange: TimeRangeSchema
    .describe('Time range within full song'),

  // Audio assets (stored in Grove)
  vocalsUri: z.string().startsWith('lens://').optional()
    .describe('Vocals track URI (Demucs output, NOT used in app - encrypted backup only)'),
  instrumentalUri: z.string().startsWith('lens://').optional()
    .describe('Instrumental track URI (fal.ai enhanced - PRIMARY, users karaoke over this)'),
  alignmentUri: z.string().startsWith('lens://').optional()
    .describe('Alignment metadata URI (ElevenLabs word timestamps + lyrics)'),

  // Cover art (optional, can use song cover)
  coverUri: z.string().url().optional()
    .describe('Segment cover art URI (optional, defaults to song cover)'),

  // Processing metadata
  match: MatchMetadataSchema.optional()
    .describe('How TikTok clip was matched to song'),
  processing: ProcessingStatusSchema.optional()
    .describe('Processing steps completed'),

  // Song reference (no enforcement, just a link)
  songUri: z.string().startsWith('lens://').optional()
    .describe('Song metadata URI (lens://song-{geniusId}.json)'),

  // Creator tracking
  registeredBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Address that registered this segment'),
  registeredByAccount: z.string().startsWith('lens://').optional()
    .describe('Lens Account URI of registrant (optional)'),

  // Status flags
  processed: z.boolean().default(false)
    .describe('Whether audio processing is complete'),
  enabled: z.boolean().default(true)
    .describe('Whether segment is enabled (soft delete flag)'),

  // Metadata timestamps
  createdAt: z.string().datetime()
    .describe('Segment registration timestamp'),
  processedAt: z.string().datetime().optional()
    .describe('When processing completed'),
  updatedAt: z.string().datetime()
    .describe('Last metadata update timestamp'),
}).describe('Complete segment metadata stored in Grove');

export type SegmentMetadata = z.infer<typeof SegmentMetadataSchema>;

/**
 * Validation helpers
 */
export function validateSegmentMetadata(data: unknown): SegmentMetadata {
  return SegmentMetadataSchema.parse(data);
}

export function validateTimeRange(data: unknown): TimeRange {
  return TimeRangeSchema.parse(data);
}

/**
 * Helper: Create initial segment metadata (before processing)
 */
export function createSegmentMetadata(params: {
  segmentHash: string;
  geniusId: number;
  tiktokSegmentId: string;
  tiktokUrl?: string;
  timeRange: TimeRange;
  registeredBy: string;
  songUri?: string;
  coverUri?: string;
  match?: MatchMetadata;
}): SegmentMetadata {
  const now = new Date().toISOString();

  return {
    version: '1.0.0',
    segmentHash: params.segmentHash,
    geniusId: params.geniusId,
    tiktokSegmentId: params.tiktokSegmentId,
    tiktokUrl: params.tiktokUrl,
    timeRange: params.timeRange,
    registeredBy: params.registeredBy,
    songUri: params.songUri,
    coverUri: params.coverUri,
    match: params.match,
    processed: false,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Helper: Mark segment as processed with audio assets
 */
export function markProcessed(
  segment: SegmentMetadata,
  assets: {
    vocalsUri?: string;
    instrumentalUri: string;
    alignmentUri: string;
  },
  processing: ProcessingStatus
): SegmentMetadata {
  const now = new Date().toISOString();

  return {
    ...segment,
    vocalsUri: assets.vocalsUri,
    instrumentalUri: assets.instrumentalUri,
    alignmentUri: assets.alignmentUri,
    processing,
    processed: true,
    processedAt: now,
    updatedAt: now,
  };
}

/**
 * Helper: Check if segment has all required assets
 */
export function hasRequiredAssets(segment: SegmentMetadata): boolean {
  return !!(
    segment.instrumentalUri && // PRIMARY (required for karaoke)
    segment.alignmentUri       // Required for word-level timing
  );
}

/**
 * Helper: Check if segment is ready for karaoke
 */
export function isReadyForKaraoke(segment: SegmentMetadata): boolean {
  return (
    segment.processed &&
    segment.enabled &&
    hasRequiredAssets(segment)
  );
}

/**
 * Helper: Generate segment hash
 *
 * Deterministic hash from geniusId + tiktokSegmentId
 * Matches SegmentRegistryV1.getSegmentHash()
 */
export function generateSegmentHash(
  geniusId: number,
  tiktokSegmentId: string
): string {
  // Simple hash (use keccak256 in production)
  const input = `${geniusId}-${tiktokSegmentId}`;
  return Buffer.from(input).toString('hex').slice(0, 16);
}
