/**
 * StudySession Component
 * Manages a study session with SayItBack exercises and FSRS scheduling
 */

import { useState, useEffect } from 'react'
import { SayItBack } from './SayItBack'
import { getDueCards, type ExerciseCard } from '../../services/database/tinybase'
import { fsrsService } from '../../services/FSRSService'
import { X, Check } from '@phosphor-icons/react'

interface StudySessionProps {
  onExit?: () => void
}

export const StudySession = ({ onExit }: StudySessionProps) => {
  const [dueCards, setDueCards] = useState<ExerciseCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    total: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [transcript, setTranscript] = useState<string>()
  const [score, setScore] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)

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
    setShowResult(true)

    // Update FSRS
    try {
      await fsrsService.reviewCard(currentCard.card_id, isCorrect)
      console.log(`[StudySession] Card reviewed: ${currentCard.card_id}, correct=${isCorrect}`)
    } catch (error) {
      console.error('[StudySession] Failed to update card:', error)
    }

    // Update session stats
    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (isCorrect ? 0 : 1),
      total: prev.total + 1
    }))

    // Auto-advance after 2 seconds
    setTimeout(() => {
      handleNext()
    }, 2000)
  }

  const handleNext = () => {
    setTranscript(undefined)
    setScore(null)
    setShowResult(false)

    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      // Session complete
      console.log('[StudySession] Session complete!', sessionStats)
      if (onExit) {
        onExit()
      }
    }
  }

  const handleSkip = () => {
    handleNext()
  }

  const handleExit = () => {
    if (onExit) {
      onExit()
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
            onClick={handleExit}
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
  const isCorrect = score !== null && score >= 70

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleExit}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" weight="bold" />
            </button>
            <div className="text-white">
              <div className="text-sm text-gray-400">Progress</div>
              <div className="font-semibold">
                {currentIndex + 1} / {dueCards.length}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-gray-400">Correct</div>
              <div className="text-green-400 font-bold text-lg">{sessionStats.correct}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400">Incorrect</div>
              <div className="text-red-400 font-bold text-lg">{sessionStats.incorrect}</div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mt-4">
          <div className="w-full bg-neutral-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-3xl w-full">
          {/* Card metadata */}
          <div className="mb-6 text-center">
            <div className="text-gray-400 text-sm mb-1">{currentCard.song_title}</div>
            {currentCard.artist && (
              <div className="text-gray-500 text-xs">{currentCard.artist}</div>
            )}
          </div>

          {/* SayItBack exercise */}
          <div className="bg-neutral-800 rounded-xl p-8">
            <SayItBack
              expectedText={currentCard.fragment}
              transcript={transcript}
              score={score}
              onComplete={handleComplete}
            />
          </div>

          {/* Result feedback */}
          {showResult && (
            <div className="mt-6 text-center">
              {isCorrect ? (
                <div className="text-green-400 text-xl font-semibold flex items-center justify-center gap-2">
                  <Check className="w-6 h-6" weight="bold" />
                  Correct! ({score}%)
                </div>
              ) : (
                <div className="text-red-400 text-xl font-semibold flex items-center justify-center gap-2">
                  <X className="w-6 h-6" weight="bold" />
                  Try again ({score}%)
                </div>
              )}
            </div>
          )}

          {/* Context (if available) */}
          {currentCard.context && (
            <div className="mt-6 p-4 bg-neutral-900 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">Context:</div>
              <div className="text-gray-400 text-sm">{currentCard.context}</div>
            </div>
          )}

          {/* Translation (if available) */}
          {currentCard.translation && (
            <div className="mt-4 p-4 bg-neutral-900 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">Translation:</div>
              <div className="text-gray-400 text-sm">{currentCard.translation}</div>
            </div>
          )}

          {/* Skip button (only show before answer) */}
          {!showResult && (
            <div className="mt-6 text-center">
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Skip this card
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Session complete modal */}
      {currentIndex >= dueCards.length - 1 && showResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-neutral-800 rounded-xl p-8 max-w-md w-full text-center">
            <Check className="w-16 h-16 text-green-400 mx-auto mb-4" weight="bold" />
            <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
            <div className="text-gray-400 mb-6">
              <div className="text-lg mb-2">
                {sessionStats.correct} correct, {sessionStats.incorrect} incorrect
              </div>
              <div className="text-sm">
                Accuracy: {Math.round((sessionStats.correct / sessionStats.total) * 100)}%
              </div>
            </div>
            <button
              onClick={handleExit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold w-full"
            >
              Finish
            </button>
          </div>
        </div>
      )}
    </div>
  )
}