import { useState } from 'react'
import { MusicNotes } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { VideoInfoProps } from './types'

/**
 * VideoInfo - Shows username, description, and music info at bottom of video
 * Bottom-left positioning for TikTok-style layout
 */
export function VideoInfo({
  username,
  description,
  musicTitle,
  musicAuthor,
  onUsernameClick,
  onMusicClick,
  className
}: VideoInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={cn('space-y-2', className)}>
      {/* Username */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onUsernameClick?.()
        }}
        className="text-white font-semibold text-xl hover:underline cursor-pointer pointer-events-auto drop-shadow-lg"
      >
        @{username}
      </button>

      {/* Description/Caption */}
      {description && (
        <div className="text-white text-base drop-shadow-lg leading-tight">
          {isExpanded ? (
            <div>
              {description}{' '}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(false)
                }}
                className="font-bold hover:opacity-80 transition-opacity pointer-events-auto inline cursor-pointer"
              >
                less
              </button>
            </div>
          ) : (
            <div className="flex items-baseline gap-1 overflow-hidden">
              <span className="truncate">
                {description}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(true)
                }}
                className="font-bold hover:opacity-80 transition-opacity pointer-events-auto whitespace-nowrap flex-shrink-0 cursor-pointer"
              >
                more
              </button>
            </div>
          )}
        </div>
      )}

      {/* Music info */}
      {(musicTitle || musicAuthor) && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMusicClick?.()
          }}
          className="flex items-center gap-1.5 cursor-pointer pointer-events-auto hover:opacity-80 transition-opacity overflow-hidden"
        >
          <MusicNotes className="w-5 h-5 text-white flex-shrink-0" weight="fill" />
          <span className="text-white text-base drop-shadow-lg truncate">
            {musicAuthor ? `${musicAuthor} - ${musicTitle}` : musicTitle}
          </span>
        </button>
      )}
    </div>
  )
}
