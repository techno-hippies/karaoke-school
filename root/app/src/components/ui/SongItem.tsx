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
  /** Show play/pause button overlay */
  showPlayButton?: boolean
  /** Is this song currently playing? */
  isPlaying?: boolean
  /** Called when play/pause button is clicked */
  onPlayClick?: () => void
  /** Called when the entire row is clicked */
  onClick?: () => void
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
  className,
}: SongItemProps) {
  return (
    <Item variant="default" asChild className={cn("gap-3 p-2", className)}>
      <button onClick={onClick} className="w-full cursor-pointer hover:bg-secondary/50 transition-colors">
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
                <MusicNote size={24} weight="duotone" className="text-white/80" />
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
                  <Pause size={24} weight="fill" className="text-white" />
                ) : (
                  <Play size={24} weight="fill" className="text-white" />
                )}
              </button>
            )}
          </div>
        </ItemMedia>

        <ItemContent className="min-w-0 gap-0.5">
          <ItemTitle className="w-full truncate text-left text-base font-semibold">{title}</ItemTitle>
          <ItemDescription className="w-full truncate text-left line-clamp-1">{artist}</ItemDescription>
        </ItemContent>
      </button>
    </Item>
  )
}
