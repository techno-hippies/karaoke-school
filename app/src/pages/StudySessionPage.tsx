import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useStudySession } from '@/hooks/useStudySession'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'
import { MultipleChoiceQuiz } from '@/components/exercises/MultipleChoiceQuiz'
import { ExerciseHeader } from '@/components/exercises/ExerciseHeader'
import { ExerciseFooter } from '@/components/exercises/ExerciseFooter'
import { ExerciseSkeleton } from '@/components/study/ExerciseSkeleton'
import { Spinner } from '@/components/ui/spinner'

/**
 * Study Session Page - Refactored with persistent layout
 *
 * Architecture:
 * - Persistent header/footer (never unmount)
 * - Smooth content transitions
 * - Prefetched exercise data (zero wait time)
 * - Optimistic UI updates (instant feedback)
 */
export function StudySessionPage() {
  const { workId } = useParams<{ workId: string }>()
  const { isPKPReady, isAuthenticating } = useAuth()
  const navigate = useNavigate()

  // Main orchestration hook handles all state and logic
  const session = useStudySession(workId)

  // Auth check: Distinguish between loading and not logged in
  if (!isPKPReady) {
    // Still loading PKP
    if (isAuthenticating) {
      return (
        <div className="flex items-center justify-center h-screen">
          <Spinner size="lg" />
        </div>
      )
    }

    // Not logged in - show clear message
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Sign in to study</h1>
        <p className="text-muted-foreground text-center max-w-md">
          You need to be signed in to track your progress and practice exercises.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => navigate('/auth/login')}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Initial loading state (cards loading)
  if (session.isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // No cards available
  if (session.totalCards === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-2xl font-bold">No Cards to Study</h1>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">
          Go Back
        </button>
      </div>
    )
  }

  // Session complete
  if (session.currentCardIndex >= session.totalCards) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-2xl font-bold">✓ Study Session Complete!</h1>
        <p className="text-lg text-muted-foreground">
          You've completed {session.totalCards} cards
        </p>
        <button
          onClick={() => navigate('/study')}
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Return to Study
        </button>
      </div>
    )
  }

  // Main study session layout - PERSISTENT (never unmounts)
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header - PERSISTENT */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-3">
          <ExerciseHeader
            progress={session.progress}
            onClose={session.handleClose}
            stats={session.stats}
          />
        </div>
      </div>

      {/* Exercise Content - TRANSITIONS SMOOTHLY */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12">
          {session.isLoadingExercise ? (
            <ExerciseSkeleton type={session.currentCard?.exerciseType} />
          ) : session.exerciseData.type === 'SAY_IT_BACK' ? (
            <SayItBackExercise
              expectedText={session.exerciseData.exerciseText}
              transcript={session.transcript}
              score={session.score}
            />
          ) : session.exerciseData.type === 'MULTIPLE_CHOICE' ? (
            <MultipleChoiceQuiz
              question={session.exerciseData.question}
              options={session.exerciseData.options}
              onAnswer={session.handleAnswerSubmit}
              isProcessing={session.isProcessing}
              hasAnswered={!!session.feedback}
              selectedAnswerId={session.selectedAnswer ? String(session.selectedAnswer) : null}
              explanation={session.exerciseData.explanation}
              exerciseType={session.exerciseData.exerciseType}
            />
          ) : null}
        </div>
      </div>

      {/* Footer - PERSISTENT */}
      <div className="border-t border-border bg-background">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-4">
          <ExerciseFooter
            feedback={session.feedback}
            controls={
              session.feedback
                ? {
                    type: 'navigation',
                    onNext: session.handleNext,
                    label: 'Next',
                    exerciseKey: session.currentCard?.id,
                  }
                : session.exerciseData.type === 'SAY_IT_BACK'
                ? {
                    type: 'voice',
                    isRecording: session.isRecording,
                    isProcessing: session.isProcessing,
                    onStartRecording: session.handleStartRecording,
                    onStopRecording: session.handleStopRecording,
                    label: 'Record',
                  }
                : {
                    type: 'hidden', // Quiz handles submission internally via onAnswer
                  }
            }
          />
        </div>
      </div>
    </div>
  )
}
