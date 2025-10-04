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
  musicImageUrl,
  onClick,
  className
}: AudioSourceButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn('cursor-pointer group', className)}
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center overflow-hidden">
        {musicImageUrl ? (
          <img
            src={musicImageUrl}
            alt={musicTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <MusicNote className="w-6 h-6 text-white" weight="fill" />
        )}
      </div>
    </button>
  )
}
