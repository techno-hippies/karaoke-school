import { Microphone, StopCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

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
  className?: string
}

export function VoiceControls({
  isRecording = false,
  isProcessing = false,
  onStartRecording,
  onStopRecording,
  label = 'Record',
}: VoiceControlsProps) {
  const handleRecordToggle = () => {
    if (isRecording) {
      onStopRecording?.()
    } else {
      onStartRecording?.()
    }
  }

  // State: Processing (transcribing)
  if (isProcessing) {
    return (
      <Button
        disabled
        size="lg"
        className="w-full h-12"
      >
        <Spinner />
        Processing...
      </Button>
    )
  }

  // State: Recording or Idle - Full-width button (matches NavigationControls)
  return (
    <Button
      onClick={handleRecordToggle}
      variant={isRecording ? 'destructive' : 'default'}
      size="lg"
      className={cn(
        'w-full h-12',
        isRecording && 'animate-pulse'
      )}
    >
      {isRecording ? (
        <>
          <StopCircle size={24} weight="fill" />
          Stop
        </>
      ) : (
        <>
          <Microphone size={24} weight="fill" />
          {label}
        </>
      )}
    </Button>
  )
}
