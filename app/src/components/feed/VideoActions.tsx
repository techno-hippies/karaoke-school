import { Heart, ChatCircle, ShareFat, Plus, Check, SpeakerHigh, SpeakerX } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { AudioSourceButton } from './AudioSourceButton'
import type { VideoActionsProps } from './types'

/**
 * VideoActions - Vertical action buttons column
 * Profile avatar + follow, like, comment, share, mute, audio source
 * Mobile: overlays on right side of video
 * Desktop: positioned to right of video container
 */
export function VideoActions({
  userAvatar,
  username,
  isFollowing,
  canFollow,
  isFollowLoading = false,
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
  musicImageUrl,
  onAudioClick,
  isMuted,
  onToggleMute,
  className
}: VideoActionsProps) {
  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  return (
    <div className={cn('flex flex-col items-center gap-4 md:gap-6', className)}>
      {/* Mute/Unmute Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleMute()
        }}
        className="flex flex-col items-center cursor-pointer"
      >
        <div className="rounded-full p-3 max-md:bg-transparent md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50 transition-colors">
          {isMuted ? (
            <SpeakerX className="w-7 h-7 text-foreground" />
          ) : (
            <SpeakerHigh className="w-7 h-7 text-foreground" />
          )}
        </div>
      </button>

      {/* Profile Avatar with Follow Button */}
      <div className="relative flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onProfileClick()
          }}
          className="cursor-pointer"
        >
          <img
            src={userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
            alt={username}
            className="w-12 h-12 rounded-full object-cover bg-white"
          />
        </button>


        {/* Follow/Following Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (canFollow && !isFollowLoading) onFollowClick()
          }}
          disabled={!canFollow || isFollowLoading}
          className={cn(
            'absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200',
            isFollowing && !isFollowLoading
              ? 'bg-neutral-800 hover:bg-neutral-700'
              : 'bg-primary hover:bg-primary/90',
            (!canFollow || isFollowLoading) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isFollowLoading ? (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : isFollowing ? (
            <Check className="w-4 h-4 text-primary" />
          ) : (
            <Plus className="w-4 h-4 text-foreground" />
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
          'rounded-full p-3 transition-colors',
          'max-md:bg-transparent',
          isLiked
            ? 'md:bg-red-500/20 md:hover:bg-red-500/30'
            : 'md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50'
        )}>
          <Heart
            className={cn(
              'w-7 h-7 transition-colors',
              isLiked ? 'text-red-500' : 'text-foreground'
            )}
            weight="fill"
          />
        </div>
        <span className={cn(
          'text-xs max-md:mt-0 md:mt-1',
          isLiked ? 'text-red-500' : 'text-foreground'
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
        <div className="rounded-full p-3 max-md:bg-transparent md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50 transition-colors">
          <ChatCircle className="w-7 h-7 text-foreground" weight="fill" />
        </div>
        <span className="text-foreground text-xs max-md:mt-0 md:mt-1">
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
        <div className="rounded-full p-3 max-md:bg-transparent md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50 transition-colors">
          <ShareFat className="w-7 h-7 text-foreground" weight="fill" />
        </div>
        <span className="text-foreground text-xs max-md:mt-0 md:mt-1">
          {formatCount(shares)}
        </span>
      </button>

      {/* Audio Source Button - only show when music info is available */}
      {(musicTitle || musicAuthor) && (
        <AudioSourceButton
          musicTitle={musicTitle}
          musicAuthor={musicAuthor}
          musicImageUrl={musicImageUrl}
          onClick={onAudioClick}
        />
      )}
    </div>
  )
}
