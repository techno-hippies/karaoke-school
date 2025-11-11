import { AnimatedFooter } from './AnimatedFooter'
import { ExerciseFeedback } from './ExerciseFeedback'
import { NavigationControls } from './NavigationControls'
import { VoiceControls } from './VoiceControls'

export interface ExerciseFooterProps {
  /** Whether to show the footer */
  show?: boolean
  /** Feedback state (undefined = no feedback shown) */
  feedback?: {
    isCorrect: boolean
    message?: string
  }
  /** Controls type and props */
  controls:
    | {
        type: 'navigation'
        onNext: () => void
        onReport?: (reason: string) => void
        exerciseKey?: string
        disabled?: boolean
        label?: string
      }
    | {
        type: 'voice'
        isRecording?: boolean
        isProcessing?: boolean
        onStartRecording?: () => void
        onStopRecording?: () => void
        label?: string
      }
    | {
        type: 'hidden'
      }
}

export function ExerciseFooter({ show = true, feedback, controls }: ExerciseFooterProps) {
  return (
    <AnimatedFooter show={show}>
      <div className="space-y-3">
        {/* Feedback (optional) */}
        {feedback && <ExerciseFeedback isCorrect={feedback.isCorrect} message={feedback.message} />}

        {/* Controls */}
        {controls.type === 'navigation' ? (
          <NavigationControls
            onNext={controls.onNext}
            onReport={controls.onReport}
            exerciseKey={controls.exerciseKey}
            disabled={controls.disabled}
            label={controls.label}
          />
        ) : controls.type === 'voice' ? (
          <VoiceControls
            isRecording={controls.isRecording}
            isProcessing={controls.isProcessing}
            onStartRecording={controls.onStartRecording}
            onStopRecording={controls.onStopRecording}
            label={controls.label}
          />
        ) : null}
      </div>
    </AnimatedFooter>
  )
}
