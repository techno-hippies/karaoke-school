/**
 * Grove Metadata Schemas
 *
 * Unified schemas for Grove storage (replaces most V1 contracts)
 *
 * Architecture:
 * - Account: Unified user/artist accounts (replaces ArtistRegistry + StudentProfile)
 * - Song: Song metadata (replaces SongRegistryV1)
 * - Segment: Segment metadata (replaces SegmentRegistryV1)
 * - Performance: Performance metadata (replaces PerformanceRegistryV1)
 * - Leaderboard: Off-chain leaderboard data (replaces LeaderboardV1)
 *
 * Storage:
 * - Immutable: Song, Segment (write once)
 * - Mutable: Account (via ACL), Performance (grading updates)
 *
 * Access:
 * - Via Grove HTTP API: https://api.grove.storage/{hash}
 * - Via Lens GraphQL: Query accounts by username/address
 * - Via The Graph: Query indexed events for leaderboards
 */

// Account metadata (unified users + artists)
export * from './account.js';

// Song metadata
export * from './song.js';

// Segment metadata
export * from './segment.js';

// Performance metadata
export * from './performance.js';

// Leaderboard entries (off-chain)
export * from './leaderboard.js';

/**
 * Re-export commonly used types
 */
export type {
  AccountMetadata,
  AccountStats,
  Achievement,
  Verification,
} from './account.js';

export type {
  SongMetadata,
  MLCData,
  MLCPublisher,
  Lyrics,
  SyncedLyricLine,
} from './song.js';

export type {
  SegmentMetadata,
  TimeRange,
  MatchMetadata,
  ProcessingStatus,
} from './segment.js';

export type {
  PerformanceMetadata,
  GradingMetadata,
  GradingBreakdown,
  LeaderboardEntry as PerformanceLeaderboardEntry,
} from './performance.js';

export type {
  LeaderboardEntry,
  LeaderboardQueryResult,
  SegmentLeaderboard,
  SongLeaderboard,
  ArtistLeaderboard,
  GlobalLeaderboard,
} from './leaderboard.js';

export { LeaderboardType } from './leaderboard.js';
