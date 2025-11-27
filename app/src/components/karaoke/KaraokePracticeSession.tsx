import { useState, useMemo, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { LyricsDisplay } from '@/components/karaoke/LyricsDisplay'
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
  isSubscriber?: boolean
  previewLineCount?: number
  /** Whether to emit blockchain transactions (default: false for dev) */
  emitTransactions?: boolean
  onClose?: () => void
  /** Optional custom grading function (overrides built-in Lit Action grader) */
  gradeLine?: (params: GradeLineParams) => Promise<GradeLineResult | null>
  onSubscribe?: () => void
  className?: string
}

const gradeMeta: Record<PracticeGrade, { title: string; description: string; className: string }> = {
  A: { title: 'Excellent', description: 'Pitch perfect. Keep flexing.', className: 'text-emerald-400' },
  B: { title: 'Great', description: 'Strong delivery with minor slips.', className: 'text-green-300' },
  C: { title: 'Good', description: 'Solid attempt. Keep practicing.', className: 'text-yellow-300' },
  D: { title: 'Okay', description: 'On the right track. Watch timing.', className: 'text-orange-300' },
  F: { title: 'Keep Going', description: 'Start over and lock in.', className: 'text-red-300' },
}

const DEFAULT_PREVIEW_LINES = 4

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
  isSubscriber = false,
  previewLineCount = DEFAULT_PREVIEW_LINES,
  emitTransactions = false,
  onClose,
  gradeLine: customGradeLine,
  onSubscribe,
  className,
}: KaraokePracticeSessionProps) {
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

  const displayLyrics = useMemo(() => {
    if (isSubscriber) {
      return englishLyrics
    }
    return englishLyrics.slice(0, previewLineCount)
  }, [englishLyrics, isSubscriber, previewLineCount])

  const [phase, setPhase] = useState<PracticePhase>('idle')
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lineResults, setLineResults] = useState<LineResult[]>([])
  const [sessionSummary, setSessionSummary] = useState<LineSessionSummary | null>(null)

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
    // Validate prerequisites
    if (!performer) {
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
  }, [audioRef, customGradeLine, graderConfigError, isGraderReady, performer, startSession])

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

  // Calculate time offset - the clip starts at 0 but lyrics have original song timing
  // We need to offset currentTime to match the lyrics' expected timestamps
  const lyricsStartTime = displayLyrics[0]?.start ?? 0
  const adjustedCurrentTime = currentTime + lyricsStartTime

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
      const grade = gradeMeta[result.grade]
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
            <p className="text-sm uppercase tracking-wider text-white/60">Score</p>
            <p className={cn('text-8xl font-black tracking-tight animate-grade-reveal', grade.className, gradeGlow[result.grade])}>{result.grade}</p>
            <p className="text-2xl font-semibold animate-bounce-in" style={{ animationDelay: '0.3s' }}>{grade.title}</p>
            <p className="text-white/70 animate-bounce-in" style={{ animationDelay: '0.5s' }}>{result.feedback || grade.description}</p>
            {result.sessionId && emitTransactions && (
              <p className="text-xs text-white/40 mt-4 font-mono">
                Session: {result.sessionId.slice(0, 10)}...
              </p>
            )}
          </div>
        </div>
      )
    }

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
  const buttonText = phase === 'idle' ? 'Start'
    : phase === 'recording' ? `Recording... (${completedLineCount}/${displayLyrics.length})`
    : phase === 'processing' ? 'Submitting...'
    : 'Try Again'

  return (
    <div className={cn('relative w-full h-screen text-white flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-2xl flex flex-col">
        <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />

        <div className="flex-none px-4 h-20 border-b border-white/10 flex items-center justify-between backdrop-blur relative">
          <BackButton
            onClick={handleClose}
            aria-label="Close"
            className="text-white/90 hover:text-white z-10"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center px-16">
              <h1 className="text-sm sm:text-base font-semibold text-white truncate">
                {isSubscriber ? title : `Preview: ${title}`}
              </h1>
              {phase === 'recording' && (
                <p className="text-xs text-white/50">
                  {activeLineCount > 0 ? 'Grading...' : 'Listening...'}
                  {errorLineCount > 0 && ` (${errorLineCount} errors)`}
                </p>
              )}
            </div>
          </div>
          {(!isSubscriber && onSubscribe) ? (
            <Button
              onClick={onSubscribe}
              variant="destructive"
              size="sm"
              className="shrink-0 z-10"
            >
              <LockKey className="w-4 h-4" weight="fill" />
              Subscribe
            </Button>
          ) : (
            <span className="w-12" aria-hidden />
          )}
        </div>

        <div className="flex-1 relative overflow-hidden">
          {renderMainContent()}
        </div>

        <div className="flex-none border-t border-white/10 backdrop-blur">
          <div className="w-full px-4 py-4 space-y-3">
            {error && (
              <p className="text-sm text-red-300 flex items-center gap-2">
                <Warning className="w-4 h-4" weight="fill" />
                {error}
              </p>
            )}

            {!performer && phase === 'idle' && (
              <p className="text-sm text-yellow-300/80">
                Connect wallet to enable practice
              </p>
            )}

            <Button
              size="lg"
              variant={phase === 'recording' ? 'recording' : phase === 'result' ? 'gradient-success' : 'gradient'}
              className="w-full text-lg font-semibold tracking-wide"
              disabled={isStartDisabled}
              onClick={phase === 'result' ? handleRestart : handleStart}
            >
              {buttonText}
            </Button>

            {emitTransactions && phase === 'idle' && (
              <p className="text-xs text-center text-white/40">
                Blockchain transactions enabled
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
