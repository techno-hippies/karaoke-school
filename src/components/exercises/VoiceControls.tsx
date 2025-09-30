import { Microphone, StopCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
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
  className,
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
      <div className={cn('w-full', className)}>
        <Button
          disabled
          size="lg"
          className="w-full h-[52px]"
        >
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
          Processing...
        </Button>
      </div>
    )
  }

  // State: Recording or Idle - Full-width button (matches NavigationControls)
  return (
    <div className={cn('w-full', className)}>
      <Button
        onClick={handleRecordToggle}
        variant={isRecording ? 'destructive' : 'default'}
        size="lg"
        className={cn(
          'w-full h-[52px]',
          !isRecording && 'bg-blue-600 hover:bg-blue-700',
          isRecording && 'animate-pulse'
        )}
      >
        {isRecording ? (
          <>
            <StopCircle size={24} weight="fill" />
            <span className="ml-2">Stop</span>
          </>
        ) : (
          <>
            <Microphone size={24} weight="fill" />
            <span className="ml-2">{label}</span>
          </>
        )}
      </Button>
    </div>
  )
}
