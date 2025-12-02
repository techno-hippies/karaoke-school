import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useStudySession } from '@/hooks/useStudySession'
import { useSongSlug } from '@/hooks/useSongSlug'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'
import { MultipleChoiceQuiz } from '@/components/exercises/MultipleChoiceQuiz'
import { ExerciseHeader } from '@/components/exercises/ExerciseHeader'
import { ExerciseFooter } from '@/components/exercises/ExerciseFooter'
import { ExerciseSkeleton } from '@/components/study/ExerciseSkeleton'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SubscriptionDialog } from '@/components/subscription/SubscriptionDialog'
import { useCreatorSubscriptionLock } from '@/hooks/useCreatorSubscriptionLock'
import { useUnlockSubscription } from '@/hooks/useUnlockSubscription'

/**
 * Study Session Page - Refactored with persistent layout
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
export function StudySessionPage({ onConnectWallet }: { onConnectWallet?: () => void }) {
  const { t } = useTranslation()
  const { workId, artistSlug, songSlug } = useParams<{
    workId?: string
    artistSlug?: string
    songSlug?: string
  }>()
  const { isPKPReady, isAuthenticating, pkpAddress, pkpWalletClient } = useAuth()
  const navigate = useNavigate()
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false)

  // Resolve slug to spotifyTrackId (instant from static map, or async from subgraph)
  const { data: slugData, isLoading: isLoadingSlug } = useSongSlug(artistSlug, songSlug)

  // Determine which identifier to use:
  // - Slug route: use resolved spotifyTrackId
  // - Direct route: use workId (spotifyTrackId)
  // - Global session: undefined (all songs)
  const songId = slugData?.spotifyTrackId || workId
  const isSlugRoute = !!artistSlug && !!songSlug
  const isGlobalSession = !songId && !isSlugRoute
  const returnPath = isSlugRoute
    ? `/${artistSlug}/${songSlug}`
    : workId
      ? `/song/${workId}`
      : '/study'

  // Main orchestration hook handles all state and logic
  // Pass spotifyTrackId for slug routes, workId for legacy routes
  const session = useStudySession(songId, { exitPath: returnPath })

  // Get subscription lock by artist slug (from URL params)
  // For global sessions, we don't have an artist slug, so subscription won't apply
  const { data: subscriptionLockData } = useCreatorSubscriptionLock({ artistSlug })
  const {
    subscribe,
    status: subscriptionStatus,
    statusMessage: subscriptionStatusMessage,
    errorMessage: subscriptionErrorMessage,
    reset: resetSubscription,
  } = useUnlockSubscription(
    pkpAddress ?? undefined,
    subscriptionLockData?.unlockLockAddress,
    { walletClient: pkpWalletClient }
  )

  const isSubscriptionProcessing =
    subscriptionStatus === 'approving' || subscriptionStatus === 'purchasing'

  const handleSubscriptionClick = () => {
    if (!subscriptionLockData?.unlockLockAddress) {
      alert('Subscription is not available for this song yet.')
      return
    }

    if (!pkpAddress || !pkpWalletClient) {
      onConnectWallet?.()
      alert('Please sign in to subscribe to this creator.')
      return
    }

    setIsSubscriptionDialogOpen(true)
  }

  const handleSubscriptionConfirm = async () => {
    if (!pkpAddress || !pkpWalletClient) {
      onConnectWallet?.()
      alert('Please sign in to subscribe to this creator.')
      return
    }

    await subscribe()
  }

  const handleSubscriptionRetry = async () => {
    if (!pkpAddress || !pkpWalletClient) {
      onConnectWallet?.()
      alert('Please sign in to subscribe to this creator.')
      return
    }

    resetSubscription()
    await subscribe()
  }

  const handleSubscriptionDialogClose = (open: boolean) => {
    setIsSubscriptionDialogOpen(open)
    if (!open && subscriptionStatus === 'complete') {
      resetSubscription()
    }
  }

  const cardsCompleted = session.initialTotalCards > 0 ? session.initialTotalCards : session.totalCards
  const completionTitle = session.songTitle
    ? t('study.youFinished', { title: session.songTitle })
    : isGlobalSession
    ? t('study.youFinishedAll')
    : t('study.youFinishedSession')

  // Loading slug resolution for slug-based routes
  if (isSlugRoute && isLoadingSlug) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

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
        <h1 className="text-xl sm:text-2xl font-bold text-center">{t('study.signUp')}</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {t('study.signUpDescription')}
        </p>
        <button
          onClick={onConnectWallet || (() => navigate(returnPath))}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          {t('study.signUp')}
        </button>
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
        <h1 className="text-2xl font-bold">{t('study.noCards')}</h1>
        <button onClick={() => navigate(returnPath)} className="text-primary hover:underline">
          {t('study.goBack')}
        </button>
      </div>
    )
  }

  // Session complete
  if (session.currentCardIndex >= session.totalCards) {
    return (
      <>
        <div className="flex flex-col h-screen bg-background">
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 text-center gap-8">
            <div className="space-y-3 max-w-xl">
              <h1 className="text-sm uppercase tracking-wide text-muted-foreground">
                {t('study.complete')}
              </h1>
              <p className="text-3xl font-bold">{completionTitle}</p>
              <p className="text-base text-muted-foreground">
                {t('study.comeBackTomorrow')}
              </p>
            </div>

            <Card className="w-full max-w-sm border border-border/60 bg-muted/30 px-6 py-8 text-center space-y-2">
              <p className="text-base text-muted-foreground">{t('study.cardsCompleted')}</p>
              <p className="text-6xl font-semibold tracking-tight">{cardsCompleted}</p>
            </Card>

            {session.artistName && (
              <Card className="w-full max-w-xl border border-primary/30 bg-primary/5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center p-6 text-left sm:text-left">
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-primary font-semibold">
                      {t('study.supportArtist')}
                    </p>
                    <h2 className="text-2xl font-semibold mt-1">
                      {t('study.subscribeTo', { name: session.artistName })}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      {t('study.unlockContent')}
                    </p>
                  </div>
                  <Button size="lg" className="w-full sm:w-auto" onClick={handleSubscriptionClick}>
                    {t('study.subscribe')}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          <div className="border-t border-border bg-background/95 backdrop-blur-sm">
            <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-6">
              <Button size="lg" className="w-full" onClick={() => navigate(returnPath)}>
                {t('study.finish')}
              </Button>
            </div>
          </div>
        </div>

        <SubscriptionDialog
          open={isSubscriptionDialogOpen}
          onOpenChange={handleSubscriptionDialogClose}
          displayName={session.artistName || 'this artist'}
          currentStep={subscriptionStatus}
          isProcessing={isSubscriptionProcessing}
          statusMessage={subscriptionStatusMessage}
          errorMessage={subscriptionErrorMessage}
          onSubscribe={handleSubscriptionConfirm}
          onRetry={handleSubscriptionRetry}
        />
      </>
    )
  }

  // Main study session layout - PERSISTENT (never unmounts)
  return (
    <div className="flex flex-col h-screen">
      {/* Header - PERSISTENT */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex-shrink-0 h-16">
        <div className="max-w-3xl mx-auto w-full h-full px-4 sm:px-6 md:px-8 flex items-center">
          <ExerciseHeader
            progress={session.progress}
            onClose={session.handleClose}
            stats={session.stats}
          />
        </div>
      </div>

      {/* Exercise Content - TRANSITIONS SMOOTHLY */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12">
          {session.isLoadingExercise ? (
            <ExerciseSkeleton />
          ) : session.exerciseData.type === 'ERROR' ? (
            <div className="space-y-4 text-center">
              <p className="text-destructive font-medium">
                {t('study.failedToLoad')}: {session.exerciseData.message}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={session.handleNext}>
                  {t('study.skip')}
                </Button>
                <Button onClick={() => window.location.reload()}>
                  {t('study.reloadPage')}
                </Button>
              </div>
            </div>
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

      {/* Footer - Slides up when visible */}
      <ExerciseFooter
        show={
          // Show footer when: has feedback OR voice controls (SayItBack)
          !!session.feedback || session.exerciseData.type === 'SAY_IT_BACK'
        }
        feedback={session.feedback}
        controls={
          session.feedback
            ? {
                type: 'navigation',
                onNext: session.handleNext,
                label: t('study.next'),
                exerciseKey: session.currentCard?.id,
              }
            : session.exerciseData.type === 'SAY_IT_BACK'
            ? {
                type: 'voice',
                isRecording: session.isRecording,
                isProcessing: session.isProcessing,
                onStartRecording: session.handleStartRecording,
                onStopRecording: session.handleStopRecording,
                label: t('study.record'),
              }
            : {
                type: 'hidden', // Quiz handles submission internally via onAnswer
              }
        }
      />
    </div>
  )
}
