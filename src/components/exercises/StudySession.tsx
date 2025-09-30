/**
 * StudySession Component
 * Manages a study session with SayItBack exercises and FSRS scheduling
 */

import { useState, useEffect } from 'react'
import { SayItBack } from './SayItBack'
import { getDueCards, type ExerciseCard } from '../../services/database/tinybase'
import { fsrsService } from '../../services/FSRSService'
import { Check } from '@phosphor-icons/react'
import { ExerciseHeader } from './layouts/ExerciseHeader'
import { AnimatedFooter } from './AnimatedFooter'
import { VoiceControls } from './VoiceControls'
import { NavigationControls } from './NavigationControls'

interface StudySessionProps {
  onExit?: () => void
}

export const StudySession = ({ onExit }: StudySessionProps) => {
  const [dueCards, setDueCards] = useState<ExerciseCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [transcript, setTranscript] = useState<string>()
  const [score, setScore] = useState<number | null>(null)
  const [attempts, setAttempts] = useState(0)

  // Load due cards on mount
  useEffect(() => {
    const cards = getDueCards(20)
    setDueCards(cards)
    setIsLoading(false)

    if (cards.length === 0) {
      console.log('[StudySession] No cards due for study')
    } else {
      console.log(`[StudySession] Loaded ${cards.length} due cards`)
    }
  }, [])

  const handleComplete = async (reviewScore: number, reviewTranscript: string) => {
    const isCorrect = reviewScore >= 70
    const currentCard = dueCards[currentIndex]

    setTranscript(reviewTranscript)
    setScore(reviewScore)

    // Update FSRS only if correct
    if (isCorrect) {
      try {
        await fsrsService.reviewCard(currentCard.card_id, true)
        console.log(`[StudySession] Card reviewed: ${currentCard.card_id}, correct=true`)
      } catch (error) {
        console.error('[StudySession] Failed to update card:', error)
      }
    }
  }

  const handleNext = () => {
    if (currentIndex < dueCards.length - 1) {
      // Move to next card
      setCurrentIndex(currentIndex + 1)
      setTranscript(undefined)
      setScore(null)
      setAttempts(0)
    } else {
      // Session complete
      console.log('[StudySession] Session complete!')
      if (onExit) {
        onExit()
      }
    }
  }

  const handleStartRecording = () => {
    // Track attempts for "Try Again" label
    if (transcript) {
      setAttempts(prev => prev + 1)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading study session...</div>
      </div>
    )
  }

  if (dueCards.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-800 rounded-xl p-8 text-center">
          <Check className="w-16 h-16 text-green-400 mx-auto mb-4" weight="bold" />
          <h2 className="text-2xl font-bold text-white mb-2">All Caught Up!</h2>
          <p className="text-gray-400 mb-6">
            No cards are due for review right now. Come back later or like more videos to add new cards.
          </p>
          <button
            onClick={onExit}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold w-full"
          >
            Back to Study Page
          </button>
        </div>
      </div>
    )
  }

  const currentCard = dueCards[currentIndex]
  const progress = ((currentIndex + 1) / dueCards.length) * 100
  const showResults = transcript !== undefined
  const isCorrect = score !== null && score >= 70

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      {/* Header with Progress */}
      <ExerciseHeader
        progress={progress}
        onClose={onExit}
      />

      {/* Main Content Area */}
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto w-full">
        <div className="space-y-6">
          {/* Card metadata */}
          <div className="text-center text-neutral-400 text-sm">
            {currentCard.song_title}
            {currentCard.artist && ` • ${currentCard.artist}`}
          </div>

          {/* SayItBack exercise */}
          <SayItBack
            expectedText={currentCard.fragment}
            transcript={transcript}
            score={score}
            attempts={attempts}
            onComplete={handleComplete}
          />

          {/* Translation (if available) */}
          {currentCard.translation && showResults && (
            <div className="p-4 bg-neutral-800 rounded-lg">
              <div className="text-neutral-500 text-xs mb-1">Translation:</div>
              <div className="text-neutral-300 text-sm">{currentCard.translation}</div>
            </div>
          )}

          {/* Context (if available) */}
          {currentCard.context && showResults && (
            <div className="p-4 bg-neutral-800 rounded-lg">
              <div className="text-neutral-500 text-xs mb-1">Context:</div>
              <div className="text-neutral-300 text-sm">{currentCard.context}</div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Animated Footer */}
      <AnimatedFooter show={true}>
        {showResults && isCorrect ? (
          <NavigationControls
            onNext={handleNext}
            label={currentIndex >= dueCards.length - 1 ? 'Finish' : 'Next'}
          />
        ) : (
          <VoiceControls
            label={attempts > 0 ? 'Try Again' : 'Record'}
            onStartRecording={handleStartRecording}
          />
        )}
      </AnimatedFooter>
    </div>
  )
}