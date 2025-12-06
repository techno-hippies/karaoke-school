import { type Component, Show } from 'solid-js'
import { AudioButton } from '@/components/media/AudioButton'

export interface SayItBackExerciseProps {
  /** The text the user should say */
  expectedText: string
  /** The user's transcribed speech (when available) */
  transcript?: string
  /** Score 0-100 (when available) */
  score?: number | null
  /** Grade message ("Excellent!", "Nice try!", etc.) */
  gradeMessage?: string
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

export const SayItBackExercise: Component<SayItBackExerciseProps> = (props) => {
  let audioRef: HTMLAudioElement | undefined

  const showResults = () => props.transcript !== undefined

  const handlePlayAudio = () => {
    if (props.ttsAudioUrl && audioRef) {
      audioRef.src = props.ttsAudioUrl
      audioRef.play().catch(err => {
        console.error('[TTS] Failed to play audio:', err)
      })
    }
  }

  return (
    <div class="space-y-6">
      {/* Target text section */}
      <div class="text-left space-y-3">
        <div class="text-muted-foreground text-lg sm:text-xl font-medium">
          Say it back:
        </div>
        <div class="flex items-start gap-4">
          {/* Play button - only show if we have audio */}
          <Show when={props.ttsAudioUrl}>
            <AudioButton
              onClick={handlePlayAudio}
              aria-label="Play audio"
              class="mt-1 shrink-0"
            />
          </Show>
          {/* Main exercise text */}
          <div class="text-xl sm:text-2xl font-semibold text-foreground leading-relaxed break-words flex-1">
            {props.expectedText}
          </div>
        </div>
      </div>

      {/* Results (shown after speaking) */}
      <Show when={showResults()}>
        <div class="space-y-4">
          {/* Grade message */}
          <Show when={props.gradeMessage}>
            <div class="text-2xl sm:text-3xl font-bold text-primary">
              {props.gradeMessage}
            </div>
          </Show>

          {/* User's transcript */}
          <div class="text-left space-y-3">
            <div class="text-muted-foreground text-lg sm:text-xl font-medium">
              You said:
            </div>
            <div class="text-xl sm:text-2xl font-semibold text-foreground leading-relaxed break-words">
              {props.transcript}
            </div>
          </div>
        </div>
      </Show>

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} />
    </div>
  )
}
