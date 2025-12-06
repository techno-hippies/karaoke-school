import { type Component, Show } from 'solid-js'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export interface VoiceControlsProps {
  /** Current recording state */
  isRecording?: boolean
  /** Processing state (transcribing) */
  isProcessing?: boolean
  /** Callback to start recording */
  onStartRecording?: () => void
  /** Callback to stop recording (auto-submits) */
  onStopRecording?: () => void
  /** Label text to display */
  label?: string
  /** Custom className */
  class?: string
}

export const VoiceControls: Component<VoiceControlsProps> = (props) => {
  const displayLabel = () => props.label || 'Record'

  const handleRecordToggle = () => {
    console.log('[VoiceControls] Button clicked, isRecording:', props.isRecording)
    console.log('[VoiceControls] onStartRecording:', typeof props.onStartRecording)
    console.log('[VoiceControls] onStopRecording:', typeof props.onStopRecording)
    if (props.isRecording) {
      console.log('[VoiceControls] Calling onStopRecording...')
      props.onStopRecording?.()
    } else {
      console.log('[VoiceControls] Calling onStartRecording...')
      props.onStartRecording?.()
    }
  }

  // State: Processing (transcribing)
  return (
    <Show
      when={!props.isProcessing}
      fallback={
        <Button disabled size="lg" class="w-full h-12">
          <Spinner />
          Processing...
        </Button>
      }
    >
      {/* State: Recording or Idle - Full-width button */}
      <Button
        onClick={handleRecordToggle}
        variant={props.isRecording ? 'destructive' : 'default'}
        size="lg"
        class="w-full h-12"
      >
        <Show
          when={props.isRecording}
          fallback={
            <>
              {/* Microphone icon */}
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 256 256">
                <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V240a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z" />
              </svg>
              {displayLabel()}
            </>
          }
        >
          {/* Stop circle icon */}
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 256 256">
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm36,128a4,4,0,0,1-4,4H96a4,4,0,0,1-4-4V104a4,4,0,0,1,4-4h64a4,4,0,0,1,4,4Z" />
          </svg>
          Stop
        </Show>
      </Button>
    </Show>
  )
}
