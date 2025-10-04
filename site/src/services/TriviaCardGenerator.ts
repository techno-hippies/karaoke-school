/**
 * Trivia Card Generator Service
 * Generates FSRS trivia cards from Genius song referents
 */

import { store, toStoredDifficulty, toStoredStability, cardExists, type ExerciseCard } from './database/tinybase'
import { createEmptyCard } from 'ts-fsrs'
import { LIT_ACTIONS } from '../config/lit-actions'
import { openrouterKeyData } from './lit/config'
import { getLitSearchService } from './LitSearchService'
import type { WalletClient } from 'wagmi'

export interface GeniusReferent {
  id: number
  fragment: string
  annotation?: string
}

export interface TriviaQuestion {
  referentId: number
  fragment: string
  questionType: 'trivia'
  question: string
  choices: {
    A: string
    B: string
    C: string
    D: string
  }
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

export class TriviaCardGenerator {
  /**
   * Fetch referents for a Genius song using LitSearchService
   */
  private async fetchReferents(geniusSongId: number, walletClient: WalletClient): Promise<GeniusReferent[]> {
    const litSearch = getLitSearchService()

    try {
      const response = await litSearch.getReferents(geniusSongId.toString(), walletClient)

      if (!response.success) {
        throw new Error(`Failed to fetch referents: ${response.error}`)
      }

      console.log(`[TriviaCardGenerator] Fetched ${response.referents.length} referents for song ${geniusSongId}`)
      return response.referents as GeniusReferent[]
    } catch (error) {
      console.error('[TriviaCardGenerator] Failed to fetch referents:', error)
      throw error
    }
  }

  /**
   * Generate trivia questions from referents using LitSearchService's client
   */
  private async generateTrivia(
    geniusSongId: number,
    referents: GeniusReferent[],
    walletClient: WalletClient,
    language: string = 'en'
  ): Promise<TriviaQuestion[]> {
    const litSearch = getLitSearchService()
    // Ensure LitSearchService is initialized
    await litSearch['init']()
    const litClient = litSearch['litClient']
    const authContext = await litSearch['createAuthContext'](walletClient)

    const triviaAction = LIT_ACTIONS.study.triviaGenerator

    try {
      const result = await litClient.executeJs({
        ipfsId: triviaAction.cid,
        authContext: authContext,
        jsParams: {
          songId: geniusSongId,
          referents: referents,
          language: language,
          userAddress: 'anonymous',
          sessionId: crypto.randomUUID(),
          userIpCountry: 'XX',
          userAgent: navigator.userAgent,
          // Encrypted OpenRouter key
          openrouterCiphertext: openrouterKeyData.ciphertext,
          openrouterDataToEncryptHash: openrouterKeyData.dataToEncryptHash,
          accessControlConditions: openrouterKeyData.accessControlConditions
        }
      })

      const response = JSON.parse(result.response as string)

      if (!response.success) {
        throw new Error(`Failed to generate trivia: ${response.error}`)
      }

      console.log(`[TriviaCardGenerator] Generated ${response.questions.length} trivia questions`)
      return response.questions
    } catch (error) {
      console.error('[TriviaCardGenerator] Failed to generate trivia:', error)
      throw error
    }
  }

  /**
   * Create FSRS trivia cards from a Genius song
   */
  async createTriviaCards(
    geniusSongId: number,
    songTitle: string,
    artist: string,
    walletClient: WalletClient,
    language: string = 'en'
  ): Promise<number> {
    const now = Date.now()
    let cardsCreated = 0

    try {
      // Fetch referents
      console.log(`[TriviaCardGenerator] Fetching referents for Genius song ${geniusSongId}`)
      const referents = await this.fetchReferents(geniusSongId, walletClient)

      if (referents.length === 0) {
        console.warn('[TriviaCardGenerator] No referents found')
        return 0
      }

      // Generate trivia questions
      console.log('[TriviaCardGenerator] Generating trivia questions')
      const triviaQuestions = await this.generateTrivia(geniusSongId, referents, walletClient, language)

      if (triviaQuestions.length === 0) {
        console.warn('[TriviaCardGenerator] No trivia questions generated')
        return 0
      }

      // Convert to FSRS cards
      for (const question of triviaQuestions) {
        const cardId = `genius_${geniusSongId}_trivia_${question.referentId}`

        // Skip if card already exists
        if (cardExists(cardId)) {
          console.log(`[TriviaCardGenerator] Card already exists: ${cardId}`)
          continue
        }

        // Create initial FSRS card state
        const fsrsCard = createEmptyCard()

        const cardData: ExerciseCard = {
          card_id: cardId,
          post_id: 'trivia', // Trivia cards not tied to Lens posts
          line_index: 0,

          // Exercise type
          exercise_type: 'trivia',

          // Trivia content
          fragment: question.fragment,
          question: question.question,
          choices: question.choices,
          correct_answer: question.correctAnswer,
          explanation: question.explanation,

          // Metadata
          song_id: '', // No native song ID for trivia-only
          genius_song_id: geniusSongId,
          referent_id: question.referentId,
          song_title: songTitle,
          artist: artist,

          // Initial FSRS state
          difficulty: toStoredDifficulty(fsrsCard.difficulty),
          stability: toStoredStability(fsrsCard.stability),
          state: 0, // NEW
          reps: 0,
          lapses: 0,
          due_date: now, // NEW cards immediately available
          last_review: 0, // Never reviewed

          // Timestamps
          created_at: now,
          liked_at: now
        }

        store.setRow('exercise_cards', cardId, cardData)
        cardsCreated++
      }

      console.log(`[TriviaCardGenerator] Created ${cardsCreated} new trivia cards for song ${geniusSongId}`)
      return cardsCreated

    } catch (error) {
      console.error('[TriviaCardGenerator] Failed to create trivia cards:', error)
      throw error
    }
  }

}

// Singleton instance
let triviaGenerator: TriviaCardGenerator | null = null

/**
 * Get the default trivia generator instance
 */
export function getTriviaGenerator(): TriviaCardGenerator {
  if (!triviaGenerator) {
    triviaGenerator = new TriviaCardGenerator()
  }
  return triviaGenerator
}

/**
 * Helper function to generate trivia cards from a Genius song
 */
export async function generateTriviaFromSong(
  geniusSongId: number,
  songTitle: string,
  artist: string,
  walletClient: WalletClient,
  language: string = 'en'
): Promise<number> {
  const generator = getTriviaGenerator()
  return generator.createTriviaCards(geniusSongId, songTitle, artist, walletClient, language)
}
