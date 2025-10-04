/**
 * TinyBase Database Setup for FSRS Cards
 * Single source of truth for exercise cards and study statistics
 */

import { createStore } from 'tinybase'

// FSRS Card State in TinyBase
export interface ExerciseCard {
  card_id: string          // Primary key: `${postId}_line_${lineIndex}` or `${genius_song_id}_trivia_${referent_id}`
  post_id: string          // Lens post ID (for SayItBack) or 'trivia' for trivia cards
  line_index: number       // Which line in the segment (for SayItBack) or 0 for trivia

  // Exercise type
  exercise_type: 'sayitback' | 'trivia'

  // SayItBack content
  fragment: string         // The text to practice (SayItBack) or lyric fragment (trivia)
  translation?: string     // Optional translation (SayItBack only)

  // Trivia content (only for exercise_type='trivia')
  question?: string        // The trivia question
  choices?: {              // Multiple choice options
    A: string
    B: string
    C: string
    D: string
  }
  correct_answer?: 'A' | 'B' | 'C' | 'D'  // Correct choice
  explanation?: string     // Why this answer is correct

  // Metadata
  song_id: string          // Native song ID or empty string for trivia-only
  genius_song_id?: number  // Genius song ID (for trivia cards)
  referent_id?: number     // Genius referent ID (for trivia cards)
  song_title: string
  artist: string

  // FSRS state (scaled integers for storage)
  difficulty: number       // Actual difficulty * 1000 (e.g., 0.5 → 500)
  stability: number        // Actual stability * 100 (e.g., 1.0 → 100)
  state: 0 | 1 | 2 | 3    // 0=NEW, 1=LEARNING, 2=REVIEW, 3=RELEARNING
  reps: number             // Total repetitions
  lapses: number           // Times failed
  due_date: number         // Timestamp when card is due
  last_review: number      // Last review timestamp (0 = never)

  // Timestamps
  created_at: number
  liked_at: number
}

// Helper functions for FSRS parameter scaling
export const toStoredDifficulty = (difficulty: number): number => Math.round(difficulty * 1000)
export const fromStoredDifficulty = (stored: number): number => stored / 1000

export const toStoredStability = (stability: number): number => Math.round(stability * 100)
export const fromStoredStability = (stored: number): number => stored / 100

// Create TinyBase store with localStorage persistence
const store = createStore()

// Enable localStorage persistence
if (typeof window !== 'undefined') {
  const persistedData = localStorage.getItem('tinybase_fsrs_store')
  if (persistedData) {
    try {
      store.setJson(persistedData)
      console.log('[TinyBase] Loaded persisted data from localStorage')
    } catch (error) {
      console.error('[TinyBase] Failed to load persisted data:', error)
    }
  }

  // Auto-save to localStorage on any change
  store.addDidFinishTransactionListener(() => {
    try {
      const json = store.getJson()
      localStorage.setItem('tinybase_fsrs_store', json)
    } catch (error) {
      console.error('[TinyBase] Failed to persist data:', error)
    }
  })
}

export { store }

/**
 * Helper: Get all exercise cards
 */
export const getAllCards = (): ExerciseCard[] => {
  const cards: ExerciseCard[] = []
  store.forEachRow('exercise_cards', (rowId) => {
    const card = store.getRow('exercise_cards', rowId) as any
    cards.push(card)
  })
  return cards
}

/**
 * Helper: Get card by ID
 */
export const getCard = (cardId: string): ExerciseCard | null => {
  const card = store.getRow('exercise_cards', cardId)
  return card && Object.keys(card).length > 0 ? (card as any) : null
}

/**
 * Helper: Check if card exists
 */
export const cardExists = (cardId: string): boolean => {
  const card = store.getRow('exercise_cards', cardId)
  return card && Object.keys(card).length > 0
}

/**
 * Helper: Get cards due for study
 */
export const getDueCards = (limit: number = 20): ExerciseCard[] => {
  const now = Date.now()
  const cards: ExerciseCard[] = []
  let totalCards = 0
  let newCards = 0
  let learningCards = 0
  let reviewCards = 0
  let skippedCards = 0

  console.log('[getDueCards] === QUERYING DUE CARDS ===')
  console.log('[getDueCards] Current time:', new Date(now).toISOString())

  store.forEachRow('exercise_cards', (rowId) => {
    const card = store.getRow('exercise_cards', rowId) as any
    totalCards++

    console.log('[getDueCards] Checking card:', {
      id: card.card_id,
      fragment: card.fragment?.substring(0, 30),
      state: ['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'][card.state],
      due_date: new Date(card.due_date).toISOString(),
      is_due: card.due_date <= now
    })

    // NEW cards are always due
    if (card.state === 0) {
      newCards++
      cards.push(card)
      console.log('[getDueCards] ✓ Added NEW card')
      return
    }

    // LEARNING cards: due if not overdue by more than 1 hour
    if (card.state === 1) {
      learningCards++
      const isOverdue = (now - card.due_date) > (60 * 60 * 1000)
      if (card.due_date <= now && !isOverdue) {
        cards.push(card)
        console.log('[getDueCards] ✓ Added LEARNING card')
      } else {
        skippedCards++
        console.log('[getDueCards] ✗ Skipped LEARNING card (overdue or not due yet)')
      }
      return
    }

    // REVIEW/RELEARNING cards: due when due_date has passed
    if ((card.state === 2 || card.state === 3) && card.due_date <= now) {
      reviewCards++
      cards.push(card)
      console.log('[getDueCards] ✓ Added REVIEW/RELEARNING card')
    } else if (card.state === 2 || card.state === 3) {
      skippedCards++
      console.log('[getDueCards] ✗ Skipped REVIEW/RELEARNING card (not due yet)')
    }
  })

  console.log('[getDueCards] === SUMMARY ===')
  console.log('[getDueCards] Total cards in DB:', totalCards)
  console.log('[getDueCards] NEW cards found:', newCards)
  console.log('[getDueCards] LEARNING cards found:', learningCards)
  console.log('[getDueCards] REVIEW cards found:', reviewCards)
  console.log('[getDueCards] Skipped cards:', skippedCards)
  console.log('[getDueCards] Due cards (before limit):', cards.length)

  // Sort by due date (oldest first) and limit
  const result = cards
    .sort((a, b) => a.due_date - b.due_date)
    .slice(0, limit)

  console.log('[getDueCards] Due cards (after limit):', result.length)

  return result
}

/**
 * Helper: Get study statistics
 */
export const getStudyStats = (): {
  newCount: number
  learningCount: number
  dueCount: number
  totalCards: number
} => {
  const now = Date.now()
  let newCount = 0
  let learningCount = 0
  let dueCount = 0
  let totalCards = 0

  store.forEachRow('exercise_cards', (rowId) => {
    const card = store.getRow('exercise_cards', rowId) as any
    totalCards++

    if (card.state === 0) {
      newCount++
    } else if (card.state === 1) {
      learningCount++
      const isOverdue = (now - card.due_date) > (60 * 60 * 1000)
      if (card.due_date <= now && !isOverdue) {
        dueCount++
      }
    } else if (card.state === 2 || card.state === 3) {
      if (card.due_date <= now) {
        dueCount++
      }
    }
  })

  return { newCount, learningCount, dueCount, totalCards }
}

/**
 * Helper: Get all unique songs (for "Liked Songs" list)
 */
export const getLikedSongs = (): Array<{
  postId: string
  songId: string
  songTitle: string
  artist: string
  cardCount: number
  likedAt: number
}> => {
  const songsMap = new Map<string, {
    postId: string
    songId: string
    songTitle: string
    artist: string
    cardCount: number
    likedAt: number
  }>()

  store.forEachRow('exercise_cards', (rowId) => {
    const card = store.getRow('exercise_cards', rowId) as any

    if (!songsMap.has(card.post_id)) {
      songsMap.set(card.post_id, {
        postId: card.post_id,
        songId: card.song_id,
        songTitle: card.song_title,
        artist: card.artist,
        cardCount: 1,
        likedAt: card.liked_at
      })
    } else {
      const song = songsMap.get(card.post_id)!
      song.cardCount++
    }
  })

  return Array.from(songsMap.values())
    .sort((a, b) => b.likedAt - a.likedAt)
}

/**
 * Helper: Delete all cards from a specific post
 */
export const deleteCardsFromPost = (postId: string): number => {
  let deletedCount = 0
  const cardsToDelete: string[] = []

  store.forEachRow('exercise_cards', (rowId) => {
    const card = store.getRow('exercise_cards', rowId) as any
    if (card.post_id === postId) {
      cardsToDelete.push(rowId)
    }
  })

  cardsToDelete.forEach(cardId => {
    store.delRow('exercise_cards', cardId)
    deletedCount++
  })

  console.log(`[TinyBase] Deleted ${deletedCount} cards from post: ${postId}`)
  return deletedCount
}