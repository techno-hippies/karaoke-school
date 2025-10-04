import { MusicNote } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { AudioSourceButtonProps } from './types'

/**
 * AudioSourceButton - TikTok-style rotating audio disc
 * Shows music attribution and opens audio details sheet
 */
export function AudioSourceButton({
  musicTitle,
  musicAuthor,
  onClick,
  className
}: AudioSourceButtonProps) {
  const displayText = musicAuthor ? `${musicAuthor} - ${musicTitle}` : musicTitle

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center cursor-pointer group',
        className
      )}
    >
      {/* Rotating disc */}
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center animate-spin-slow group-hover:animate-spin">
          <MusicNote className="w-6 h-6 text-white" weight="fill" />
        </div>
      </div>

      {/* Music title - truncated */}
      <span className="text-white text-xs mt-2 max-w-[60px] truncate drop-shadow-lg">
        {displayText}
      </span>
    </button>
  )
}
