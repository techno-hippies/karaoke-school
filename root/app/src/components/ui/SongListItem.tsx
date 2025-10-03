import { MusicNote } from '@phosphor-icons/react'
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
  /** Click handler */
  onClick?: () => void
  /** Optional className for additional styling */
  className?: string
}

export function SongListItem({
  title,
  artist,
  artworkUrl,
  dueCount,
  onClick,
  className,
}: SongListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer text-left',
        'bg-card hover:bg-secondary border border-border hover:border-primary/50',
        className
      )}
    >
      {/* Album Art or Icon */}
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
        <div className="text-sm text-muted-foreground truncate">{artist}</div>
      </div>

      {/* Due Count Badge - Red Circle */}
      {dueCount !== undefined && dueCount > 0 && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
          <span className="text-sm font-semibold text-white">{dueCount}</span>
        </div>
      )}
    </button>
  )
}
