/**
 * Study progress types from FSRSTrackerV1 contract
 */

export const CardState = {
  New: 0,         // Never studied
  Learning: 1,    // Short-term repetition (< 1 day intervals)
  Review: 2,      // Long-term repetition (days/weeks/months)
  Relearning: 3   // Failed review, back to short intervals
} as const

export type CardState = typeof CardState[keyof typeof CardState]

export const Rating = {
  Again: 0,  // Complete failure, restart learning
  Hard: 1,   // Difficult but remembered
  Good: 2,   // Correct with effort
  Easy: 3    // Trivial, increase interval significantly
} as const

export type Rating = typeof Rating[keyof typeof Rating]

export interface Card {
  due: bigint              // Next review timestamp
  stability: number        // FSRS stability * 100
  difficulty: number       // FSRS difficulty * 10
  elapsedDays: number      // Days since last review * 10
  scheduledDays: number    // Days until next review * 10
  reps: number             // Total number of reviews
  lapses: number           // Times forgotten
  state: CardState
  lastReview: bigint       // Last review timestamp (0 = never)
}

export interface StudyStats {
  newCount: number         // Cards never studied
  learningCount: number    // Cards in learning/relearning
  dueCount: number         // Cards due for review
}

export interface SongStats {
  totalNew: number
  totalLearning: number
  totalDue: number
  segmentsWithDue: number
  segmentsCompleted: number
}

/**
 * FSRS Study Card (loaded from subgraph)
 */
export interface StudyCard {
  id: string
  questionId?: string
  lineId?: string
  lineIndex?: number
  segmentHash?: string
  spotifyTrackId?: string
  exerciseType?: 'SAY_IT_BACK' | 'TRANSLATION_MULTIPLE_CHOICE' | 'TRIVIA_MULTIPLE_CHOICE'

  // Song metadata
  title?: string
  artist?: string
  artworkUrl?: string

  // Content
  metadataUri: string
  instrumentalUri?: string
  alignmentUri?: string
  languageCode?: string
  distractorPoolSize?: number

  translations?: Array<{
    languageCode: string
    translationUri: string
  }>

  // Timing
  segmentStartMs?: number
  segmentEndMs?: number

  // FSRS state
  fsrs: {
    due: number // Unix timestamp (seconds)
    stability: number // Days
    difficulty: number // 1-10
    elapsedDays: number
    scheduledDays: number
    reps: number
    lapses: number
    state: 0 | 1 | 2 | 3 // CardState enum: New=0, Learning=1, Review=2, Relearning=3
    lastReview: number | null // Unix timestamp
  }
}

/**
 * Study cards result with stats
 */
export interface StudyCardsResult {
  cards: StudyCard[]
  stats: {
    total: number
    new: number
    learning: number
    review: number
    relearning: number
    newCardsIntroducedToday: number
    newCardsRemaining: number
    dueToday: number
  }
}
