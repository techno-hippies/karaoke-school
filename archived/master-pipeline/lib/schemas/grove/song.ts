/**
 * Song Metadata Schema (Grove Storage)
 *
 * REPLACES: SongRegistryV1 contract
 *
 * Songs are stored as immutable Grove JSON files.
 * No artist registry dependency - just references to Lens accounts.
 *
 * Storage: Grove as lens://song-{geniusId}.json (immutable)
 * Access: Via HTTP GET from Grove API
 * Indexing: Optional event emission for The Graph
 *
 * Example URI: lens://song-10047250.json (TEXAS HOLD 'EM)
 */

import { z } from 'zod';

/**
 * MLC Licensing Data (from songs/02-fetch-mlc-data.ts)
 *
 * Stored inline with song metadata
 */
export const MLCPublisherSchema = z.object({
  name: z.string().describe('Publisher name (e.g., "Sony/ATV Music Publishing LLC")'),
  share: z.number().min(0).max(100).describe('Publisher share percentage'),
});

export type MLCPublisher = z.infer<typeof MLCPublisherSchema>;

export const MLCDataSchema = z.object({
  isrc: z.string().optional()
    .describe('International Standard Recording Code'),
  publishers: z.array(MLCPublisherSchema)
    .describe('Music publishers and their shares'),
  writers: z.array(z.string())
    .describe('Song writers/composers'),
  mechanicalLicensed: z.boolean().default(false)
    .describe('Whether mechanical license is acquired'),
}).describe('MLC licensing and rights information');

export type MLCData = z.infer<typeof MLCDataSchema>;

/**
 * Synced Lyrics (from LRCLib)
 *
 * Line-level lyrics with timestamps
 */
export const SyncedLyricLineSchema = z.object({
  startTime: z.number().gte(0)
    .describe('Line start time in seconds'),
  text: z.string()
    .describe('Lyric line text'),
});

export type SyncedLyricLine = z.infer<typeof SyncedLyricLineSchema>;

export const LyricsSchema = z.object({
  synced: z.array(SyncedLyricLineSchema)
    .describe('Synced lyrics (line-level timestamps)'),
  plain: z.string()
    .describe('Plain text lyrics (no timing)'),
  source: z.object({
    provider: z.enum(['lrclib', 'genius', 'manual', 'other']).describe('Lyrics source'),
    id: z.union([z.number(), z.string()]).optional().describe('Source ID (if applicable)'),
  }).optional(),
}).describe('Song lyrics with synchronization data');

export type Lyrics = z.infer<typeof LyricsSchema>;

/**
 * Song Metadata
 *
 * Complete song information stored in Grove
 *
 * REPLACES: SongRegistryV1.Song struct
 */
export const SongMetadataSchema = z.object({
  version: z.literal('1.0.0').describe('Metadata schema version'),

  // Identifiers
  geniusId: z.number().int().positive()
    .describe('Genius.com song ID (primary identifier)'),
  spotifyId: z.string().optional()
    .describe('Spotify track ID (e.g., "0Z7nGFVCLfixWctgePsRk9")'),
  tiktokMusicId: z.string().optional()
    .describe('TikTok music page ID (e.g., "7334542274145454891")'),

  // Basic info
  title: z.string().min(1)
    .describe('Song title (e.g., "TEXAS HOLD \'EM")'),
  artist: z.string().min(1)
    .describe('Artist name for display (e.g., "Beyoncé")'),
  duration: z.number().int().positive()
    .describe('Song duration in seconds'),

  // Optional: Reference to artist account (NO HIERARCHY - just a link)
  artistAccount: z.string().startsWith('lens://').optional()
    .describe('Lens Account URI for artist (optional, no enforcement)'),
  geniusArtistId: z.number().int().positive().optional()
    .describe('Genius artist ID (for reference only, no contract validation)'),

  // Media
  coverUri: z.string().url()
    .describe('Cover art URI (Genius URL, IPFS, or lens://)'),

  // Rights and licensing
  mlcData: MLCDataSchema.optional()
    .describe('MLC licensing data (publishers, writers, ISRC)'),
  copyrightFree: z.boolean().default(false)
    .describe('Whether song is public domain or copyright-free'),

  // Lyrics
  lyrics: LyricsSchema.optional()
    .describe('Synced lyrics from LRCLib or other source'),

  // Segments (array of Grove URIs)
  segments: z.array(z.string().startsWith('lens://'))
    .default([])
    .describe('Array of segment metadata URIs (lens://segment-{hash}.json)'),

  // Creator tracking (who registered this song)
  registeredBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Address that registered this song'),
  registeredByAccount: z.string().startsWith('lens://').optional()
    .describe('Lens Account URI of registrant (optional)'),

  // Status flags
  enabled: z.boolean().default(true)
    .describe('Whether song is enabled (soft delete flag)'),

  // Metadata timestamps
  createdAt: z.string().datetime()
    .describe('Song registration timestamp'),
  updatedAt: z.string().datetime()
    .describe('Last metadata update timestamp'),
}).describe('Complete song metadata stored in Grove');

export type SongMetadata = z.infer<typeof SongMetadataSchema>;

/**
 * Validation helpers
 */
export function validateSongMetadata(data: unknown): SongMetadata {
  return SongMetadataSchema.parse(data);
}

export function validateMLCData(data: unknown): MLCData {
  return MLCDataSchema.parse(data);
}

export function validateLyrics(data: unknown): Lyrics {
  return LyricsSchema.parse(data);
}

/**
 * Helper: Create initial song metadata
 */
export function createSongMetadata(params: {
  geniusId: number;
  title: string;
  artist: string;
  duration: number;
  coverUri: string;
  registeredBy: string;
  spotifyId?: string;
  tiktokMusicId?: string;
  geniusArtistId?: number;
  artistAccount?: string;
  copyrightFree?: boolean;
}): SongMetadata {
  const now = new Date().toISOString();

  return {
    version: '1.0.0',
    geniusId: params.geniusId,
    title: params.title,
    artist: params.artist,
    duration: params.duration,
    coverUri: params.coverUri,
    registeredBy: params.registeredBy,
    spotifyId: params.spotifyId,
    tiktokMusicId: params.tiktokMusicId,
    geniusArtistId: params.geniusArtistId,
    artistAccount: params.artistAccount,
    copyrightFree: params.copyrightFree ?? false,
    segments: [],
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Helper: Add segment to song
 */
export function addSegment(
  song: SongMetadata,
  segmentUri: string
): SongMetadata {
  // Check if segment already exists
  if (song.segments.includes(segmentUri)) {
    throw new Error(`Segment ${segmentUri} already in song`);
  }

  return {
    ...song,
    segments: [...song.segments, segmentUri],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper: Add MLC licensing data
 */
export function addMLCData(
  song: SongMetadata,
  mlcData: MLCData
): SongMetadata {
  return {
    ...song,
    mlcData,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper: Add lyrics
 */
export function addLyrics(
  song: SongMetadata,
  lyrics: Lyrics
): SongMetadata {
  return {
    ...song,
    lyrics,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper: Check if song has segments
 */
export function hasSegments(song: SongMetadata): boolean {
  return song.segments.length > 0;
}

/**
 * Helper: Get segment count
 */
export function getSegmentCount(song: SongMetadata): number {
  return song.segments.length;
}
