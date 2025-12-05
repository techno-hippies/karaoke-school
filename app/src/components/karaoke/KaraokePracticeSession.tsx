import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { LyricsDisplay } from '@/components/karaoke/LyricsDisplay'
import { KaraokeLyrics3Line } from '@/components/karaoke/KaraokeLyrics3Line'
import { ScoreCounter } from '@/components/karaoke/ScoreCounter'
import { ComboCounter } from '@/components/karaoke/ComboCounter'
import { FloatingHearts, getHeartsRate } from '@/components/karaoke/FloatingHearts'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { BackButton } from '@/components/ui/back-button'
import { LockKey, Warning } from '@phosphor-icons/react'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'
import { useKaraokeLineSession } from '@/hooks/useKaraokeLineSession'
import type { LineResult, LineSessionSummary, GradeLineParams, GradeLineResult } from '@/hooks/useKaraokeLineSession'
import { useLineKaraokeGrader } from '@/hooks/useLineKaraokeGrader'
import { useAuth } from '@/contexts/AuthContext'
import { preloadFFmpeg } from '@/lib/audio-converter'

/** Combo behavior types: advance (increase), freeze (maintain), reset (back to 1) */
type ComboAction = 'advance' | 'freeze' | 'reset'

/** Map rating to base points and combo behavior */
const ratingConfig = {
  Easy: { basePoints: 100, comboAction: 'advance' as ComboAction },
  Good: { basePoints: 75, comboAction: 'advance' as ComboAction },
  Hard: { basePoints: 50, comboAction: 'freeze' as ComboAction },
  Again: { basePoints: 0, comboAction: 'reset' as ComboAction },
} as const

/** Get multiplier based on combo level (tiered) */
function getComboMultiplier(combo: number): number {
  if (combo >= 20) return 3.0
  if (combo >= 10) return 2.5
  if (combo >= 5) return 2.0
  if (combo >= 3) return 1.5
  return 1.0
}

export type PracticePhase = 'idle' | 'recording' | 'processing' | 'result'
export type PracticeGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface PracticeResult {
  grade: PracticeGrade
  feedback: string
  sessionId?: string
}

export interface RecordingSubmission {
  blob: Blob
  base64: string
  groveUri: string
  duration: number
}

export interface KaraokePracticeSessionProps {
  title: string
  artist: string
  audioUrl: string
  lyrics: LyricLine[]
  clipHash: string
  metadataUri?: string
  /**
   * Whether to emit blockchain transactions (default: true for production)
   * Set to false in Storybook to test UI without real blockchain calls
   */
  emitTransactions?: boolean
  onClose?: () => void
  /** Optional custom grading function (overrides built-in Lit Action grader) */
  gradeLine?: (params: GradeLineParams) => Promise<GradeLineResult | null>
  onSubscribe?: () => void
  /** Called when user needs to authenticate */
  onNeedAuth?: () => void
  className?: string
}

const gradeStyles: Record<PracticeGrade, string> = {
  A: 'text-emerald-400',
  B: 'text-green-300',
  C: 'text-yellow-300',
  D: 'text-orange-300',
  F: 'text-red-400',
}

const gradeKeys: Record<PracticeGrade, string> = {
  A: 'study.gradeExcellent',
  B: 'study.gradeGreat',
  C: 'study.gradeGood',
  D: 'study.gradeOkay',
  F: 'study.gradeFail',
}

/**
 * Fullscreen karaoke practice component for sticky-footer exercise flows.
 * Plays the instrumental once, records browser mic audio as WebM, and submits
 * to Lit Actions for grading after each line completes.
 *
 * Session lifecycle:
 * 1. User clicks "Start Practice"
 * 2. Session ID generated, mic + instrumental start
 * 3. Each line graded in real-time as it ends
 * 4. Final line includes session end event
 * 5. Summary displayed with overall grade
 */
export function KaraokePracticeSession({
  title,
  artist,
  audioUrl,
  lyrics,
  clipHash,
  metadataUri,
  emitTransactions = true,
  onClose,
  gradeLine: customGradeLine,
  onSubscribe,
  onNeedAuth,
  className,
}: KaraokePracticeSessionProps) {
  const { t } = useTranslation()
  const { pkpInfo } = useAuth()
  const performer = pkpInfo?.ethAddress || ''

  // Compute displayLyrics early so we can pass correct line count to session hook
  // Filter lyrics for display (hide section markers, use English)
  const englishLyrics = useMemo(() => {
    return lyrics.map((line) => ({
      ...line,
      originalText: line.translations?.en ?? line.originalText,
      // Hide translations during practice to keep focus on recitation
      translations: {},
    }))
  }, [lyrics])

  // Note: Lyrics are already pre-filtered by MediaPageContainer:
  // - Free users receive karaoke_lines (clip window ~60s)
  // - Subscribers receive full_karaoke_lines (entire song)
  // No additional filtering needed here.
  const displayLyrics = useMemo(() => {
    return englishLyrics
  }, [englishLyrics])

  const [phase, setPhase] = useState<PracticePhase>('idle')
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lineResults, setLineResults] = useState<LineResult[]>([])
  const [sessionSummary, setSessionSummary] = useState<LineSessionSummary | null>(null)

  // Game feedback state
  const [runningScore, setRunningScore] = useState(0)
  const [combo, setCombo] = useState(1)
  const [performanceLevel, setPerformanceLevel] = useState(0) // Start at 0, earn hearts
  const prevCompletedCountRef = useRef(0)

  // Preload FFmpeg.wasm for audio conversion (WebM → WAV)
  useEffect(() => {
    preloadFFmpeg().catch((err) => {
      console.warn('[KaraokePracticeSession] FFmpeg preload failed:', err)
    })
  }, [])


  // Built-in Lit Action grader
  const {
    gradeLine: litGradeLine,
    isReady: isGraderReady,
    configError: graderConfigError,
    isPKPReady,
  } = useLineKaraokeGrader()

  // Use custom grader if provided, otherwise use built-in
  const gradeLineFn = customGradeLine || litGradeLine

  // Memoize callback to prevent useAudioPlayer's RAF loop from being cancelled on every render
  const handleAudioEnded = useCallback(() => {
    // Instrumental finished - session hook handles cleanup
  }, [])

  const {
    audioRef,
    currentTime,
    duration,
    play,
    pause,
    seek,
  } = useAudioPlayer(audioUrl, {
    onEnded: handleAudioEnded,
  })

  const {
    startSession,
    stopSession,
    lineResults: sessionLineResults,
    summary,
    sessionId,
  } = useKaraokeLineSession({
    lines: displayLyrics,
    clipHash,
    performer,
    metadataUriOverride: metadataUri,
    audioRef,
    gradeLine: gradeLineFn,
    skipTx: !emitTransactions,
    maxRetries: 1,
    onComplete: (s) => {
      setSessionSummary(s)
      console.log(`[KaraokePracticeSession] Session ${s.sessionId.slice(0, 10)}... completed: ${s.completedLines}/${s.totalLines} lines, avg ${s.averageScore}%`)
    },
    onError: (err) => {
      console.error('[KaraokePracticeSession] Session error:', err)
      setError(err.message)
    },
  })

  // Sync line results from session hook
  useEffect(() => {
    setLineResults(sessionLineResults)
  }, [sessionLineResults])

  // Update score, combo, and performance level when a line completes or errors
  useEffect(() => {
    const processedResults = lineResults.filter(r => r.status === 'done' || r.status === 'error')
    const newCount = processedResults.length

    if (newCount > prevCompletedCountRef.current) {
      // Get the most recently processed line
      const latestResult = processedResults[processedResults.length - 1]

      // Errors are treated as "Again" (0 points, combo reset)
      const effectiveRating = latestResult?.status === 'error'
        ? 'Again'
        : (latestResult?.rating as keyof typeof ratingConfig)

      const config = ratingConfig[effectiveRating] || ratingConfig.Again

      // Update performance level based on rating
      // Hard is neutral (you passed), Easy/Good build up, Again drops
      const levelDelta =
        effectiveRating === 'Easy' ? 0.25
        : effectiveRating === 'Good' ? 0.12
        : effectiveRating === 'Hard' ? 0.03 // Still a pass, small gain
        : -0.15 // Again - less punishing
      setPerformanceLevel(prev => Math.max(0, Math.min(1, prev + levelDelta)))

      // Apply combo multiplier to points
      setCombo(prevCombo => {
        const multiplier = getComboMultiplier(prevCombo)
        const points = Math.round(config.basePoints * multiplier)
        setRunningScore(prev => prev + points)

        // Handle combo based on action type
        switch (config.comboAction) {
          case 'advance':
            return prevCombo + 1
          case 'freeze':
            return prevCombo
          case 'reset':
            return 1
          default:
            return prevCombo
        }
      })
    }
    prevCompletedCountRef.current = newCount
  }, [lineResults])

  // Convert summary to practice result
  useEffect(() => {
    if (summary) {
      // Stop audio when showing results
      if (audioRef.current) {
        audioRef.current.pause()
      }

      const practiceGrade: PracticeGrade = summary.averageScore >= 90 ? 'A'
        : summary.averageScore >= 75 ? 'B'
        : summary.averageScore >= 60 ? 'C'
        : summary.averageScore >= 40 ? 'D'
        : 'F'
      setResult({
        grade: practiceGrade,
        feedback: `Average score: ${summary.averageScore}% over ${summary.completedLines}/${summary.totalLines} lines`,
        sessionId: summary.sessionId,
      })
      setPhase('result')
    }
  }, [summary, audioRef])

  const resetAudio = useCallback(() => {
    if (audioRef.current) {
      pause()
      seek(0)
    }
  }, [audioRef, pause, seek])

  const handleStart = useCallback(async () => {
    // Validate prerequisites (skip auth check if custom gradeLine provided for testing)
    if (!customGradeLine && !performer) {
      // Trigger auth dialog instead of showing error
      if (onNeedAuth) {
        onNeedAuth()
        return
      }
      setError('Please connect your wallet to practice')
      return
    }

    if (!customGradeLine && !isGraderReady) {
      setError(graderConfigError || 'Grader not ready')
      return
    }

    try {
      setError(null)
      setResult(null)
      setLineResults([])
      setSessionSummary(null)
      setRunningScore(0)
      setCombo(1)
      setPerformanceLevel(0)
      prevCompletedCountRef.current = 0

      // Reset playback
      if (audioRef.current) {
        audioRef.current.currentTime = 0
      }

      await startSession()
      setPhase('recording')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to access microphone. Please allow recording permissions.'
      setError(message)
      setPhase('idle')
    }
  }, [audioRef, customGradeLine, graderConfigError, isGraderReady, performer, startSession, onNeedAuth])

  const handleRestart = useCallback(() => {
    resetAudio()
    stopSession()
    setResult(null)
    setPhase('idle')
    setError(null)
  }, [resetAudio, stopSession])

  const handleClose = useCallback(() => {
    resetAudio()
    stopSession()
    onClose?.()
  }, [onClose, resetAudio, stopSession])

  // Calculate active lines being graded
  const activeLineCount = lineResults.filter(r => r.status === 'processing').length
  const completedLineCount = lineResults.filter(r => r.status === 'done').length
  const errorLineCount = lineResults.filter(r => r.status === 'error').length

  // Clips are cropped from position 0 of the original song (including intro),
  // so currentTime directly matches the lyrics' absolute timestamps - no adjustment needed.
  const adjustedCurrentTime = currentTime

  const renderMainContent = () => {
    // Show config error if grader not ready
    if (!customGradeLine && graderConfigError && phase === 'idle') {
      return (
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 text-center px-6">
          <Warning className="w-12 h-12 text-yellow-400" weight="fill" />
          <div>
            <p className="text-lg font-semibold text-yellow-300">Configuration Required</p>
            <p className="text-sm text-white/60 mt-2">{graderConfigError}</p>
          </div>
        </div>
      )
    }

    if (phase === 'processing') {
      return (
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 text-center px-6">
          <Spinner size="lg" />
          <div>
            <p className="text-lg font-semibold">Grading...</p>
            <p className="text-sm text-white/60 mt-1">Please wait 3-10 seconds</p>
          </div>
        </div>
      )
    }

    if (phase === 'result' && result) {
      const gradeGlow = {
        A: 'drop-shadow-[0_0_40px_rgba(52,211,153,0.6)]',
        B: 'drop-shadow-[0_0_35px_rgba(134,239,172,0.5)]',
        C: 'drop-shadow-[0_0_30px_rgba(253,224,71,0.5)]',
        D: 'drop-shadow-[0_0_30px_rgba(253,186,116,0.5)]',
        F: 'drop-shadow-[0_0_30px_rgba(248,113,113,0.5)]',
      }
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-6 px-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-wider text-white/60">{t('study.score')}</p>
            <p className={cn('text-8xl font-black tracking-tight animate-grade-reveal', gradeStyles[result.grade], gradeGlow[result.grade])}>{result.grade}</p>
            <p className="text-2xl font-semibold animate-bounce-in" style={{ animationDelay: '0.3s' }}>{t(gradeKeys[result.grade])}</p>
            {result.sessionId && (
              <p className="text-xs text-white/40 mt-4 font-mono">
                Session: {result.sessionId.slice(0, 10)}...
              </p>
            )}
          </div>
        </div>
      )
    }

    // During recording, show simplified 3-line karaoke display
    if (phase === 'recording') {
      return (
        <KaraokeLyrics3Line
          lyrics={displayLyrics}
          currentTime={adjustedCurrentTime}
          className="absolute inset-0"
        />
      )
    }

    // Idle state - show full scrollable lyrics
    return (
      <LyricsDisplay
        lyrics={displayLyrics}
        currentTime={adjustedCurrentTime}
        selectedLanguage="en"
        showTranslations={false}
        className="absolute inset-0 text-center"
      />
    )
  }

  // Determine button state
  const isStartDisabled = phase === 'recording' || phase === 'processing' || (!customGradeLine && !isGraderReady)
  const buttonText = phase === 'idle' ? t('study.startSession')
    : phase === 'recording' ? t('study.recording')
    : phase === 'processing' ? t('study.processing')
    : t('study.playAgain')

  return (
    <div className={cn('relative w-full h-screen text-white flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-2xl flex flex-col">
        <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />

        {/* Floating hearts feedback - only during recording */}
        {phase === 'recording' && (
          <FloatingHearts
            heartsPerSecond={getHeartsRate(performanceLevel, combo)}
            performanceLevel={performanceLevel}
            combo={combo}
          />
        )}

        <div className="flex-none px-4 h-16 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur relative">
          <BackButton
            onClick={handleClose}
            aria-label="Close"
            className="text-white/90 hover:text-white z-10"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-4 px-16">
              {phase !== 'result' && (
                <>
                  <ScoreCounter score={runningScore} size="sm" label="" />
                  <ComboCounter combo={combo} />
                </>
              )}
            </div>
          </div>
          {onSubscribe ? (
            <Button
              onClick={onSubscribe}
              variant="destructive"
              size="sm"
              className="shrink-0 z-10"
            >
              <LockKey className="w-4 h-4" weight="fill" />
              {t('study.unlock')}
            </Button>
          ) : (
            <span className="w-12" aria-hidden />
          )}
        </div>

        <div className="flex-1 relative overflow-hidden">
          {renderMainContent()}
        </div>

        {phase !== 'recording' && (
          <div className="flex-none border-t border-white/10 backdrop-blur">
            <div className="w-full px-4 py-4 space-y-3">
              {error && (
                <p className="text-sm text-red-300 flex items-center gap-2">
                  <Warning className="w-4 h-4" weight="fill" />
                  {error}
                </p>
              )}

              <Button
                size="lg"
                variant="gradient"
                className="w-full text-lg font-semibold tracking-wide"
                disabled={isStartDisabled}
                onClick={phase === 'result' ? handleRestart : handleStart}
              >
                {buttonText}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
