/**
 * Leaderboard types - shared across hooks and components
 */

/**
 * Display entry for leaderboard UI component
 */
export interface LeaderboardDisplayEntry {
  rank: number
  username: string
  score: number
  avatarUrl?: string
  isCurrentUser?: boolean
  /** Lens handle for profile linking (e.g., "scarlett-ks") */
  handle?: string
}

/**
 * Raw leaderboard entry from song leaderboard query
 * Contains detailed performance metrics
 */
export interface SongLeaderboardEntry {
  rank: number
  address: string
  username: string
  totalPoints: number
  karaokeAvg: number
  exerciseCount: number
  currentStreak: number
  bestScore: number
}

/**
 * Raw leaderboard entry from artist leaderboard query
 * Simplified metrics for artist-wide rankings
 */
export interface ArtistLeaderboardEntry {
  rank: number
  address: string
  username: string
  totalPoints: number
  currentStreak: number
}

/**
 * Transform a song leaderboard entry to display format
 */
export function toDisplayEntry(
  entry: SongLeaderboardEntry | ArtistLeaderboardEntry,
  currentUserAddress?: string
): LeaderboardDisplayEntry {
  return {
    rank: entry.rank,
    username: entry.username,
    score: entry.totalPoints,
    isCurrentUser: currentUserAddress
      ? entry.address.toLowerCase() === currentUserAddress.toLowerCase()
      : false,
  }
}
