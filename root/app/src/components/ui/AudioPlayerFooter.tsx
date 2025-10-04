import { MusicNote } from '@phosphor-icons/react'
import { AudioButton } from './audio-button'

export interface AudioPlayerFooterProps {
  /** Current song title */
  title?: string
  /** Current song artist */
  artist?: string
  /** Album artwork URL */
  artworkUrl?: string
  /** Whether audio is currently playing */
  isPlaying?: boolean
  /** Current playback position (0-100) */
  progress?: number
  /** Called when play/pause is clicked */
  onPlayPause?: () => void
  /** Called when progress bar is clicked */
  onSeek?: (position: number) => void
}

export function AudioPlayerFooter({
  title,
  artist,
  artworkUrl,
  isPlaying = false,
  progress = 0,
  onPlayPause,
  onSeek,
}: AudioPlayerFooterProps) {
  // Don't render if no song is loaded
  if (!title) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card z-40">
      {/* Progress Bar */}
      <div
        className="relative w-full h-1 bg-secondary cursor-pointer overflow-hidden"
        onClick={() => onSeek?.(progress)}
      >
        <div
          className="absolute top-0 left-0 h-full bg-destructive transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Player Controls */}
      <div className="flex items-center gap-3 p-3 border-t border-border">
        {/* Album Art */}
        <div className="flex-shrink-0 w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt={`${title} artwork`}
              className="w-full h-full object-cover"
            />
          ) : (
            <MusicNote size={24} weight="duotone" className="text-muted-foreground" />
          )}
        </div>

        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate">{title}</div>
          <div className="text-muted-foreground truncate">{artist}</div>
        </div>

        {/* Play/Pause Button */}
        <AudioButton
          isPlaying={isPlaying}
          onClick={onPlayPause}
          size="sm"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        />
      </div>
    </div>
  )
}
