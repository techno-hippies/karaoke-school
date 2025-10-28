/**
 * Song Metadata Schema
 *
 * Complete song metadata structure for Grove storage
 */

import { z } from 'zod';
import { MLCDataSchema } from './mlc.js';
import { LyricsSchema } from './lyrics.js';

/**
 * Spotify metadata
 */
export const SpotifyDataSchema = z.object({
  id: z.string().min(1).describe('Spotify track ID'),
  url: z.string().url().describe('Spotify track URL'),
});

export type SpotifyData = z.infer<typeof SpotifyDataSchema>;

/**
 * Segment metadata (embedded in song)
 */
export const SegmentMetadataSchema = z.object({
  tiktokId: z.string().min(1).describe('TikTok music ID'),
  startTime: z.number().gte(0).describe('Start time in seconds'),
  endTime: z.number().gt(0).describe('End time in seconds'),
  duration: z.number().gt(0).describe('Duration in seconds'),
  vocalsUri: z.string().startsWith('lens://').describe('Grove URI for vocals (backup)'),
  instrumentalUri: z.string().startsWith('lens://').describe('Grove URI for instrumental (primary)'),
  alignmentUri: z.string().startsWith('lens://').optional().describe('Grove URI for word alignment'),
  coverUri: z.string().startsWith('lens://').optional().describe('Seedream derivative cover'),
  tiktokUrl: z.string().url().optional().describe('Original TikTok music page URL'),
  processed: z.boolean().default(false),
  storyProtocol: z.object({
    ipAssetId: z.string(),
    txHash: z.string(),
    metadataUri: z.string(),
    licenseTermsIds: z.array(z.string()).optional(),
    royaltyVault: z.string().optional(),
    derivativeCoverUri: z.string().optional(),
    mintedAt: z.string().datetime(),
  }).optional(),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: "End time must be greater than start time" }
);

export type SegmentMetadata = z.infer<typeof SegmentMetadataSchema>;

/**
 * Complete Song Metadata
 *
 * This is the structure uploaded to Grove (metadataUri)
 */
export const SongMetadataSchema = z.object({
  version: z.literal('1.0.0').describe('Metadata schema version'),
  geniusId: z.number().int().positive().describe('Genius song ID'),
  title: z.string().min(1).describe('Song title'),
  artist: z.string().min(1).describe('Artist name'),
  album: z.string().nullable().describe('Album name'),
  duration: z.number().int().positive().describe('Song duration in seconds'),
  coverUri: z.string().url().describe('Album cover URL (Genius - reference only)'),
  spotify: SpotifyDataSchema.optional().describe('Spotify metadata'),
  licensing: MLCDataSchema.describe('MLC licensing data'),
  lyrics: LyricsSchema.describe('Synced lyrics'),
  segments: z.array(SegmentMetadataSchema).default([]).describe('Processed segments'),
  createdAt: z.string().datetime().describe('Metadata creation timestamp'),
});

export type SongMetadata = z.infer<typeof SongMetadataSchema>;

/**
 * Validation helper for partial updates
 */
export const PartialSongMetadataSchema = SongMetadataSchema.partial();
export type PartialSongMetadata = z.infer<typeof PartialSongMetadataSchema>;
