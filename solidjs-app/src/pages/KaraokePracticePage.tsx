import { type Component, Show, createSignal, createEffect, createMemo, onCleanup } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useSongClips } from '@/hooks/useSongClips'
import { useSongSlug } from '@/hooks/useSongSlug'
import { useSegmentMetadata } from '@/hooks/useSegmentMetadata'
import { useSongAccess } from '@/hooks/useSongAccess'
import { usePaymentWallet } from '@/hooks/usePaymentWallet'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { getLocalizedTitle, getLocalizedArtist } from '@/lib/localize-metadata'
import { useLineKaraokeGrader } from '@/hooks/useLineKaraokeGrader'
import { useKaraokeLineSession } from '@/hooks/useKaraokeLineSession'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BackButton } from '@/components/ui/back-button'
import { SongPurchaseDialog } from '@/components/purchase/SongPurchaseDialog'
import { FloatingHearts, getHeartsRate } from '@/components/karaoke/FloatingHearts'
import { ScoreCounter } from '@/components/karaoke/ScoreCounter'
import { ComboCounter } from '@/components/karaoke/ComboCounter'
import { KaraokeResultsPage } from '@/components/karaoke/KaraokeResultsPage'
import { VerticalTimeline, type TimelineLyricLine } from '@/components/karaoke/VerticalTimeline'
import { ExitConfirmation, useExitConfirmation } from '@/components/ui/exit-confirmation'
import type { LyricLine } from '@/components/karaoke/types'
import type { PurchaseStep } from '@/components/purchase/types'
import { buildManifest, getBestUrl } from '@/lib/storage'

type Phase = 'idle' | 'recording' | 'result'

/**
 * Karaoke Practice Page
 *
 * Full karaoke experience with:
 * - 3-line lyrics display with current line highlighted
 * - Real-time microphone recording
 * - Line-by-line grading via Lit Action + Voxtral STT
 * - Score and combo counters with floating hearts
 * - Results page with line-by-line grades
 */
export const KaraokePracticePage: Component = () => {
  const params = useParams<{ spotifyTrackId?: string; artistSlug?: string; songSlug?: string }>()
  const navigate = useNavigate()
  const auth = useAuth()
  const { uiLanguage } = useTranslation()

  // Phase state
  const [phase, setPhase] = createSignal<Phase>('idle')
  const [score, setScore] = createSignal(0)
  const [combo, setCombo] = createSignal(1)
  // Start at 0 - hearts only appear after first good grade (threshold is 0.25)
  const [performanceLevel, setPerformanceLevel] = createSignal(0)
  // Current audio time in ms for the vertical timeline
  const [currentTimeMs, setCurrentTimeMs] = createSignal(0)
  // Purchase dialog state
  const [showPurchaseDialog, setShowPurchaseDialog] = createSignal(false)

  // Audio element ref
  let audioElement: HTMLAudioElement | undefined

  // Audio player for time tracking
  const { setAudioRef } = useAudioPlayer()

  // Resolve slug to Spotify track ID if using slug-based route
  const slugData = useSongSlug(
    () => params.artistSlug,
    () => params.songSlug
  )

  const spotifyTrackId = createMemo(() => params.spotifyTrackId || slugData.data?.spotifyTrackId)

  // Fetch clips with metadata
  const workData = useSongClips(spotifyTrackId)
  const firstClip = createMemo(() => workData.data?.clips?.[0])
  const clipMetadata = useSegmentMetadata(() => firstClip()?.metadataUri)

  // Localized title and artist based on UI language
  const localizedTitle = createMemo(() =>
    getLocalizedTitle(clipMetadata.data, uiLanguage()) || clipMetadata.data?.title || 'Untitled'
  )
  const localizedArtist = createMemo(() =>
    getLocalizedArtist(clipMetadata.data, uiLanguage()) || clipMetadata.data?.artist || 'Unknown Artist'
  )

  // Get encryption metadata URI for v2 hybrid decryption
  const encryptionMetadataUri = createMemo(() => {
    const metadata = clipMetadata.data
    return (metadata as any)?.encryption?.encryptionMetadataUri
  })

  // Song access state machine
  const songAccess = useSongAccess({
    spotifyTrackId,
    encryptionMetadataUrl: encryptionMetadataUri,
  })

  // Payment wallet (EOA or PKP based on auth method)
  const paymentWallet = usePaymentWallet({ requiredUsd: 0.10 })

  // Build lyrics from metadata
  const lyrics = createMemo((): LyricLine[] => {
    const metadata = clipMetadata.data
    if (!metadata) return []

    const isOwned = songAccess.isOwned()
    const karaokeLinesToUse = isOwned && metadata.full_karaoke_lines?.length
      ? metadata.full_karaoke_lines
      : metadata.karaoke_lines

    if (!karaokeLinesToUse || !Array.isArray(karaokeLinesToUse)) return []

    return karaokeLinesToUse.map((line: any, index: number) => ({
      lineIndex: index,
      originalText: line.text || line.original_text || '',
      start: Number(line.start_ms) / 1000,
      end: Number(line.end_ms) / 1000,
      words: Array.isArray(line.words) ? line.words.map((w: any) => ({
        text: w.text || w.word || '',
        start: w.start_ms ? Number(w.start_ms) / 1000 : Number(w.start || 0),
        end: w.end_ms ? Number(w.end_ms) / 1000 : Number(w.end || 0),
      })) : [],
    }))
  })

  // Convert lyrics to timeline format (uses ms)
  const timelineLines = createMemo((): TimelineLyricLine[] => {
    return lyrics().map(line => ({
      text: line.originalText,
      startMs: line.start * 1000,
      endMs: line.end * 1000,
    }))
  })

  // Track audio time for the vertical timeline
  createEffect(() => {
    if (phase() !== 'recording' || !audioElement) return

    let rafId: number

    const updateTime = () => {
      if (audioElement) {
        setCurrentTimeMs(audioElement.currentTime * 1000)
      }
      rafId = requestAnimationFrame(updateTime)
    }

    rafId = requestAnimationFrame(updateTime)
    onCleanup(() => cancelAnimationFrame(rafId))
  })

  // Audio URL
  const audioUrl = createMemo(() => {
    const decrypted = songAccess.decryptedAudioUrl()
    if (decrypted) return decrypted

    const metadata = clipMetadata.data
    if (!metadata) return undefined

    // Use getBestUrl for audio URLs (returns URL string for <audio>)
    const clip = firstClip()
    if (metadata.assets?.instrumental) {
      const manifest = buildManifest(metadata.assets.instrumental)
      return getBestUrl(manifest) ?? undefined
    }
    if (clip?.instrumentalUri) {
      const manifest = buildManifest(clip.instrumentalUri)
      return getBestUrl(manifest) ?? undefined
    }
    return undefined
  })

  // Clip hash for grading
  const clipHash = createMemo(() => {
    const clip = firstClip()
    return clip?.clipHash || '0x0000000000000000000000000000000000000000000000000000000000000000'
  })

  // Loading state
  const isLoading = createMemo(() =>
    slugData.isLoading || workData.isLoading || clipMetadata.isLoading ||
    !clipMetadata.data?.title || !clipMetadata.data?.artist
  )

  // Initialize grader
  const grader = useLineKaraokeGrader()

  // Initialize session
  const session = useKaraokeLineSession({
    lines: lyrics,
    clipHash,
    performer: () => auth.pkpInfo()?.ethAddress || '',
    audioRef: () => audioElement || null,
    gradeLine: grader.gradeLine,
    skipTx: false,
    onComplete: (summary) => {
      console.log(`[KaraokePracticePage] Session complete: ${summary.completedLines}/${summary.totalLines} lines, avg ${summary.averageScore}%`)
      setPhase('result')
    },
    onError: (err) => {
      console.error('[KaraokePracticePage] Session error:', err)
    },
  })

  // Update score/combo/performance based on line results
  createEffect(() => {
    const results = session.lineResults()
    let totalScore = 0
    let currentCombo = 1
    // Start at 0.15 to show some encouragement hearts early
    let perfLevel = 0.15

    for (const result of results) {
      if (result.status === 'done' && typeof result.score === 'number') {
        const lineScore = result.score

        if (lineScore >= 75) {
          // Good or better - increment combo, big performance boost
          totalScore += lineScore * (1 + currentCombo * 0.1)
          currentCombo++
          perfLevel = Math.min(1, perfLevel + 0.15)
        } else if (lineScore >= 50) {
          // Hard/medium - small bonus, maintain combo, slight boost
          totalScore += lineScore * 0.75
          perfLevel = Math.min(1, perfLevel + 0.05)
        } else if (lineScore >= 30) {
          // Low but not terrible - small penalty
          totalScore += lineScore * 0.5
          currentCombo = Math.max(1, currentCombo - 1)
          perfLevel = Math.max(0, perfLevel - 0.05)
        } else {
          // Again - reset combo, bigger penalty
          totalScore += lineScore * 0.5
          currentCombo = 1
          perfLevel = Math.max(0, perfLevel - 0.1)
        }
      }
    }

    setScore(Math.round(totalScore))
    setCombo(currentCombo)
    setPerformanceLevel(perfLevel)
  })

  const handleClose = () => {
    navigate(-1)
  }

  // Exit confirmation (drawer on mobile, dialog on desktop)
  // Only show confirmation during recording, not in idle or result state
  const exitConfirmation = useExitConfirmation(handleClose)

  const requestClose = () => {
    if (phase() === 'recording') {
      exitConfirmation.requestExit()
    } else {
      handleClose()
    }
  }

  const startRecording = async () => {
    if (!auth.isPKPReady()) {
      auth.openAuthDialog()
      return
    }

    try {
      setPhase('recording')
      setScore(0)
      setCombo(1)
      setPerformanceLevel(0) // Start at 0, hearts appear after first good grade
      await session.startSession()
    } catch (err) {
      console.error('[KaraokePracticePage] Failed to start session:', err)
      setPhase('idle')
    }
  }

  const stopRecording = () => {
    session.stopSession()
    setPhase('result')
  }

  const playAgain = () => {
    setPhase('idle')
  }

  // Auto-stop when audio ends
  const handleAudioEnded = () => {
    if (phase() === 'recording') {
      console.log('[KaraokePracticePage] Audio ended, waiting for grading to complete...')
      // Don't need to do anything - the session will auto-complete via the tick fallback
      // or when the last line finishes grading
    }
  }

  // Expected texts for results page
  const expectedTexts = createMemo(() => lyrics().map(l => l.originalText))

  // Check if user is authenticated
  const canStartPractice = createMemo(() => auth.isPKPReady() && grader.isReady())

  // Show unlock button if:
  // 1. User hasn't purchased the song (!isOwned), OR
  // 2. Decryption failed (state === 'owned-decrypt-failed')
  const shouldShowUnlockButton = createMemo(() => {
    const state = songAccess.state()
    const isOwned = songAccess.isOwned()
    return !isOwned || state === 'owned-decrypt-failed'
  })

  // Track if we're upgrading from clip to full audio
  const isUpgradingToFullAudio = createMemo(() => {
    const state = songAccess.state()
    const isDecrypting = songAccess.isDecrypting()
    const hasEncryption = encryptionMetadataUri()
    return isDecrypting || (state === 'owned-pending-decrypt' && hasEncryption)
  })

  // Map song access state to dialog step
  const dialogStep = createMemo((): PurchaseStep => {
    const state = songAccess.state()
    const isPurchasing = songAccess.isPurchasing()
    const subState = songAccess.purchaseSubState()
    const error = songAccess.error()
    const isOwned = songAccess.isOwned()

    if (!isPurchasing && state === 'not-owned') {
      if (error) return 'error'
      return 'idle'
    }

    if (isPurchasing) {
      switch (subState) {
        case 'checking-balance':
          return 'checking'
        case 'signing':
          return 'signing'
        case 'confirming':
          return 'purchasing'
        default:
          return 'checking'
      }
    }

    // After purchase success, show complete if dialog is still open
    if (isOwned && showPurchaseDialog()) {
      return 'complete'
    }

    return 'idle'
  })

  // Handle unlock button click
  const handleUnlockClick = () => {
    const pkpAddress = auth.pkpAddress()

    if (!pkpAddress) {
      // Not authenticated - open auth dialog
      auth.openAuthDialog()
      return
    }

    // If decrypt failed, retry instead of showing dialog
    if (songAccess.state() === 'owned-decrypt-failed') {
      songAccess.retryDecrypt()
      return
    }

    setShowPurchaseDialog(true)
  }

  // Handle purchase confirmation
  const handlePurchaseConfirm = async () => {
    const pkpAddress = auth.pkpAddress()

    if (!pkpAddress) {
      auth.openAuthDialog()
      return
    }

    await songAccess.purchase()
  }

  // Handle retry after error
  const handleRetry = () => {
    songAccess.reset()
  }

  // Handle dialog close
  const handleDialogClose = (open: boolean) => {
    setShowPurchaseDialog(open)
  }

  return (
    <>
      {/* Loading state */}
      <Show when={isLoading()}>
        <div class="flex items-center justify-center h-screen bg-background">
          <Spinner size="lg" />
        </div>
      </Show>

      {/* Error state */}
      <Show when={!isLoading() && (!audioUrl() || lyrics().length === 0)}>
        <div class="flex flex-col items-center justify-center h-screen gap-4 px-4 bg-background">
          <h1 class="text-xl font-bold">Unable to load karaoke</h1>
          <p class="text-muted-foreground">
            {!audioUrl() ? 'Audio not available' : 'Lyrics not available'}
          </p>
          <button onClick={requestClose} class="text-primary hover:underline">
            Go back
          </button>
        </div>
      </Show>

      {/* Main karaoke UI */}
      <Show when={!isLoading() && audioUrl() && lyrics().length > 0}>
        <div class="relative w-full h-screen bg-background flex flex-col overflow-hidden">
          {/* Hidden audio element */}
          <audio
            ref={(el) => {
              audioElement = el
              setAudioRef(el)
            }}
            src={audioUrl()}
            preload="auto"
            onEnded={handleAudioEnded}
          />

          {/* Floating hearts while recording */}
          <Show when={phase() === 'recording'}>
            <FloatingHearts
              heartsPerSecond={getHeartsRate(performanceLevel(), combo())}
              performanceLevel={performanceLevel()}
              combo={combo()}
            />
          </Show>

          {/* Header */}
          <div class="flex-none px-4 h-16 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur relative z-10">
            {/* Left: Close button */}
            <BackButton variant="close" onClick={requestClose} />

            {/* Center: Score + Combo */}
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Show when={phase() === 'recording'}>
                <div class="flex items-center gap-4">
                  <ScoreCounter score={score()} label="" size="sm" />
                  <ComboCounter combo={combo()} />
                </div>
              </Show>
            </div>

            {/* Right: Unlock/Unlocking indicator */}
            <div class="flex items-center">
              <Show when={isUpgradingToFullAudio()}>
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <div class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span>{songAccess.decryptProgress() ? `${songAccess.decryptProgress()}%` : 'Unlocking...'}</span>
                </div>
              </Show>
              <Show when={shouldShowUnlockButton() && !isUpgradingToFullAudio()}>
                <Button onClick={handleUnlockClick} size="sm">
                  <Icon name="lock-simple" class="text-base" />
                  Unlock
                </Button>
              </Show>
              <Show when={!shouldShowUnlockButton() && !isUpgradingToFullAudio()}>
                <div class="w-10" />
              </Show>
            </div>
          </div>

          {/* Main content - vertical timeline (uses full height, scrolls behind footer) */}
          <Show when={phase() !== 'result'}>
            {/* Timeline container - absolute positioned to fill available space */}
            <div class="absolute inset-0 top-16 flex items-center justify-center px-4">
              <VerticalTimeline
                lines={timelineLines()}
                currentTimeMs={currentTimeMs()}
                viewportHeight={window.innerHeight - 64}
                pixelsPerSecond={80}
                colorScheme="red"
                guitarHeroMode={true}
                class="w-full max-w-md"
              />
            </div>

            {/* Footer - sticky at bottom with backdrop blur */}
            <div
              class="absolute bottom-0 left-0 right-0 z-30 bg-background/90 backdrop-blur-md border-t border-border p-4"
              style={{ 'padding-bottom': 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div class="max-w-xl mx-auto">
                <Show when={phase() === 'idle'}>
                  <Show when={!auth.isPKPReady()}>
                    <Button variant="gradient" size="lg" class="w-full text-lg py-6" onClick={() => auth.openAuthDialog()}>
                      <Icon name="user" class="mr-2 text-xl" />
                      Sign In to Practice
                    </Button>
                  </Show>
                  <Show when={auth.isPKPReady() && !grader.isReady()}>
                    <div class="text-center text-muted-foreground">
                      <p>Grading not configured</p>
                      <p class="text-sm">{grader.configError()}</p>
                    </div>
                  </Show>
                  <Show when={canStartPractice()}>
                    <Button variant="gradient" size="lg" class="w-full text-lg py-6" onClick={startRecording}>
                      <Icon name="microphone" class="mr-2 text-xl" />
                      Start
                    </Button>
                  </Show>
                </Show>

                <Show when={phase() === 'recording'}>
                  <Button variant="destructive" size="lg" class="w-full text-lg py-6" onClick={stopRecording}>
                    <Icon name="stop" class="mr-2 text-xl" />
                    Stop
                  </Button>
                </Show>
              </div>
            </div>
          </Show>

          {/* Results page overlay */}
          <Show when={phase() === 'result'}>
            <div class="absolute inset-0 z-50">
              <KaraokeResultsPage
                expectedTexts={expectedTexts()}
                lineResults={session.lineResults()}
                onPlayAgain={playAgain}
                onClose={requestClose}
              />
            </div>
          </Show>
        </div>
      </Show>

      {/* Purchase Dialog */}
      <SongPurchaseDialog
        open={showPurchaseDialog()}
        onOpenChange={handleDialogClose}
        songTitle={localizedTitle()}
        artistName={localizedArtist()}
        coverUrl={clipMetadata.data?.coverUri ? getBestUrl(buildManifest(clipMetadata.data.coverUri)) ?? undefined : undefined}
        currentStep={dialogStep()}
        statusMessage={songAccess.statusMessage()}
        errorMessage={songAccess.error()}
        onPurchase={handlePurchaseConfirm}
        onRetry={handleRetry}
        walletAddress={paymentWallet.walletAddress()}
      />

      {/* Exit confirmation modal */}
      <ExitConfirmation
        open={exitConfirmation.isOpen()}
        onCancel={exitConfirmation.cancel}
        onConfirm={exitConfirmation.confirm}
        sessionType="karaoke"
      />
    </>
  )
}
