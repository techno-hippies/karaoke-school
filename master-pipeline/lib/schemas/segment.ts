/**
 * Segment Schema
 *
 * Zod schemas for segment manifests and alignment metadata
 */

import { z } from 'zod';

/**
 * Synced word-level lyrics
 */
export const SyncedWordSchema = z.object({
  start: z.number().gte(0).describe('Word start time in seconds (relative to segment start)'),
  text: z.string().describe('Word text (including spaces/punctuation)'),
});

export type SyncedWord = z.infer<typeof SyncedWordSchema>;

/**
 * Segment lyrics (cropped to segment timeframe)
 */
export const SegmentLyricsSchema = z.object({
  plain: z.string().describe('Plain text lyrics for this segment'),
  synced: z.array(SyncedWordSchema).describe('Word-level synced lyrics'),
});

export type SegmentLyrics = z.infer<typeof SegmentLyricsSchema>;

/**
 * Segment Alignment Metadata
 *
 * This is uploaded to Grove as alignmentUri
 * Contains lyrics cropped to segment timeframe (copyright compliance)
 */
export const SegmentAlignmentMetadataSchema = z.object({
  version: z.literal('1.0.0').describe('Metadata schema version'),
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
  lyrics: z.object({
    en: SegmentLyricsSchema.optional().describe('English lyrics (cropped to segment)'),
    lrclib: z.object({
      id: z.number().int().describe('LRCLib lyrics ID'),
      source: z.literal('lrclib').describe('Lyrics source'),
    }),
  }),
  createdAt: z.string().datetime().describe('Metadata creation timestamp'),
});

export type SegmentAlignmentMetadata = z.infer<typeof SegmentAlignmentMetadataSchema>;

/**
 * Segment Manifest
 *
 * Local manifest stored in data/segments/{hash}/manifest.json
 * Tracks processing state and file paths
 */
export const SegmentManifestSchema = z.object({
  segmentHash: z.string().length(16).describe('Local segment hash (sha256)'),
  geniusId: z.number().int().positive().describe('Genius song ID'),
  tiktokMusicId: z.string().min(1).describe('TikTok music ID'),
  tiktokUrl: z.string().url().describe('TikTok music page URL'),
  tiktokSlug: z.string().min(1).describe('TikTok music slug'),
  match: z.object({
    startTime: z.number().gte(0).describe('Start time in full song (seconds)'),
    endTime: z.number().gt(0).describe('End time in full song (seconds)'),
    duration: z.number().gt(0).describe('Duration in seconds'),
    confidence: z.number().min(0).max(1).describe('Match confidence (0-1)'),
    method: z.enum([
      'fingerprinting',
      'forced_alignment',
      'forced_alignment_with_gemini',
      'manual',
    ]).describe('Matching method used'),
  }),
  files: z.object({
    tiktokClip: z.string().min(1).describe('Path to TikTok clip video'),
    fullSong: z.string().min(1).describe('Path to full song audio'),
    cropped: z.string().min(1).describe('Path to cropped segment audio'),
    vocals: z.string().min(1).describe('Path to vocals (Demucs)'),
    instrumental: z.string().min(1).describe('Path to instrumental (fal.ai enhanced)'),
  }),
  grove: z.object({
    vocalsUri: z.string().startsWith('lens://').describe('Grove URI for vocals'),
    instrumentalUri: z.string().startsWith('lens://').describe('Grove URI for instrumental'),
    alignmentUri: z.string().startsWith('lens://').describe('Grove URI for alignment metadata'),
  }),
  processing: z.object({
    demucs: z.boolean().describe('Demucs vocal separation completed'),
    falEnhancement: z.boolean().describe('fal.ai instrumental enhancement completed'),
  }),
  createdAt: z.string().datetime().describe('Segment creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
});

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
 * Partial schemas for updates
 */
export const PartialSegmentManifestSchema = SegmentManifestSchema.partial();
export type PartialSegmentManifest = z.infer<typeof PartialSegmentManifestSchema>;
