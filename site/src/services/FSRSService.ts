/**
 * FSRS Service - Spaced Repetition Scheduling
 * Integrates ts-fsrs algorithm with TinyBase storage
 */

import { fsrs, generatorParameters, Rating, createEmptyCard, type Card } from 'ts-fsrs'
import { store, toStoredDifficulty, fromStoredDifficulty, toStoredStability, fromStoredStability, cardExists, getCard, type ExerciseCard } from './database/tinybase'
import type { EmbeddedKaraokeSegment } from '../types/feed'

class FSRSService {
  private fsrs = fsrs(generatorParameters({
    enable_fuzz: true,         // Add natural variation to intervals
    request_retention: 0.9,    // Target 90% retention
    maximum_interval: 36500,   // ~100 years max
    enable_short_term: true    // Better learning phase handling
  }))

  /**
   * Create FSRS cards from a liked video with embedded karaoke segment
   */
  createCardsFromLike(
    postId: string,
    karaokeSegment: EmbeddedKaraokeSegment
  ): number {
    const now = Date.now()
    let cardsCreated = 0

    // Filter out structural markers like [Verse], (Chorus), etc.
    const validLines = karaokeSegment.lines.filter(line =>
      !this.isStructuralMarker(line.originalText)
    )

    console.log(`[FSRSService] Creating cards for post ${postId}, ${validLines.length} valid lines`)

    for (const line of validLines) {
      const cardId = `${postId}_line_${line.lineIndex}`

      // Skip if card already exists (re-like scenario)
      if (cardExists(cardId)) {
        console.log(`[FSRSService] Card already exists: ${cardId}`)
        continue
      }

      // Create initial FSRS card state
      const fsrsCard = createEmptyCard()

      const cardData: ExerciseCard = {
        card_id: cardId,
        post_id: postId,
        line_index: line.lineIndex,

        // Exercise type
        exercise_type: 'sayitback',

        // Content
        fragment: line.originalText,
        translation: line.translatedText,

        // Metadata
        song_id: karaokeSegment.songId,
        song_title: karaokeSegment.songTitle,
        artist: karaokeSegment.artist || 'Unknown Artist',

        // Initial FSRS state
        difficulty: toStoredDifficulty(fsrsCard.difficulty),
        stability: toStoredStability(fsrsCard.stability),
        state: 0,              // NEW
        reps: 0,
        lapses: 0,
        due_date: now,         // NEW cards immediately available
        last_review: 0,        // Never reviewed

        // Timestamps
        created_at: now,
        liked_at: now
      }

      store.setRow('exercise_cards', cardId, cardData)
      cardsCreated++
    }

    console.log(`[FSRSService] Created ${cardsCreated} new cards from post ${postId}`)
    return cardsCreated
  }

  /**
   * Review a card and update its FSRS state
   */
  reviewCard(cardId: string, wasCorrect: boolean): void {
    const card = getCard(cardId)
    if (!card) {
      throw new Error(`[FSRSService] Card not found: ${cardId}`)
    }

    const now = Date.now()

    // Convert to FSRS format
    const fsrsCard: Card = {
      due: new Date(card.due_date),
      stability: fromStoredStability(card.stability),
      difficulty: fromStoredDifficulty(card.difficulty),
      elapsed_days: card.last_review ? Math.floor((now - card.last_review) / (1000 * 60 * 60 * 24)) : 0,
      scheduled_days: 0,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      last_review: card.last_review ? new Date(card.last_review) : undefined
    }

    // Apply FSRS scheduling algorithm
    const rating = wasCorrect ? Rating.Good : Rating.Again
    const scheduling = this.fsrs.repeat(fsrsCard, new Date(now))
    const updatedCard = scheduling[rating].card

    // Update card in TinyBase
    const updatedData: ExerciseCard = {
      ...card,
      difficulty: toStoredDifficulty(updatedCard.difficulty),
      stability: toStoredStability(updatedCard.stability),
      state: updatedCard.state,
      reps: updatedCard.reps,
      lapses: updatedCard.lapses,
      due_date: updatedCard.due.getTime(),
      last_review: now
    }

    store.setRow('exercise_cards', cardId, updatedData)

    const dueInMinutes = Math.round((updatedCard.due.getTime() - now) / 60000)
    console.log(`[FSRSService] Card reviewed: ${cardId}`, {
      correct: wasCorrect,
      newState: this.getStateName(updatedCard.state),
      dueIn: dueInMinutes > 0 ? `${dueInMinutes}min` : 'now'
    })
  }

  /**
   * Delete a card
   */
  deleteCard(cardId: string): void {
    store.delRow('exercise_cards', cardId)
    console.log(`[FSRSService] Deleted card: ${cardId}`)
  }

  /**
   * Check if text is a structural marker like [Verse], (Chorus)
   */
  private isStructuralMarker(text: string): boolean {
    if (!text) return true
    return /^\s*[\(\[].*[\)\]]\s*$/.test(text) || text.trim().length === 0
  }

  /**
   * Get human-readable state name
   */
  private getStateName(state: number): string {
    const stateNames = ['NEW', 'LEARNING', 'REVIEW', 'RELEARNING']
    return stateNames[state] || 'UNKNOWN'
  }
}

// Singleton instance
export const fsrsService = new FSRSService()