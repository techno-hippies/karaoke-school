import { MusicNotes } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { VideoInfoProps } from './types'

/**
 * VideoInfo - Shows username and music info at bottom of video
 * Bottom-left positioning for TikTok-style layout
 */
export function VideoInfo({
  username,
  musicTitle,
  musicAuthor,
  onUsernameClick,
  onMusicClick,
  className
}: VideoInfoProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Username */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onUsernameClick?.()
        }}
        className="text-foreground font-semibold text-xl hover:underline cursor-pointer pointer-events-auto drop-shadow-lg"
      >
        @{username}
      </button>

      {/* Music info */}
      {(musicTitle || musicAuthor) && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMusicClick?.()
          }}
          className="flex items-center gap-1.5 cursor-pointer pointer-events-auto hover:opacity-80 transition-opacity overflow-hidden"
        >
          <MusicNotes className="w-5 h-5 text-foreground flex-shrink-0" weight="fill" />
          <span className="text-foreground text-base drop-shadow-lg truncate">
            {musicAuthor ? `${musicAuthor} - ${musicTitle}` : musicTitle}
          </span>
        </button>
      )}
    </div>
  )
}
