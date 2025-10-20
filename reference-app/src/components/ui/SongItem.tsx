import { MusicNote, Play, Pause } from '@phosphor-icons/react'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from './item'
import { cn } from '@/lib/utils'

export interface SongItemProps {
  /** Song title */
  title: string
  /** Artist name */
  artist: string
  /** Optional album art URL */
  artworkUrl?: string
  /** Is this song free (no credits required)? */
  isFree?: boolean
  /** Show play/pause button overlay */
  showPlayButton?: boolean
  /** Is this song currently playing? */
  isPlaying?: boolean
  /** Called when play/pause button is clicked */
  onPlayClick?: () => void
  /** Called when the entire row is clicked */
  onClick?: () => void
  /** Optional rank number to show on the left */
  rank?: number
  /** Optional className for additional styling */
  className?: string
}

/**
 * SongItem - List item for songs using Item primitives
 * Features play/pause overlay on artwork
 */
export function SongItem({
  title,
  artist,
  artworkUrl,
  isFree = false,
  showPlayButton = false,
  isPlaying = false,
  onPlayClick,
  onClick,
  rank,
  className,
}: SongItemProps) {
  return (
    <Item variant="default" asChild className={cn("gap-3 p-2", className)}>
      <button onClick={onClick} className="w-full cursor-pointer hover:bg-secondary/50 transition-colors">
        {/* Rank */}
        {rank !== undefined && (
          <div className="flex items-center justify-center w-6 flex-shrink-0">
            <span className="text-base font-semibold text-muted-foreground">
              {rank}
            </span>
          </div>
        )}

        <ItemMedia variant="image" className="size-12 self-center translate-y-0">
          <div className="relative w-full h-full group">
            {/* Artwork or Gradient Fallback */}
            {artworkUrl ? (
              <img
                src={artworkUrl}
                alt={`${title} artwork`}
                className="w-full h-full object-cover rounded-sm"
              />
            ) : (
              <div className="w-full h-full rounded-sm bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center">
                <MusicNote size={24} weight="duotone" className="text-foreground/80" />
              </div>
            )}

            {/* Play/Pause Button Overlay */}
            {showPlayButton && onPlayClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPlayClick()
                }}
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity rounded-sm cursor-pointer",
                  "bg-black/40 group-hover:bg-black/50"
                )}
                aria-label={isPlaying ? "Pause song" : "Play song"}
              >
                {isPlaying ? (
                  <Pause size={24} weight="fill" className="text-foreground" />
                ) : (
                  <Play size={24} weight="fill" className="text-foreground" />
                )}
              </button>
            )}
          </div>
        </ItemMedia>

        <ItemContent className="min-w-0 gap-0.5 flex-1">
          <ItemTitle className="w-full truncate text-left">{title}</ItemTitle>
          <ItemDescription className="w-full truncate text-left line-clamp-1">{artist}</ItemDescription>
        </ItemContent>

        {/* Free Badge */}
        {isFree && (
          <div className="flex-shrink-0 self-center">
            <span className="text-xs md:text-sm font-semibold px-2 py-1 rounded-full bg-green-500/20 text-green-400">
              FREE
            </span>
          </div>
        )}
      </button>
    </Item>
  )
}
