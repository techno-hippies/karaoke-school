import { createMemo, Show, type Component } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useAuth } from '@/contexts/AuthContext'
import { useStudySession } from '@/hooks/useStudySession'
import { useSongSlug } from '@/hooks/useSongSlug'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'
import { MultipleChoiceQuiz } from '@/components/exercises/MultipleChoiceQuiz'
import { ExerciseHeader } from '@/components/exercises/ExerciseHeader'
import { ExerciseFooter, type ExerciseFooterControls } from '@/components/exercises/ExerciseFooter'
import { ExerciseSkeleton } from '@/components/exercises/ExerciseSkeleton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton layout for study page - shows header/footer structure while loading
 */
const StudyPageSkeleton: Component<{ onClose?: () => void }> = (props) => {
  return (
    <div class="flex flex-col h-screen">
      {/* Header skeleton */}
      <div class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex-shrink-0 h-16">
        <div class="max-w-4xl mx-auto w-full h-full px-4 sm:px-6 md:px-8 flex items-center gap-3">
          <Show
            when={props.onClose}
            fallback={
              <>
                <Skeleton class="w-10 h-10 rounded-full" />
                <Skeleton class="flex-1 h-2 rounded-full" />
              </>
            }
          >
            <ExerciseHeader progress={0} onClose={props.onClose!} />
          </Show>
        </div>
      </div>

      {/* Content skeleton */}
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12">
          <ExerciseSkeleton />
        </div>
      </div>

      {/* Footer placeholder - maintains space */}
      <div class="flex-shrink-0 h-20" />
    </div>
  )
}

/**
 * Study Session Page - SolidJS port with persistent layout
 *
 * Architecture:
 * - Persistent header/footer (never unmount)
 * - Smooth content transitions
 * - Prefetched exercise data (zero wait time)
 * - Optimistic UI updates (instant feedback)
 *
 * Routes supported:
 * - /:artistSlug/:songSlug/study (slug-based, resolves to spotifyTrackId)
 * - /song/:workId/study (Spotify track ID)
 * - /study/session (global session, all songs)
 */

export const StudySessionPage: Component = () => {
  const params = useParams<{
    workId?: string
    artistSlug?: string
    songSlug?: string
  }>()
  const { isPKPReady, isAuthenticating, openAuthDialog } = useAuth()
  const navigate = useNavigate()

  // Create accessors for slug resolution
  const artistSlug = () => params.artistSlug
  const songSlug = () => params.songSlug

  // Resolve slug to spotifyTrackId (instant from static map, or async from subgraph)
  const slugQuery = useSongSlug(artistSlug, songSlug)

  // Determine which identifier to use:
  // - Slug route: use resolved spotifyTrackId
  // - Direct route: use workId (spotifyTrackId)
  // - Global session: undefined (all songs)
  const songId = createMemo(() => slugQuery.data?.spotifyTrackId || params.workId)
  const isSlugRoute = createMemo(() => !!params.artistSlug && !!params.songSlug)
  const isGlobalSession = createMemo(() => !songId() && !isSlugRoute())

  const returnPath = createMemo(() => {
    if (isSlugRoute()) {
      return `/${params.artistSlug}/${params.songSlug}`
    }
    if (params.workId) {
      return `/song/${params.workId}`
    }
    return '/study'
  })

  // Main orchestration hook handles all state and logic
  // Pass spotifyTrackId for slug routes, workId for legacy routes
  const session = useStudySession(songId, { exitPath: returnPath() })

  const cardsCompleted = createMemo(() =>
    session.initialTotalCards() > 0 ? session.initialTotalCards() : session.totalCards()
  )

  const completionTitle = createMemo(() => {
    const title = session.songTitle()
    if (title) return `You finished "${title}"!`
    if (isGlobalSession()) return 'You finished all cards!'
    return 'Session complete!'
  })

  const handleConnectClick = () => {
    if (openAuthDialog) {
      openAuthDialog()
    } else {
      navigate(returnPath())
    }
  }

  // Build footer controls (unwrap accessors to primitives)
  // Note: Must track isRecording/isProcessing as dependencies for reactivity
  const footerControls = createMemo((): ExerciseFooterControls => {
    const feedback = session.feedback()
    const exerciseType = session.exerciseData().type
    // Track these so memo re-runs when recording state changes
    const isRecording = session.isRecording()
    const isProcessing = session.isProcessing()

    if (feedback) {
      return {
        type: 'navigation',
        onNext: session.handleNext,
        label: 'Next',
        exerciseKey: session.currentCard()?.id,
      }
    }

    if (exerciseType === 'SAY_IT_BACK') {
      return {
        type: 'voice',
        isRecording,
        isProcessing,
        onStartRecording: session.handleStartRecording,
        onStopRecording: session.handleStopRecording,
        label: 'Record',
      }
    }

    return { type: 'hidden' }
  })

  // Footer visibility
  const showFooter = createMemo(() =>
    !!session.feedback() || session.exerciseData().type === 'SAY_IT_BACK'
  )

  // Unwrap feedback for footer - don't show text feedback, just use for navigation state
  // SAY_IT_BACK: grade message shown inline in exercise component
  // MULTIPLE_CHOICE: feedback shown inline in quiz component
  const footerFeedback = createMemo(() => {
    // Don't show feedback text in footer - it's shown inline in exercise components
    return undefined
  })

  return (
    <>
      {/* Loading slug resolution for slug-based routes */}
      <Show when={isSlugRoute() && slugQuery.isLoading}>
        <StudyPageSkeleton onClose={() => navigate(returnPath(), { replace: true })} />
      </Show>

      {/* Auth check: Still loading PKP */}
      <Show when={!isPKPReady() && isAuthenticating() && !(isSlugRoute() && slugQuery.isLoading)}>
        <StudyPageSkeleton onClose={() => navigate(returnPath(), { replace: true })} />
      </Show>

      {/* Auth check: Not logged in */}
      <Show when={!isPKPReady() && !isAuthenticating() && !(isSlugRoute() && slugQuery.isLoading)}>
        <div class="flex flex-col items-center justify-center h-screen gap-4 px-4">
          <h1 class="text-xl sm:text-2xl font-bold text-center">Sign Up to Study</h1>
          <p class="text-muted-foreground text-center max-w-md">
            Create an account to track your progress and practice with spaced repetition.
          </p>
          <button
            onClick={handleConnectClick}
            class="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Sign Up
          </button>
        </div>
      </Show>

      {/* Initial loading state (cards loading) */}
      <Show when={isPKPReady() && session.isInitializing()}>
        <StudyPageSkeleton onClose={session.handleClose} />
      </Show>

      {/* No cards available */}
      <Show when={isPKPReady() && !session.isInitializing() && session.totalCards() === 0}>
        <div class="flex flex-col items-center justify-center h-screen gap-4 px-4">
          <h1 class="text-2xl font-bold">No Cards Due</h1>
          <p class="text-muted-foreground text-center max-w-md">
            You've completed all available cards for now. Check back later!
          </p>
          <button
            onClick={() => navigate(returnPath(), { replace: true })}
            class="text-primary hover:underline"
          >
            Go Back
          </button>
        </div>
      </Show>

      {/* Session complete */}
      <Show when={isPKPReady() && !session.isInitializing() && session.totalCards() > 0 && session.currentCardIndex() >= session.totalCards()}>
        <div class="flex flex-col h-screen bg-background">
          <div class="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 text-center gap-8">
            <div class="space-y-3 max-w-xl">
              <h1 class="text-sm uppercase tracking-wide text-muted-foreground">
                Complete
              </h1>
              <p class="text-3xl font-bold">{completionTitle()}</p>
              <p class="text-base text-muted-foreground">
                Come back tomorrow to reinforce what you've learned.
              </p>
            </div>

            <div class="w-full max-w-sm bg-muted/30 rounded-2xl px-6 py-8 text-center space-y-3">
              <p class="text-lg text-muted-foreground">Cards Completed</p>
              <p class="text-7xl font-bold tracking-tight">{cardsCompleted()}</p>
            </div>
          </div>

          <div class="border-t border-border bg-background/95 backdrop-blur-sm">
            <div class="max-w-4xl mx-auto w-full px-4 sm:px-6 md:px-8 py-6">
              <Button size="lg" class="w-full" onClick={() => navigate(returnPath(), { replace: true })}>
                Finish
              </Button>
            </div>
          </div>
        </div>
      </Show>

      {/* Main study session layout - PERSISTENT (never unmounts) */}
      <Show when={isPKPReady() && !session.isInitializing() && session.totalCards() > 0 && session.currentCardIndex() < session.totalCards()}>
        <div class="flex flex-col h-screen">
          {/* Header - PERSISTENT */}
          <div class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex-shrink-0 h-16">
            <div class="max-w-4xl mx-auto w-full h-full px-4 sm:px-6 md:px-8 flex items-center">
              <ExerciseHeader
                progress={session.progress()}
                onClose={session.handleClose}
                stats={session.stats()}
              />
            </div>
          </div>

          {/* Exercise Content - TRANSITIONS SMOOTHLY */}
          <div class="flex-1 overflow-y-auto">
            <div class="max-w-4xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12">
              <Show when={session.isLoadingExercise()}>
                <ExerciseSkeleton />
              </Show>

              <Show when={!session.isLoadingExercise() && session.exerciseData().type === 'ERROR'}>
                <div class="space-y-4 text-center">
                  <p class="text-destructive font-medium">
                    Failed to load exercise: {(session.exerciseData() as any).message}
                  </p>
                  <div class="flex justify-center gap-3">
                    <Button variant="outline" onClick={session.handleNext}>
                      Skip
                    </Button>
                    <Button onClick={() => window.location.reload()}>
                      Reload Page
                    </Button>
                  </div>
                </div>
              </Show>

              <Show when={!session.isLoadingExercise() && session.exerciseData().type === 'SAY_IT_BACK'}>
                <SayItBackExercise
                  expectedText={(session.exerciseData() as any).exerciseText ?? ''}
                  transcript={session.transcript()}
                  score={session.score()}
                  gradeMessage={session.feedback()?.message}
                />
              </Show>

              <Show when={!session.isLoadingExercise() && session.exerciseData().type === 'MULTIPLE_CHOICE'}>
                {(() => {
                  const data = session.exerciseData() as any
                  return (
                    <MultipleChoiceQuiz
                      question={data.question}
                      options={data.options}
                      onAnswer={session.handleAnswerSubmit}
                      isProcessing={session.isProcessing()}
                      hasAnswered={!!session.feedback()}
                      selectedAnswerId={session.selectedAnswer() ? String(session.selectedAnswer()) : undefined}
                      explanation={data.explanation}
                      exerciseType={data.exerciseType}
                    />
                  )
                })()}
              </Show>
            </div>
          </div>

          {/* Footer - Slides up when visible */}
          <ExerciseFooter
            show={showFooter()}
            feedback={footerFeedback()}
            controls={footerControls()}
          />
        </div>
      </Show>
    </>
  )
}
