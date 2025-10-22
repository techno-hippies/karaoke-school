/**
 * Performance Metadata Schema (Grove Storage)
 *
 * REPLACES: PerformanceRegistryV1 contract
 *
 * Performance = User's karaoke recording of a full segment
 * Includes video, optional audio, and AI grading
 *
 * Storage: Grove as lens://performance-{id}.json (immutable after grading)
 * Access: Via HTTP GET from Grove API
 * Anti-cheat: PKP-signed grading events on-chain
 *
 * Example URI: lens://performance-12345.json
 */

import { z } from 'zod';

/**
 * Grading breakdown (optional detailed scoring)
 */
export const GradingBreakdownSchema = z.object({
  pronunciation: z.number().int().min(0).max(10000).optional()
    .describe('Pronunciation score in basis points (0-10000)'),
  timing: z.number().int().min(0).max(10000).optional()
    .describe('Timing/rhythm score in basis points'),
  pitch: z.number().int().min(0).max(10000).optional()
    .describe('Pitch accuracy score in basis points'),
  expression: z.number().int().min(0).max(10000).optional()
    .describe('Expression/emotion score in basis points'),
  overall: z.number().int().min(0).max(10000)
    .describe('Overall score in basis points (required)'),
}).describe('Detailed grading breakdown');

export type GradingBreakdown = z.infer<typeof GradingBreakdownSchema>;

/**
 * AI grading metadata
 */
export const GradingMetadataSchema = z.object({
  score: z.number().int().min(0).max(10000)
    .describe('Overall performance score in basis points (0-10000, e.g., 8525 = 85.25%)'),
  breakdown: GradingBreakdownSchema.optional()
    .describe('Optional detailed scoring breakdown'),
  feedback: z.string().optional()
    .describe('AI-generated feedback (optional)'),
  model: z.string().optional()
    .describe('AI model used for grading (e.g., "gpt-4", "whisper-large-v3")'),
  gradedBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('PKP address that performed grading (for verification)'),
  gradedAt: z.string().datetime()
    .describe('Grading timestamp'),
  gradeUri: z.string().startsWith('lens://').optional()
    .describe('Optional URI for detailed grading report (JSON)'),
}).describe('AI grading metadata');

export type GradingMetadata = z.infer<typeof GradingMetadataSchema>;

/**
 * Performance Metadata
 *
 * Complete performance information stored in Grove
 *
 * REPLACES: PerformanceRegistryV1.Performance struct
 */
export const PerformanceMetadataSchema = z.object({
  version: z.literal('1.0.0').describe('Metadata schema version'),

  // Identifiers
  performanceId: z.union([z.number().int().positive(), z.string()])
    .describe('Unique performance ID (uint256 or UUID)'),
  segmentHash: z.string().min(1)
    .describe('Segment hash (links to segment metadata)'),

  // Performer
  performer: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Performer wallet address'),
  performerAccount: z.string().startsWith('lens://').optional()
    .describe('Lens Account URI of performer (optional)'),

  // Media assets
  videoUri: z.string().startsWith('lens://')
    .describe('Performance video URI (Grove storage)'),
  audioUri: z.string().startsWith('lens://').optional()
    .describe('Performance audio URI (optional, extracted from video)'),
  thumbnailUri: z.string().optional()
    .describe('Video thumbnail URI (optional)'),

  // Grading (optional - not all performances are graded)
  grading: GradingMetadataSchema.optional()
    .describe('AI grading metadata (optional, only if graded)'),

  // Segment reference (for context)
  segmentUri: z.string().startsWith('lens://').optional()
    .describe('Segment metadata URI (optional)'),
  songUri: z.string().startsWith('lens://').optional()
    .describe('Song metadata URI (optional)'),

  // Status flags
  graded: z.boolean().default(false)
    .describe('Whether performance has been graded'),
  featured: z.boolean().default(false).optional()
    .describe('Whether performance is featured (optional)'),
  enabled: z.boolean().default(true)
    .describe('Whether performance is enabled (soft delete flag)'),

  // Social metadata (optional)
  likes: z.number().int().nonnegative().default(0).optional()
    .describe('Number of likes (optional, for social features)'),
  views: z.number().int().nonnegative().default(0).optional()
    .describe('Number of views (optional, for analytics)'),

  // Metadata timestamps
  createdAt: z.string().datetime()
    .describe('Performance submission timestamp'),
  updatedAt: z.string().datetime()
    .describe('Last metadata update timestamp'),
}).describe('Complete performance metadata stored in Grove');

export type PerformanceMetadata = z.infer<typeof PerformanceMetadataSchema>;

/**
 * Leaderboard Entry (derived from performance)
 *
 * Used for leaderboard queries via The Graph
 */
export const LeaderboardEntrySchema = z.object({
  performanceId: z.union([z.number().int().positive(), z.string()])
    .describe('Performance ID'),
  segmentHash: z.string().min(1)
    .describe('Segment hash'),
  performer: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Performer address'),
  performerAccount: z.string().startsWith('lens://').optional()
    .describe('Performer Lens account'),
  score: z.number().int().min(0).max(10000)
    .describe('Performance score (basis points)'),
  performanceUri: z.string().startsWith('lens://')
    .describe('Performance metadata URI'),
  timestamp: z.string().datetime()
    .describe('Performance timestamp'),
}).describe('Leaderboard entry for a performance');

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/**
 * Validation helpers
 */
export function validatePerformanceMetadata(data: unknown): PerformanceMetadata {
  return PerformanceMetadataSchema.parse(data);
}

export function validateGradingMetadata(data: unknown): GradingMetadata {
  return GradingMetadataSchema.parse(data);
}

export function validateLeaderboardEntry(data: unknown): LeaderboardEntry {
  return LeaderboardEntrySchema.parse(data);
}

/**
 * Helper: Create initial performance metadata (before grading)
 */
export function createPerformanceMetadata(params: {
  performanceId: number | string;
  segmentHash: string;
  performer: string;
  videoUri: string;
  audioUri?: string;
  segmentUri?: string;
  songUri?: string;
  performerAccount?: string;
}): PerformanceMetadata {
  const now = new Date().toISOString();

  return {
    version: '1.0.0',
    performanceId: params.performanceId,
    segmentHash: params.segmentHash,
    performer: params.performer,
    performerAccount: params.performerAccount,
    videoUri: params.videoUri,
    audioUri: params.audioUri,
    segmentUri: params.segmentUri,
    songUri: params.songUri,
    graded: false,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Helper: Add grading to performance
 */
export function addGrading(
  performance: PerformanceMetadata,
  grading: GradingMetadata
): PerformanceMetadata {
  if (performance.graded) {
    throw new Error('Performance already graded');
  }

  return {
    ...performance,
    grading,
    graded: true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper: Convert performance to leaderboard entry
 */
export function toLeaderboardEntry(
  performance: PerformanceMetadata,
  performanceUri: string
): LeaderboardEntry | null {
  // Only graded performances can be on leaderboard
  if (!performance.graded || !performance.grading) {
    return null;
  }

  return {
    performanceId: performance.performanceId,
    segmentHash: performance.segmentHash,
    performer: performance.performer,
    performerAccount: performance.performerAccount,
    score: performance.grading.score,
    performanceUri,
    timestamp: performance.createdAt,
  };
}

/**
 * Helper: Check if performance is gradeable
 */
export function isGradeable(performance: PerformanceMetadata): boolean {
  return (
    !performance.graded &&
    performance.enabled &&
    !!performance.videoUri
  );
}

/**
 * Helper: Get performance score (returns undefined if not graded)
 */
export function getScore(performance: PerformanceMetadata): number | undefined {
  return performance.grading?.score;
}
