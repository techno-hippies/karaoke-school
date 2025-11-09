import React from 'react'
import { AudioButton } from '@/components/media/AudioButton'

export interface SayItBackExerciseProps {
  /** The text the user should say */
  expectedText: string
  /** The user's transcribed speech (when available) */
  transcript?: string
  /** Score 0-100 (when available) */
  score?: number | null
  /** Number of attempts */
  attempts?: number
  /** Whether recording is in progress */
  isRecording?: boolean
  /** Whether transcription is processing */
  isProcessing?: boolean
  /** Whether the exercise can record (Lit + wallet ready) */
  canRecord?: boolean
  /** Status message to show */
  statusMessage?: string
  /** Optional TTS audio URL for playback */
  ttsAudioUrl?: string
  /** Callbacks */
  onStartRecording?: () => void
  onStopRecording?: () => void
}

export function SayItBackExercise({
  expectedText,
  transcript,
  ttsAudioUrl,
}: SayItBackExerciseProps) {
  const showResults = transcript !== undefined
  const audioRef = React.useRef<HTMLAudioElement>(null)

  const handlePlayAudio = () => {
    if (ttsAudioUrl && audioRef.current) {
      audioRef.current.src = ttsAudioUrl
      audioRef.current.play().catch(err => {
        console.error('[TTS] Failed to play audio:', err)
      })
    }
  }

  return (
    <div className="space-y-8">
      {/* Target text section */}
      <div className="text-left space-y-3">
        <div className="text-muted-foreground text-lg sm:text-xl font-medium">
          Say it back:
        </div>
        <div className="flex items-start gap-4">
          {/* Play button - only show if we have audio */}
          {ttsAudioUrl && (
            <AudioButton
              onClick={handlePlayAudio}
              aria-label="Play audio"
              className="mt-1 shrink-0"
            />
          )}
          {/* Main exercise text - larger but readable */}
          <div className="text-xl sm:text-2xl md:text-3xl font-semibold text-foreground leading-relaxed break-words flex-1">
            {expectedText}
          </div>
        </div>
      </div>

      {/* User's transcript (shown after speaking) */}
      {showResults && (
        <div className="text-left space-y-3">
          <div className="text-muted-foreground text-lg sm:text-xl font-medium">
            You said:
          </div>
          <div className="text-xl sm:text-2xl md:text-3xl font-semibold text-foreground leading-relaxed break-words">
            {transcript}
          </div>
        </div>
      )}

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} />
    </div>
  )
}
