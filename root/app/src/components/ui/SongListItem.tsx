import { MusicNote, Play } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface SongListItemProps {
  /** Song title */
  title: string
  /** Artist name */
  artist: string
  /** Optional album art URL */
  artworkUrl?: string
  /** Number of cards due for review (shown on Class page) */
  dueCount?: number
  /** Show play button for native songs */
  showPlayButton?: boolean
  /** Called when play button is clicked */
  onPlayClick?: () => void
  /** Click handler for the entire row */
  onClick?: () => void
  /** Optional className for additional styling */
  className?: string
}

export function SongListItem({
  title,
  artist,
  artworkUrl,
  dueCount,
  showPlayButton,
  onPlayClick,
  onClick,
  className,
}: SongListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 py-2 pr-3 rounded-lg transition-colors cursor-pointer text-left',
        'bg-neutral-900/50 hover:bg-neutral-800/50',
        className
      )}
    >
      {/* Album Art or Icon */}
      <div className="relative flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center overflow-hidden group">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt={`${title} artwork`}
            className="w-full h-full rounded-lg object-cover"
          />
        ) : (
          <MusicNote size={24} weight="duotone" className="text-white/80" />
        )}

        {/* Play Button Overlay */}
        {showPlayButton && onPlayClick && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlayClick()
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity group-hover:bg-black/50"
            aria-label="Play song"
          >
            <Play size={24} weight="fill" className="text-white" />
          </button>
        )}
      </div>

      {/* Song Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate">{title}</div>
        {artist && <div className="text-sm text-neutral-400 truncate">{artist}</div>}
      </div>

      {/* Due Count Badge (Study Songs) */}
      {dueCount !== undefined && dueCount > 0 && (
        <div className="flex-shrink-0 text-sm font-semibold text-neutral-300">
          {dueCount}
        </div>
      )}
    </button>
  )
}
