/**
 * Chat type definitions
 *
 * Memory model:
 * - UserProfile: stable user facts (name, language, level, survey responses)
 * - Thread: conversation metadata + rolling summary (one per scenario)
 * - Message: individual messages (keep last N per thread)
 */

// ============================================================
// Core Entities
// ============================================================

export interface UserProfile {
  id: 'singleton'
  name?: string
  /** Preferred UI/response language */
  language?: 'en' | 'zh' | 'vi' | 'id'
  /** English proficiency level */
  level?: 'beginner' | 'intermediate' | 'advanced'
  /** Timezone for scheduling */
  timezone?: string
  /** Learning preferences (populated by surveys) */
  learning?: LearningPreferences
  /** Track which surveys completed per personality */
  completedSurveys?: Record<string, string[]>
  /** Additional preferences */
  preferences?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface LearningPreferences {
  // Scarlett surveys
  favoriteArtists?: string[]
  goals?: string[]
  // Violet surveys
  favoriteAnime?: string[]
  favoriteGames?: string[]
  musicProductionInterest?: 'yes-daw' | 'curious' | 'listener'
  // General
  interests?: string[]
  difficultWords?: string[]
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
  /** Optional metadata */
  metadata?: MessageMetadata
  createdAt: number
}

export interface MessageMetadata {
  /** Is this a survey question/answer */
  isSurvey?: boolean
  /** Survey ID for this message */
  surveyId?: string
  /** Selected option ID (for user answers) */
  optionId?: string
  /** Is this the welcome message */
  isWelcome?: boolean
}

// ============================================================
// View History (for psychographic profiling)
// ============================================================

export interface ViewHistoryEntry {
  id: string
  /** Spotify track ID or clip ID */
  contentId: string
  contentType: 'clip' | 'song' | 'post'
  /** How long they watched (ms) */
  watchDurationMs: number
  /** Total content length (ms) */
  totalDurationMs?: number
  /** Song metadata */
  songTitle?: string
  artistName?: string
  /** Tags from Lens post metadata */
  visualTags?: string[]
  lyricTags?: string[]
  /** Completed if watched >80% */
  completed: boolean
  viewedAt: number
}

// ============================================================
// AI Personalities
// ============================================================

export interface AIPersonality {
  id: PersonalityId
  name: string
  avatarUrl: string
  description: string
}

export const AI_PERSONALITIES: readonly AIPersonality[] = [
  {
    id: 'scarlett',
    name: 'Scarlett',
    avatarUrl: '/images/scarlett/default.webp',
    description: '18F digital nomad who loves yoga',
  },
  {
    id: 'violet',
    name: 'Violet',
    avatarUrl: '/images/violet/default.webp',
    description: '21F Tokyo DJ, edgy but caring',
  },
] as const

export type PersonalityId = 'scarlett' | 'violet'

// ============================================================
// Scenarios
// ============================================================

export interface Scenario {
  id: string
  personalityId: PersonalityId
  titleKey: string
  descriptionKey: string
  image: string
  isAdult?: boolean
  /** Roleplays are ephemeral (not persisted), default chats persist to IDB */
  isRoleplay?: boolean
}

export const SCENARIOS: readonly Scenario[] = [
  // Scarlett
  {
    id: 'scarlett-chat',
    personalityId: 'scarlett',
    titleKey: 'personalities.scarlett.scenarios.chat.title',
    descriptionKey: 'personalities.scarlett.scenarios.chat.description',
    image: '/images/scarlett/default.webp',
    isRoleplay: false,
  },
  {
    id: 'scarlett-surfing',
    personalityId: 'scarlett',
    titleKey: 'personalities.scarlett.scenarios.surfing.title',
    descriptionKey: 'personalities.scarlett.scenarios.surfing.description',
    image: '/images/scarlett/beach.webp',
    isRoleplay: true,
  },
  {
    id: 'scarlett-cafe',
    personalityId: 'scarlett',
    titleKey: 'personalities.scarlett.scenarios.cafe.title',
    descriptionKey: 'personalities.scarlett.scenarios.cafe.description',
    image: '/images/scarlett/cafe.webp',
    isRoleplay: true,
  },
  // Violet
  {
    id: 'violet-chat',
    personalityId: 'violet',
    titleKey: 'personalities.violet.scenarios.chat.title',
    descriptionKey: 'personalities.violet.scenarios.chat.description',
    image: '/images/violet/default.webp',
    isRoleplay: false,
  },
  {
    id: 'violet-nightclub',
    personalityId: 'violet',
    titleKey: 'personalities.violet.scenarios.nightclub.title',
    descriptionKey: 'personalities.violet.scenarios.nightclub.description',
    image: '/images/violet/nightclub.webp',
    isAdult: true,
    isRoleplay: true,
  },
  {
    id: 'violet-ramen',
    personalityId: 'violet',
    titleKey: 'personalities.violet.scenarios.ramen.title',
    descriptionKey: 'personalities.violet.scenarios.ramen.description',
    image: '/images/violet/ramen.webp',
    isRoleplay: true,
  },
] as const

// ============================================================
// User Context (passed to Lit Action for personalization)
// ============================================================

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
  // FSRS study data
  studiedToday: boolean
  cardsStudiedToday: number
  newCardsRemaining: number
  totalCardsLearning: number
  totalCardsReview: number
  // Recent activity
  recentSongsPracticed?: string[]
  lastSessionScore?: number
  totalSessions?: number
  averageScore?: number
}

// ============================================================
// Chat Service Types
// ============================================================

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TTSWord {
  id: number
  start: number // seconds
  end: number // seconds
  text: string
}

export interface ChatRequest {
  personalityId: PersonalityId
  message?: string
  audioBase64?: string
  conversationHistory?: ChatMessage[]
  returnAudio?: boolean
  userContext?: UserContext | null
  scenarioId?: string
}

export interface ChatResponse {
  success: boolean
  reply: string
  replyAudio?: string
  replyWords?: TTSWord[]
  transcript?: string
  error?: string
}

export interface TranslateRequest {
  text: string
  targetLanguage?: 'zh' | 'vi' | 'id'
}

export interface TranslateResponse {
  success: boolean
  original: string
  translation: string
  error?: string
}

export interface TTSRequest {
  text: string
  voice?: string
}

export interface TTSResponse {
  success: boolean
  audio?: string
  words?: TTSWord[]
  error?: string
}

// ============================================================
// Survey Types
// ============================================================

export interface SurveyOption {
  id: string
  labelKey: string
}

export interface Survey {
  id: string
  questionKey: string
  options: SurveyOption[]
  /** Allow multiple selections */
  multiSelect?: boolean
  /** Profile field to update */
  profileField: keyof LearningPreferences
}

// ============================================================
// UI Types
// ============================================================

export interface ChatWord {
  text: string
  isHighlighted?: boolean
}

export type MessageContent = string | ChatWord[]
