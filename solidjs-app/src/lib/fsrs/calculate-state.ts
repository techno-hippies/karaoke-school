/**
 * FSRS (Free Spaced Repetition Scheduler) state calculation
 * Based on performance history from chain events
 */

import { Rating } from '@/types/study'

export interface FSRSState {
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: 0 | 1 | 2 | 3 // New, Learning, Review, Relearning
  lastReview: number | null
}

export interface PerformanceRecord {
  gradedAt: string | number
  score?: number
}

/**
 * Calculate FSRS state from performance history
 * @param performanceHistory - Array of performance records, most recent first
 */
export function calculateFSRSState(performanceHistory: PerformanceRecord[]): FSRSState {
  // If no history, card is New and due immediately
  if (!performanceHistory || performanceHistory.length === 0) {
    return {
      due: Math.floor(Date.now() / 1000), // Due immediately
      stability: 0,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 0 as const, // New
      lastReview: null,
    }
  }

  // Last performance determines next review time
  const lastPerformance = performanceHistory[0]
  const lastReviewTime = typeof lastPerformance.gradedAt === 'string'
    ? parseInt(lastPerformance.gradedAt)
    : lastPerformance.gradedAt
  const score = Math.round((lastPerformance.score || 0) / 25) // 0-100 → 0-4
  const rating = Math.min(3, Math.max(0, score))

  // Simple interval scheduling based on rating and reps
  let dayInterval = 1
  if (rating >= Rating.Good) {
    // Good or Easy ratings increase interval exponentially
    dayInterval = Math.min(
      36500, // Max interval
      Math.pow(2, performanceHistory.length) // Exponential backoff
    )
  }

  const nextDueTime = lastReviewTime + (dayInterval * 86400)

  return {
    due: nextDueTime,
    stability: dayInterval,
    difficulty: 5 + (3 - rating), // Adjust based on rating
    elapsedDays: Math.floor((Date.now() / 1000 - lastReviewTime) / 86400),
    scheduledDays: dayInterval,
    reps: performanceHistory.length,
    lapses: rating === Rating.Again ? 1 : 0,
    state: (performanceHistory.length === 1 ? 1 : 2) as 0 | 1 | 2 | 3, // Learning if 1 rep, Review otherwise
    lastReview: lastReviewTime,
  }
}

/**
 * Get today's start timestamp (midnight local time)
 */
export function getTodayStartTimestamp(): number {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor(todayStart.getTime() / 1000) // Unix timestamp
}

/**
 * Generate deterministic lineId using Web Crypto API
 * Used to create stable identifiers for FSRS tracking
 */
export async function generateLineId(spotifyTrackId: string, lineIndex: number): Promise<string> {
  const input = `${spotifyTrackId}-${lineIndex}`
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return '0x' + hashHex
}
