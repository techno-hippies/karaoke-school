/**
 * Chat storage types
 *
 * Memory model:
 * - UserProfile: stable facts (name, language, level)
 * - Thread: conversation metadata + rolling summary
 * - Message: individual messages (we keep last N per thread)
 */

export interface UserProfile {
  id: 'singleton'
  name?: string
  /** Preferred UI/response language */
  language?: 'en' | 'zh' | 'vi' | 'id'
  /** English proficiency level */
  level?: 'beginner' | 'intermediate' | 'advanced'
  /** Timezone for scheduling */
  timezone?: string
  /** Learning preferences and state (populated by surveys) */
  learning?: {
    // From Scarlett's surveys
    /** Favorite artists/songs */
    favoriteArtists?: string[]
    /** Current learning goals: 'pronunciation', 'vocabulary', 'confidence', 'fun' */
    goals?: string[]

    // From Violet's surveys
    /** Favorite anime */
    favoriteAnime?: string[]
    /** Favorite games */
    favoriteGames?: string[]
    /** Music production interest: 'yes-daw', 'curious', 'listener' */
    musicProductionInterest?: string

    // General
    /** Topics of interest */
    interests?: string[]
    /** Vocabulary words they've struggled with */
    difficultWords?: string[]
  }
  /** Track which surveys completed per personality */
  completedSurveys?: {
    [personalityId: string]: string[] // e.g., { scarlett: ['favoriteMusician', 'englishLevel'] }
  }
  /** Any other preferences */
  preferences?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

/**
 * Context passed to Lit Action for personalized responses
 */
export interface UserContext {
  // Profile data
  name?: string
  language?: string
  level?: string
  favoriteArtists?: string[]
  favoriteAnime?: string[]
  favoriteGames?: string[]
  goals?: string[]
  musicProductionInterest?: string

  // FSRS study data (from useStudyCards)
  studiedToday: boolean
  cardsStudiedToday: number
  newCardsRemaining: number
  totalCardsLearning: number
  totalCardsReview: number

  // Recent activity (from subgraph)
  recentSongsPracticed?: string[] // Last 3 song titles
  lastSessionScore?: number // 0-100
  totalSessions?: number
  averageScore?: number
}

export interface Thread {
  id: string
  /** AI tutor this thread is with */
  tutorId: string
  /** Display name shown in chat list */
  tutorName: string
  /** Tutor avatar URL */
  tutorAvatarUrl?: string
  /** Rolling summary of the conversation (LLM-generated) */
  summary?: string
  /** Message count (for knowing when to regenerate summary) */
  messageCount: number
  /** Last message index that was included in summary */
  lastSummarizedIdx: number
  /** Preview text for chat list */
  lastMessagePreview?: string
  /** Unread count */
  unreadCount: number
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  threadId: string
  /** Sequential index within thread */
  idx: number
  role: 'user' | 'assistant' | 'system'
  content: string
  /** Optional metadata (e.g., survey responses, tool calls) */
  metadata?: Record<string, unknown>
  createdAt: number
}

/**
 * View history entry for engagement tracking
 * Used to build psychographic profile for AI chat context
 */
export interface ViewHistoryEntry {
  id: string
  /** Spotify track ID or clip ID */
  contentId: string
  contentType: 'clip' | 'song' | 'post'
  /** How long they watched (ms) */
  watchDurationMs: number
  /** Total content length (ms) */
  totalDurationMs?: number
  /** Song metadata for context */
  songTitle?: string
  artistName?: string
  /** Tags from Lens post metadata */
  visualTags?: string[]
  lyricTags?: string[]
  /** Did they complete it? (watched >80%) */
  completed: boolean
  /** Timestamp */
  viewedAt: number
}

/** AI personalities available to chat with */
export const AI_PERSONALITIES = [
  {
    id: 'scarlett',
    name: 'Scarlett',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    description: '18F digital nomad who loves yoga',
  },
  {
    id: 'violet',
    name: 'Violet',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=violet',
    description: '21F Tokyo DJ, edgy but caring',
  },
] as const

export type PersonalityId = typeof AI_PERSONALITIES[number]['id']
