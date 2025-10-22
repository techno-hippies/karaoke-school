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
