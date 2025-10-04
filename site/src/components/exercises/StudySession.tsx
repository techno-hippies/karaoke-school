/**
 * StudySession Component
 * Manages a study session with SayItBack and Trivia exercises using FSRS scheduling
 */

import { useState, useEffect } from 'react'
import { SayItBack } from './SayItBack'
import { MultipleChoiceExercise, type MultipleChoiceOption } from './MultipleChoiceExercise'
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

  // SayItBack state
  const [transcript, setTranscript] = useState<string>()
  const [score, setScore] = useState<number | null>(null)
  const [attempts, setAttempts] = useState(0)

  // Trivia state
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)

  // Load due cards on mount
  useEffect(() => {
    const cards = getDueCards(20)
    console.log('[StudySession] === LOADING DUE CARDS ===')
    console.log('[StudySession] Due cards returned:', cards.length)
    console.log('[StudySession] Cards:', cards.map(c => ({
      id: c.card_id,
      fragment: c.fragment,
      state: ['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'][c.state],
      due_date: new Date(c.due_date).toISOString()
    })))

    setDueCards(cards)
    setIsLoading(false)

    if (cards.length === 0) {
      console.log('[StudySession] No cards due for study')
    } else {
      console.log(`[StudySession] Loaded ${cards.length} due cards`)
    }
  }, [])

  // Handle SayItBack completion
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

  // Handle Trivia answer
  const handleTriviaAnswer = async (selectedId: string, isCorrect: boolean) => {
    const currentCard = dueCards[currentIndex]

    setSelectedAnswerId(selectedId)
    setHasAnswered(true)

    // Update FSRS only if correct
    if (isCorrect) {
      try {
        await fsrsService.reviewCard(currentCard.card_id, true)
        console.log(`[StudySession] Trivia card reviewed: ${currentCard.card_id}, correct=true`)
      } catch (error) {
        console.error('[StudySession] Failed to update card:', error)
      }
    }
  }

  const handleNext = () => {
    if (currentIndex < dueCards.length - 1) {
      // Move to next card
      setCurrentIndex(currentIndex + 1)

      // Reset SayItBack state
      setTranscript(undefined)
      setScore(null)
      setAttempts(0)

      // Reset Trivia state
      setSelectedAnswerId(null)
      setHasAnswered(false)
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
      <div className="flex-1 bg-neutral-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading study session...</div>
      </div>
    )
  }

  if (dueCards.length === 0) {
    return (
      <div className="flex-1 bg-neutral-900 flex items-center justify-center p-6">
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
  const progress = (currentIndex / dueCards.length) * 100
  const isTriviaCard = currentCard.exercise_type === 'trivia'

  // Results state depends on exercise type
  const showResults = isTriviaCard ? hasAnswered : (transcript !== undefined)
  const isCorrect = isTriviaCard
    ? (hasAnswered && selectedAnswerId === currentCard.correct_answer)
    : (score !== null && score >= 70)

  // Convert trivia choices to MultipleChoiceOption[] format
  const triviaOptions: MultipleChoiceOption[] | undefined = isTriviaCard && currentCard.choices
    ? Object.entries(currentCard.choices).map(([id, text]) => ({
        id,
        text,
        isCorrect: id === currentCard.correct_answer
      }))
    : undefined

  console.log('[StudySession] === RENDER ===')
  console.log('[StudySession] currentIndex:', currentIndex)
  console.log('[StudySession] dueCards.length:', dueCards.length)
  console.log('[StudySession] progress:', progress + '%')
  console.log('[StudySession] exercise_type:', currentCard.exercise_type)
  console.log('[StudySession] Current card:', isTriviaCard ? currentCard.question : currentCard.fragment)

  return (
    <div className="flex-1 bg-neutral-900 flex flex-col">
      {/* Header with Progress */}
      <ExerciseHeader
        progress={progress}
        onClose={onExit}
      />

      {/* Main Content Area */}
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto w-full">
        <div className="space-y-6">
          {/* Conditional Exercise Rendering */}
          {isTriviaCard ? (
            <>
              {/* Trivia Multiple Choice Exercise */}
              {currentCard.question && triviaOptions && (
                <MultipleChoiceExercise
                  question={currentCard.question}
                  options={triviaOptions}
                  onAnswer={handleTriviaAnswer}
                  exerciseType="trivia"
                  hasAnswered={hasAnswered}
                  selectedAnswerId={selectedAnswerId}
                  explanation={currentCard.explanation}
                />
              )}

              {/* Show explanation after answering */}
              {showResults && currentCard.explanation && (
                <div className="p-4 bg-neutral-800 rounded-lg">
                  <div className="text-neutral-500 text-xs mb-1">Explanation:</div>
                  <div className="text-neutral-300 text-sm">{currentCard.explanation}</div>
                </div>
              )}

              {/* Show lyric fragment for context */}
              {showResults && currentCard.fragment && (
                <div className="p-4 bg-neutral-800 rounded-lg">
                  <div className="text-neutral-500 text-xs mb-1">Lyric:</div>
                  <div className="text-neutral-300 text-sm italic">"{currentCard.fragment}"</div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* SayItBack Exercise */}
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
            </>
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
        ) : isTriviaCard ? (
          // Trivia cards show nothing until answered (MultipleChoice handles selection)
          showResults ? (
            <NavigationControls
              onNext={handleNext}
              label={currentIndex >= dueCards.length - 1 ? 'Finish' : 'Next'}
            />
          ) : null
        ) : (
          // SayItBack shows voice controls
          <VoiceControls
            label={attempts > 0 ? 'Try Again' : 'Record'}
            onStartRecording={handleStartRecording}
          />
        )}
      </AnimatedFooter>
    </div>
  )
}