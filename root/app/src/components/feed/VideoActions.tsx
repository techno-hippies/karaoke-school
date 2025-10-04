import { Heart, ChatCircle, ShareFat, Plus, Check } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { AudioSourceButton } from './AudioSourceButton'
import type { VideoActionsProps } from './types'

/**
 * VideoActions - Vertical action buttons column
 * Profile avatar + follow, like, comment, share, audio source
 * Mobile: overlays on right side of video
 * Desktop: positioned to right of video container
 */
export function VideoActions({
  userAvatar,
  username,
  isFollowing,
  canFollow,
  onFollowClick,
  onProfileClick,
  likes,
  comments,
  shares,
  isLiked,
  canLike,
  onLikeClick,
  onCommentClick,
  onShareClick,
  musicTitle,
  musicAuthor,
  onAudioClick,
  className
}: VideoActionsProps) {
  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  return (
    <div className={cn('flex flex-col items-center gap-6', className)}>
      {/* Profile Avatar with Follow Button */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onProfileClick()
          }}
          className="w-12 h-12 rounded-full overflow-hidden cursor-pointer"
        >
          <img
            src={userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
            alt={username}
            className="w-full h-full object-cover"
          />
        </button>

        {/* Follow/Following Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (canFollow) onFollowClick()
          }}
          disabled={!canFollow}
          className={cn(
            'absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200',
            isFollowing
              ? 'bg-neutral-800 hover:bg-neutral-700'
              : 'bg-[#FE2C55] hover:bg-[#FF0F3F]',
            !canFollow && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isFollowing ? (
            <Check className="w-4 h-4 text-red-500" />
          ) : (
            <Plus className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      {/* Like Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (canLike) onLikeClick()
        }}
        disabled={!canLike}
        className="flex flex-col items-center cursor-pointer"
      >
        <div className={cn(
          'rounded-full p-3 backdrop-blur-sm transition-colors',
          isLiked ? 'bg-red-500/20' : 'bg-neutral-800/50'
        )}>
          <Heart
            className={cn(
              'w-7 h-7 transition-colors',
              isLiked ? 'text-red-500' : 'text-white'
            )}
            weight="fill"
          />
        </div>
        <span className={cn(
          'text-xs mt-1',
          isLiked ? 'text-red-500' : 'text-white'
        )}>
          {formatCount(likes)}
        </span>
      </button>

      {/* Comment Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onCommentClick()
        }}
        className="flex flex-col items-center cursor-pointer"
      >
        <div className="rounded-full p-3 bg-neutral-800/50 backdrop-blur-sm hover:bg-neutral-700/50 transition-colors">
          <ChatCircle className="w-7 h-7 text-white" weight="fill" />
        </div>
        <span className="text-white text-xs mt-1">
          {formatCount(comments)}
        </span>
      </button>

      {/* Share Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onShareClick()
        }}
        className="flex flex-col items-center cursor-pointer"
      >
        <div className="rounded-full p-3 bg-neutral-800/50 backdrop-blur-sm hover:bg-neutral-700/50 transition-colors">
          <ShareFat className="w-7 h-7 text-white" weight="fill" />
        </div>
        <span className="text-white text-xs mt-1">
          {formatCount(shares)}
        </span>
      </button>

      {/* Audio Source Button */}
      <AudioSourceButton
        musicTitle={musicTitle}
        musicAuthor={musicAuthor}
        onClick={onAudioClick}
      />
    </div>
  )
}
