import { type Component, Show } from 'solid-js'
import { AudioButton } from '@/components/media/AudioButton'
import { useTranslation } from '@/lib/i18n'

export interface SayItBackExerciseProps {
  /** The text the user should say */
  expectedText: string
  /** The user's transcribed speech (when available) */
  transcript?: string
  /** Score 0-100 (when available) */
  score?: number | null
  /** Grade message ("Excellent!", "Nice try!", etc.) */
  gradeMessage?: string
  /** Whether the answer was correct */
  isCorrect?: boolean
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
  const { t } = useTranslation()
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
          {t('exercise.sayItBack')}
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
          {/* User's transcript with inline feedback */}
          <div class="text-left space-y-3">
            <div class="flex items-center gap-2 text-muted-foreground text-lg sm:text-xl font-medium">
              {/* Red X icon when incorrect */}
              <Show when={props.isCorrect === false}>
                <svg class="w-6 h-6 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm37.66,130.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                </svg>
              </Show>
              <span>
                <Show when={props.isCorrect === false}>{t('exercise.tryAgain')} </Show>
                <Show when={props.isCorrect === true && props.gradeMessage}>{props.gradeMessage} </Show>
                {t('exercise.youSaid')}
              </span>
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
