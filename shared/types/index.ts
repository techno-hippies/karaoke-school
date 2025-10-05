/**
 * Shared types for Karaoke School contracts
 * Ensures data model parity between contracts, frontend, and song-uploader
 */

// ============================================================================
// Core Enums
// ============================================================================

/**
 * Content Source Enumeration
 * MUST match contract enum values exactly
 */
export const ContentSource = {
  Native: 0,    // Songs from SongCatalog (audio + word-level timestamps)
  Genius: 1,    // Songs from Genius.com API (lyrics only, no audio)
} as const;

export type ContentSource = typeof ContentSource[keyof typeof ContentSource];

/**
 * Time Window for Trending
 * MUST match TrendingTracker contract
 */
export const TimeWindow = {
  Hourly: 0,
  Daily: 1,
  Weekly: 2,
} as const;

export type TimeWindow = typeof TimeWindow[keyof typeof TimeWindow];

// ============================================================================
// SongCatalog Types
// ============================================================================

/**
 * Song structure from SongCatalog contract
 * Matches contract Song struct exactly
 */
export interface CatalogSong {
  id: string;                   // Primary: human-readable slug
  geniusId: number;            // Optional: Genius API song ID (0 = not linked)
  geniusArtistId: number;      // Optional: Genius API artist ID (0 = not linked)
  title: string;
  artist: string;               // Display name
  duration: number;             // seconds

  // Grove URIs (all start with "lens://")
  audioUri: string;             // Full song audio
  metadataUri: string;          // Word + line timestamps
  coverUri: string;             // High-res cover
  thumbnailUri: string;         // 300x300 thumbnail
  musicVideoUri: string;        // Music video (optional, can be empty)

  // Segments
  segmentIds: string;           // Comma-separated (e.g., "verse-1,chorus-1")

  // Metadata
  languages: string;            // Comma-separated codes (e.g., "en,cn,vi")
  enabled: boolean;
  addedAt: bigint;              // Unix timestamp
}

// ============================================================================
// ArtistQuizTracker Types
// ============================================================================

/**
 * Encrypted quiz question
 */
export interface EncryptedQuestion {
  ciphertext: string;           // Lit-encrypted question JSON
  dataToEncryptHash: string;    // Verification hash
  referentHash: string;         // bytes32: keccak256(source, referentId)
  addedAt: bigint;              // uint64
  exists: boolean;
  enabled: boolean;             // Question is active (for soft delete)
}

/**
 * User progress for a song
 * @dev Tracks per-song (not per-artist) for fairness
 */
export interface SongProgress {
  questionsCompleted: number;   // uint32: for THIS song
  questionsCorrect: number;     // uint32: for THIS song
  currentStreak: number;        // uint32: consecutive days for THIS song
  longestStreak: number;        // uint32: personal record for THIS song
  lastQuizTimestamp: bigint;    // uint64
  nextQuestionIndex: number;    // uint32: 0-based (sequential unlock)
}

/**
 * Leaderboard entry (per song)
 */
export interface QuizLeaderboardEntry {
  user: string;                 // Address
  streak: number;               // uint32: current streak for song
  questionsCorrect: number;     // uint32: total correct for song
  lastActive: bigint;           // uint64
}

/**
 * Artist fan aggregate (computed off-chain or via The Graph)
 * @dev Not stored on-chain, aggregated from multiple songs
 */
export interface ArtistFanAggregate {
  artistId: number;             // geniusArtistId
  user: string;                 // Address
  totalStreak: bigint;          // Sum of streaks across all songs
  totalCorrect: bigint;         // Sum of correct across all songs
  songsCompleted: bigint;       // Count of songs with progress
  lastActive: bigint;           // Most recent quiz timestamp
  accuracy: number;             // totalCorrect / totalCompleted (percentage)
}

// ============================================================================
// StudyTracker Types
// ============================================================================

/**
 * Study session record
 */
export interface StudySession {
  contentHash: string;          // bytes32
  timestamp: bigint;            // uint64
  itemsReviewed: number;        // uint16
  averageScore: number;         // uint8 (0-100)
}

/**
 * User study statistics (public)
 */
export interface StudyStats {
  totalSessions: number;        // uint32
  currentStreak: number;        // uint32
  longestStreak: number;        // uint32
  lastStudyTimestamp: bigint;   // uint64
  firstStudyTimestamp: bigint;  // uint64
}

/**
 * Encrypted FSRS state
 */
export interface EncryptedFSRS {
  ciphertext: string;           // Lit-encrypted JSON
  dataToEncryptHash: string;    // Verification hash
  lastUpdated: bigint;          // uint64
}

/**
 * Decrypted FSRS state (client-side only, never on-chain)
 */
export interface FSRSState {
  difficulty: number;           // FSRS difficulty rating
  stability: number;            // Memory stability
  retrievability: number;       // Current recall probability
  interval: number;             // Days until next review
  lastReview: Date;             // Last review timestamp
  reps: number;                 // Total repetitions
  lapses: number;               // Number of lapses
}

// ============================================================================
// TrendingTracker Types
// ============================================================================

/**
 * Trending entry structure
 */
export interface TrendingEntry {
  songHash: string;             // bytes32
  clicks: number;               // uint32
  plays: number;                // uint32
  completions: number;          // uint32
  trendingScore: number;        // uint32 (weighted)
  lastUpdated: bigint;          // uint64
}

/**
 * Trending song (with decoded info)
 */
export interface TrendingSong {
  source: ContentSource;        // uint8
  songId: string;
  trendingScore: number;        // uint32
  clicks: number;               // uint32
  plays: number;                // uint32
  completions: number;          // uint32
  lastUpdated: bigint;          // uint64
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate content hash (matches contract keccak256)
 * @param source ContentSource enum value
 * @param id Content identifier
 */
export function getContentHash(source: ContentSource, id: string): string {
  // Note: This should use ethers.js or viem keccak256 in actual implementation
  // Placeholder for type checking
  return `0x${source}:${id}`;
}

/**
 * Convert ContentSource to path segment
 */
export function sourceToPath(source: ContentSource): string {
  return source === ContentSource.Native ? 'native' : 'genius';
}

/**
 * Parse ContentSource from path segment
 */
export function pathToSource(path: string): ContentSource {
  return path.toLowerCase() === 'genius' ? ContentSource.Genius : ContentSource.Native;
}

/**
 * Get day number from timestamp (UTC, matches contract)
 */
export function getDayNumber(timestamp: bigint | number): number {
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  return Math.floor(ts / (24 * 60 * 60));
}

/**
 * Check if two timestamps are on the same day (UTC)
 */
export function isSameDay(ts1: bigint | number, ts2: bigint | number): boolean {
  return getDayNumber(ts1) === getDayNumber(ts2);
}

/**
 * Format Grove URI
 */
export function isGroveUri(uri: string): boolean {
  return uri.startsWith('lens://');
}

/**
 * Resolve Grove URI to gateway URL
 */
export function resolveGroveUri(uri: string): string {
  if (!isGroveUri(uri)) return uri;
  const hash = uri.replace('lens://', '');
  return `https://gw.lens.xyz/grove/${hash}`;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a song has a Genius ID
 */
export function hasGeniusId(song: CatalogSong): boolean {
  return song.geniusId > 0;
}

/**
 * Check if a song has a Genius Artist ID
 */
export function hasGeniusArtistId(song: CatalogSong): boolean {
  return song.geniusArtistId > 0;
}

/**
 * Aggregate song progress into artist-level stats
 * @param songProgresses Array of SongProgress for all of artist's songs
 * @param user User address
 * @returns Aggregated artist fan stats
 */
export function aggregateArtistStats(
  songProgresses: SongProgress[],
  user: string
): Omit<ArtistFanAggregate, 'artistId'> {
  const totalStreak = songProgresses.reduce(
    (sum, p) => sum + BigInt(p.currentStreak),
    BigInt(0)
  );
  const totalCorrect = songProgresses.reduce(
    (sum, p) => sum + BigInt(p.questionsCorrect),
    BigInt(0)
  );
  const totalCompleted = songProgresses.reduce(
    (sum, p) => sum + BigInt(p.questionsCompleted),
    BigInt(0)
  );
  const songsCompleted = BigInt(songProgresses.filter(p => p.questionsCompleted > 0).length);
  const lastActive = songProgresses.reduce(
    (max, p) => p.lastQuizTimestamp > max ? p.lastQuizTimestamp : max,
    BigInt(0)
  );
  const accuracy = totalCompleted > BigInt(0)
    ? Number((totalCorrect * BigInt(100)) / totalCompleted)
    : 0;

  return {
    user,
    totalStreak,
    totalCorrect,
    songsCompleted,
    lastActive,
    accuracy
  };
}

/**
 * Check if user studied today
 */
export function studiedToday(stats: StudyStats): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return isSameDay(stats.lastStudyTimestamp, now);
}
