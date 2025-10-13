import { AudioButton } from './audio-button'
import { AudioScrobbleBar } from '@/components/audio/AudioScrobbleBar'
import { cn } from '@/lib/utils'

export interface InlineAudioPlayerProps {
  /** Audio URL to play (optional during loading) */
  audioUrl?: string
  /** Whether audio is currently playing */
  isPlaying?: boolean
  /** Whether audio is loading/generating */
  isLoading?: boolean
  /** Current playback time in seconds */
  currentTime?: number
  /** Total duration in seconds */
  duration?: number
  /** Called when play/pause is clicked */
  onPlayPause?: () => void
  /** Called when user seeks to a new position */
  onSeek?: (time: number) => void
  /** Audio element ref for playback control */
  audioRef?: React.RefObject<HTMLAudioElement>
  /** Optional className for styling */
  className?: string
}

/**
 * Compact inline audio player with play/pause button and progress bar
 * Can be embedded between sections, not fixed to footer
 * Supports loading state when audio is being generated
 */
export function InlineAudioPlayer({
  audioUrl,
  isPlaying = false,
  isLoading = false,
  currentTime = 0,
  duration = 0,
  onPlayPause,
  onSeek,
  audioRef,
  className,
}: InlineAudioPlayerProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Hidden audio element */}
      {audioRef && audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

      {/* Player Container */}
      <div className="bg-neutral-900/30 rounded-lg border border-neutral-800/50 p-3">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <AudioButton
            isPlaying={isPlaying}
            isLoading={isLoading}
            onClick={onPlayPause}
            size="sm"
            aria-label={isLoading ? 'Generating audio...' : (isPlaying ? 'Pause' : 'Play')}
          />

          {/* Progress Bar */}
          <AudioScrobbleBar
            currentTime={currentTime}
            duration={duration}
            onSeek={isLoading ? undefined : onSeek}
            showTimeLabels={false}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}
