import { MusicNote, Play, Pause } from '@phosphor-icons/react'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from './item'
import { cn } from '@/lib/utils'

export interface SongItemProps {
  /** Song title */
  title: string
  /** Artist name or subtitle */
  artist: string
  /** Optional album art URL */
  artworkUrl?: string
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
  /** Highlight this item (e.g. for current user) */
  isHighlighted?: boolean
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
  showPlayButton = false,
  isPlaying = false,
  onPlayClick,
  onClick,
  rank,
  isHighlighted = false,
  className,
}: SongItemProps) {
  return (
    <Item variant="default" asChild className={cn("gap-3 px-4 py-3", className)}>
      <button
        onClick={onClick}
        className={cn(
          "w-full cursor-pointer transition-colors rounded-full",
          isHighlighted
            ? "bg-primary/10 hover:bg-primary/15"
            : "bg-muted/30 hover:bg-muted/40"
        )}
      >
        {/* Rank */}
        {rank !== undefined && (
          <div className="flex items-center justify-center w-8 flex-shrink-0">
            <span className="text-base font-bold text-muted-foreground">
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
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center">
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
                  "absolute inset-0 flex items-center justify-center transition-opacity rounded-full cursor-pointer",
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
      </button>
    </Item>
  )
}
