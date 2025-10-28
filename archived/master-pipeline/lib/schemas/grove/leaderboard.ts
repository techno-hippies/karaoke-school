/**
 * Leaderboard Schemas (Off-Chain Indexing)
 *
 * REPLACES: LeaderboardV1 contract
 *
 * Leaderboards are computed off-chain via The Graph subgraph.
 * No on-chain storage - just events indexed and sorted.
 *
 * Event sources:
 * - PerformanceGraded events (from minimal PerformanceGrader contract)
 * - CardReviewed events (from FSRSTrackerV1 contract)
 *
 * Query: Via The Graph GraphQL API
 */

import { z } from 'zod';

/**
 * Leaderboard Types
 *
 * Different dimensions for ranking
 */
export enum LeaderboardType {
  SONG = 'song',           // Best performers for a song (all segments)
  SEGMENT = 'segment',     // Best performers for a specific segment
  ARTIST = 'artist',       // Best performers for an artist's songs
  GLOBAL = 'global',       // Global top performers
}

export const LeaderboardTypeSchema = z.nativeEnum(LeaderboardType);

/**
 * Leaderboard Entry
 *
 * Single entry in a leaderboard (from indexed events)
 */
export const LeaderboardEntrySchema = z.object({
  // Identifier
  id: z.string().min(1)
    .describe('Unique entry ID (e.g., "{type}-{identifier}-{performer}")'),

  // Context
  leaderboardType: LeaderboardTypeSchema
    .describe('Type of leaderboard'),
  identifier: z.string().min(1)
    .describe('Leaderboard identifier (songId, segmentHash, artistId, or "global")'),

  // Performer
  performer: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Performer wallet address'),
  performerAccount: z.string().startsWith('lens://').optional()
    .describe('Performer Lens Account URI (optional)'),

  // Score (basis points)
  bestScore: z.number().int().min(0).max(10000)
    .describe('Best score achieved (basis points, 0-10000)'),
  totalAttempts: z.number().int().positive()
    .describe('Total number of attempts'),
  averageScore: z.number().int().min(0).max(10000).optional()
    .describe('Average score across all attempts (optional)'),

  // Performance reference
  bestPerformanceUri: z.string().startsWith('lens://').optional()
    .describe('URI of best performance (optional)'),
  bestPerformanceId: z.union([z.number(), z.string()]).optional()
    .describe('ID of best performance (optional)'),

  // Timestamps
  lastUpdated: z.string().datetime()
    .describe('When entry was last updated'),
  firstAttempt: z.string().datetime().optional()
    .describe('When first attempt was made (optional)'),
}).describe('Single leaderboard entry');

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/**
 * Leaderboard Query Result
 *
 * Result of querying a leaderboard (sorted)
 */
export const LeaderboardQueryResultSchema = z.object({
  type: LeaderboardTypeSchema
    .describe('Leaderboard type'),
  identifier: z.string().min(1)
    .describe('Leaderboard identifier'),
  entries: z.array(LeaderboardEntrySchema)
    .describe('Leaderboard entries (sorted by score descending)'),
  totalEntries: z.number().int().nonnegative()
    .describe('Total number of entries'),
  updatedAt: z.string().datetime()
    .describe('When leaderboard was last updated'),
}).describe('Leaderboard query result');

export type LeaderboardQueryResult = z.infer<typeof LeaderboardQueryResultSchema>;

/**
 * Segment Leaderboard (most common)
 */
export const SegmentLeaderboardSchema = z.object({
  segmentHash: z.string().min(1)
    .describe('Segment hash'),
  segmentUri: z.string().startsWith('lens://').optional()
    .describe('Segment metadata URI (optional)'),
  entries: z.array(LeaderboardEntrySchema)
    .describe('Top performers (sorted by score)'),
  totalPerformances: z.number().int().nonnegative()
    .describe('Total number of performances for this segment'),
}).describe('Leaderboard for a specific segment');

export type SegmentLeaderboard = z.infer<typeof SegmentLeaderboardSchema>;

/**
 * Song Leaderboard (aggregated across all segments)
 */
export const SongLeaderboardSchema = z.object({
  geniusId: z.number().int().positive()
    .describe('Genius song ID'),
  songUri: z.string().startsWith('lens://').optional()
    .describe('Song metadata URI (optional)'),
  entries: z.array(LeaderboardEntrySchema)
    .describe('Top performers (aggregated across all segments)'),
  totalPerformances: z.number().int().nonnegative()
    .describe('Total number of performances across all segments'),
  segmentCount: z.number().int().nonnegative()
    .describe('Number of segments for this song'),
}).describe('Leaderboard for a song (all segments)');

export type SongLeaderboard = z.infer<typeof SongLeaderboardSchema>;

/**
 * Artist Leaderboard (aggregated across artist's songs)
 */
export const ArtistLeaderboardSchema = z.object({
  geniusArtistId: z.number().int().positive().optional()
    .describe('Genius artist ID (optional)'),
  artistAccount: z.string().startsWith('lens://').optional()
    .describe('Artist Lens Account URI (optional)'),
  entries: z.array(LeaderboardEntrySchema)
    .describe('Top performers (aggregated across artist\'s songs)'),
  totalPerformances: z.number().int().nonnegative()
    .describe('Total performances across all artist songs'),
  songCount: z.number().int().nonnegative()
    .describe('Number of songs by this artist'),
}).describe('Leaderboard for an artist (all songs)');

export type ArtistLeaderboard = z.infer<typeof ArtistLeaderboardSchema>;

/**
 * Global Leaderboard (top performers overall)
 */
export const GlobalLeaderboardSchema = z.object({
  entries: z.array(LeaderboardEntrySchema)
    .describe('Top performers globally'),
  totalPerformances: z.number().int().nonnegative()
    .describe('Total performances in system'),
  totalPerformers: z.number().int().nonnegative()
    .describe('Total unique performers'),
}).describe('Global leaderboard (all performances)');

export type GlobalLeaderboard = z.infer<typeof GlobalLeaderboardSchema>;

/**
 * Validation helpers
 */
export function validateLeaderboardEntry(data: unknown): LeaderboardEntry {
  return LeaderboardEntrySchema.parse(data);
}

export function validateLeaderboardQueryResult(data: unknown): LeaderboardQueryResult {
  return LeaderboardQueryResultSchema.parse(data);
}

export function validateSegmentLeaderboard(data: unknown): SegmentLeaderboard {
  return SegmentLeaderboardSchema.parse(data);
}

/**
 * Helper: Create leaderboard entry from performance data
 */
export function createLeaderboardEntry(params: {
  leaderboardType: LeaderboardType;
  identifier: string;
  performer: string;
  performerAccount?: string;
  score: number;
  performanceUri?: string;
  performanceId?: number | string;
}): LeaderboardEntry {
  const id = `${params.leaderboardType}-${params.identifier}-${params.performer}`;
  const now = new Date().toISOString();

  return {
    id,
    leaderboardType: params.leaderboardType,
    identifier: params.identifier,
    performer: params.performer,
    performerAccount: params.performerAccount,
    bestScore: params.score,
    totalAttempts: 1,
    bestPerformanceUri: params.performanceUri,
    bestPerformanceId: params.performanceId,
    lastUpdated: now,
    firstAttempt: now,
  };
}

/**
 * Helper: Update leaderboard entry with new performance
 */
export function updateLeaderboardEntry(
  entry: LeaderboardEntry,
  newScore: number,
  performanceUri?: string,
  performanceId?: number | string
): LeaderboardEntry {
  const isBetterScore = newScore > entry.bestScore;

  return {
    ...entry,
    bestScore: isBetterScore ? newScore : entry.bestScore,
    totalAttempts: entry.totalAttempts + 1,
    bestPerformanceUri: isBetterScore ? performanceUri : entry.bestPerformanceUri,
    bestPerformanceId: isBetterScore ? performanceId : entry.bestPerformanceId,
    averageScore: entry.averageScore
      ? Math.floor((entry.averageScore * entry.totalAttempts + newScore) / (entry.totalAttempts + 1))
      : newScore,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Helper: Sort leaderboard entries by score (descending)
 */
export function sortByScore(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.bestScore - a.bestScore);
}

/**
 * Helper: Get top N entries
 */
export function getTopN(entries: LeaderboardEntry[], n: number): LeaderboardEntry[] {
  return sortByScore(entries).slice(0, n);
}

/**
 * Helper: Get performer's rank (1-indexed, 0 = not found)
 */
export function getPerformerRank(
  entries: LeaderboardEntry[],
  performer: string
): number {
  const sorted = sortByScore(entries);
  const index = sorted.findIndex(e => e.performer === performer);
  return index === -1 ? 0 : index + 1;
}

/**
 * Helper: Create leaderboard query result
 */
export function createLeaderboardQueryResult(
  type: LeaderboardType,
  identifier: string,
  entries: LeaderboardEntry[],
  limit?: number
): LeaderboardQueryResult {
  const sorted = sortByScore(entries);
  const limitedEntries = limit ? sorted.slice(0, limit) : sorted;

  return {
    type,
    identifier,
    entries: limitedEntries,
    totalEntries: entries.length,
    updatedAt: new Date().toISOString(),
  };
}
