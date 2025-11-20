import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { LyricsDisplay } from '@/components/karaoke/LyricsDisplay'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { BackButton } from '@/components/ui/back-button'
import { LockKey } from '@phosphor-icons/react'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'

export type PracticePhase = 'idle' | 'recording' | 'processing' | 'result'
export type PracticeGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface PracticeResult {
  grade: PracticeGrade
  feedback: string
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
  isSubscriber?: boolean
  previewLineCount?: number
  onClose?: () => void
  onSubmitRecording?: (submission: RecordingSubmission) => Promise<PracticeResult>
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
 * to Lit Actions for grading after playback completes.
 */
export function KaraokePracticeSession({
  title,
  artist,
  audioUrl,
  lyrics,
  isSubscriber = false,
  previewLineCount = DEFAULT_PREVIEW_LINES,
  onClose,
  onSubmitRecording,
  onSubscribe,
  className,
}: KaraokePracticeSessionProps) {
  const [phase, setPhase] = useState<PracticePhase>('idle')
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submissionMessage, setSubmissionMessage] = useState('Sending take to Lit Actions…')

  const {
    audioRef,
    currentTime,
    duration,
    play,
    pause,
    seek,
  } = useAudioPlayer(audioUrl, {
    onEnded: () => {
      // Instrumental finished – capture whatever we have and send it.
      void finishRecording()
    },
  })

  const { startRecording, stopRecording, cancelRecording } = useAudioRecorder()

  const englishLyrics = useMemo(() => {
    return lyrics.map((line) => ({
      ...line,
      originalText: line.translations?.en ?? line.originalText,
      // We deliberately hide translations during practice to keep focus on recitation
      translations: {},
    }))
  }, [lyrics])

  const displayLyrics = useMemo(() => {
    if (isSubscriber) {
      return englishLyrics
    }

    return englishLyrics.slice(0, previewLineCount)
  }, [englishLyrics, isSubscriber, previewLineCount])

  const resetAudio = useCallback(() => {
    if (audioRef.current) {
      pause()
      seek(0)
    }
  }, [audioRef, pause, seek])

  const handleStart = useCallback(async () => {
    try {
      setError(null)
      setResult(null)
      setSubmissionMessage('Sending take to Lit Actions…')
      if (audioRef.current) {
        audioRef.current.currentTime = 0
      }

      await startRecording()
      await play()
      setPhase('recording')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to access microphone. Please allow recording permissions.'
      setError(message)
      setPhase('idle')
    }
  }, [audioRef, play, startRecording])

  const finishRecording = useCallback(async () => {
    setError(null)

    if (phase !== 'recording') {
      return
    }

    setPhase('processing')

    try {
      const recorded = await stopRecording()
      if (!recorded) {
        throw new Error('Recording did not complete')
      }

      setSubmissionMessage('Scoring your performance…')

      const submission: RecordingSubmission = {
        blob: recorded.blob,
        base64: recorded.base64,
        groveUri: recorded.groveUri,
        duration: duration || audioRef.current?.duration || 0,
      }

      let evaluation: PracticeResult | null = null
      if (onSubmitRecording) {
        evaluation = await onSubmitRecording(submission)
      }

      setResult(
        evaluation ?? {
          grade: 'B',
          feedback: 'Demo grading complete. Hook Lit actions for live scoring.',
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit recording'
      setError(message)
      setResult({ grade: 'F', feedback: 'We could not grade this take. Try again.' })
    } finally {
      setPhase('result')
    }
  }, [audioRef, duration, onSubmitRecording, phase, stopRecording])

  const handleRestart = useCallback(() => {
    resetAudio()
    setResult(null)
    setPhase('idle')
    setError(null)
  }, [resetAudio])

  const handleClose = useCallback(() => {
    resetAudio()
    if (phase === 'recording') {
      cancelRecording()
    }
    onClose?.()
  }, [cancelRecording, onClose, phase, resetAudio])

  const renderMainContent = () => {
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
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-6 px-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-wider text-white/60">Score</p>
            <p className={cn('text-8xl font-black tracking-tight drop-shadow-2xl', grade.className)}>{result.grade}</p>
            <p className="text-2xl font-semibold">{grade.title}</p>
            <p className="text-white/70">{result.feedback || grade.description}</p>
          </div>
        </div>
      )
    }

    return (
      <LyricsDisplay
        lyrics={displayLyrics}
        currentTime={currentTime}
        selectedLanguage="en"
        showTranslations={false}
        className="absolute inset-0 text-center"
      />
    )
  }

  return (
    <div className={cn('relative w-full h-screen text-white flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-2xl flex flex-col">
        <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />

        <div className="flex-none px-4 h-20 border-b border-white/10 flex items-center gap-2 backdrop-blur">
          <BackButton
            onClick={handleClose}
            aria-label="Close"
            className="text-white/90 hover:text-white"
          />
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-sm sm:text-base font-semibold text-white truncate">
              Preview: {title}
            </h1>
          </div>
          {(!isSubscriber && onSubscribe) ? (
            <Button
              onClick={onSubscribe}
              variant="destructive"
              size="sm"
              className="shrink-0"
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
            {error && <p className="text-sm text-red-300">{error}</p>}

            <Button
              size="lg"
              className={cn('w-full text-lg font-semibold tracking-wide', phase === 'recording' ? 'bg-red-500 hover:bg-red-500 text-black' : '')}
              disabled={phase === 'recording' || phase === 'processing'}
              onClick={phase === 'result' ? handleRestart : handleStart}
            >
              {phase === 'idle' && 'Start Practice'}
              {phase === 'recording' && 'Recording...'}
              {phase === 'processing' && 'Submitting...'}
              {phase === 'result' && 'Try Again'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
