import { X, Eye, EyeSlash, CameraRotate, MusicNotes, Microphone } from '@phosphor-icons/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface CameraRecorderProps {
  /** Whether recording is in progress */
  isRecording?: boolean
  /** Callback when record button is clicked */
  onRecord?: () => void
  /** Callback when stop is clicked */
  onStop?: () => void
  /** Callback when close/exit is clicked */
  onClose?: () => void
  /** Optional className */
  className?: string
}

export function CameraRecorder({
  isRecording = false,
  onRecord,
  onStop,
  onClose,
  className,
}: CameraRecorderProps) {
  const [showLyrics, setShowLyrics] = useState(true)
  const [useInstrumental, setUseInstrumental] = useState(false)
  const [frontCamera, setFrontCamera] = useState(true)

  const handleRecordClick = () => {
    if (isRecording) {
      onStop?.()
    } else {
      onRecord?.()
    }
  }

  return (
    <div className={cn('relative h-screen w-full bg-background snap-start flex items-center justify-center', className)}>
      {/* Camera Container */}
      <div className="relative w-full h-full bg-background">
        {/* Camera preview placeholder */}
        <div className="absolute inset-0 bg-secondary flex items-center justify-center">
          <span className="text-muted-foreground text-lg">Camera preview</span>
        </div>

        {/* Close button - top left */}
        <Button
          variant="ghost"
          size="lg"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 left-4 z-50 w-12 px-0 text-white hover:bg-black/30 hover:text-white"
        >
          <X className="w-6 h-6" weight="bold" />
        </Button>

        {/* Karaoke lyrics (will be unified component) */}
        {showLyrics && (
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent pt-6 pb-12 pointer-events-none z-10">
            <div className="flex justify-center px-4">
              <div className="text-white text-center space-y-2 max-w-xl">
                <p className="text-xl font-medium">🎤 Karaoke lyrics here</p>
              </div>
            </div>
          </div>
        )}

        {/* Right-side action stack */}
        <div className="absolute right-4 bottom-32 flex flex-col items-center gap-4 md:gap-6 z-20">
          {/* Flip camera */}
          <button
            onClick={() => setFrontCamera(!frontCamera)}
            className="flex flex-col items-center cursor-pointer"
          >
            <div className="rounded-full p-3 max-md:bg-transparent md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50 transition-colors">
              <CameraRotate className="w-7 h-7 text-white" weight="bold" />
            </div>
            <span className="text-white text-xs max-md:mt-0 md:mt-1">
              {frontCamera ? 'Front' : 'Back'}
            </span>
          </button>

          {/* Show/Hide lyrics */}
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            className="flex flex-col items-center cursor-pointer"
          >
            <div className="rounded-full p-3 max-md:bg-transparent md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50 transition-colors">
              {showLyrics ? (
                <Eye className="w-7 h-7 text-white" weight="bold" />
              ) : (
                <EyeSlash className="w-7 h-7 text-white" weight="bold" />
              )}
            </div>
            <span className="text-white text-xs max-md:mt-0 md:mt-1">Lyrics</span>
          </button>

          {/* Cover/Song toggle - disabled during recording */}
          <button
            onClick={() => setUseInstrumental(!useInstrumental)}
            disabled={isRecording}
            className="flex flex-col items-center cursor-pointer"
          >
            <div className={cn(
              'rounded-full p-3 transition-colors',
              'max-md:bg-transparent',
              isRecording
                ? 'opacity-50 md:bg-neutral-800/30'
                : 'md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50'
            )}>
              {useInstrumental ? (
                <MusicNotes className="w-7 h-7 text-white" weight="bold" />
              ) : (
                <Microphone className="w-7 h-7 text-white" weight="bold" />
              )}
            </div>
            <span className="text-white text-xs max-md:mt-0 md:mt-1">
              {useInstrumental ? 'Cover' : 'Song'}
            </span>
          </button>
        </div>

        {/* Record button - bottom center */}
        <div className="absolute bottom-8 left-0 right-0 z-20">
          <div className="flex justify-center">
            <button
              onClick={handleRecordClick}
              className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer',
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-white hover:bg-neutral-100'
              )}
            >
              <div
                className={cn(
                  'transition-all duration-200 bg-red-500',
                  isRecording
                    ? 'w-6 h-6 rounded-sm'
                    : 'w-16 h-16 rounded-full'
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
