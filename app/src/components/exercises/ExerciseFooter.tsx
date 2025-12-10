import { type Component, Show } from 'solid-js'
import { AnimatedFooter } from './AnimatedFooter'
import { ExerciseFeedback } from './ExerciseFeedback'
import { NavigationControls } from './NavigationControls'
import { VoiceControls } from './VoiceControls'

export type ExerciseFooterControls =
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

export interface ExerciseFooterProps {
  /** Whether to show the footer */
  show?: boolean
  /** Feedback state (undefined = no feedback shown) */
  feedback?: {
    isCorrect: boolean
    message?: string
  }
  /** Controls type and props */
  controls: ExerciseFooterControls
}

export const ExerciseFooter: Component<ExerciseFooterProps> = (props) => {
  return (
    <AnimatedFooter show={props.show ?? true}>
      <div class="space-y-3">
        {/* Feedback (optional) */}
        <Show when={props.feedback}>
          {(feedback) => (
            <ExerciseFeedback isCorrect={feedback().isCorrect} message={feedback().message} />
          )}
        </Show>

        {/* Controls */}
        <Show when={props.controls.type === 'navigation' && props.controls.type === 'navigation'}>
          {(_) => {
            const ctrl = props.controls as Extract<ExerciseFooterControls, { type: 'navigation' }>
            return (
              <NavigationControls
                onNext={ctrl.onNext}
                onReport={ctrl.onReport}
                exerciseKey={ctrl.exerciseKey}
                disabled={ctrl.disabled}
                label={ctrl.label}
              />
            )
          }}
        </Show>

        <Show when={props.controls.type === 'voice'}>
          {(_) => {
            // Access props.controls directly each render to maintain reactivity
            const getCtrl = () => props.controls as Extract<ExerciseFooterControls, { type: 'voice' }>
            return (
              <VoiceControls
                isRecording={getCtrl().isRecording}
                isProcessing={getCtrl().isProcessing}
                onStartRecording={getCtrl().onStartRecording}
                onStopRecording={getCtrl().onStopRecording}
                label={getCtrl().label}
              />
            )
          }}
        </Show>
      </div>
    </AnimatedFooter>
  )
}
