import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { VideoPlayer } from './VideoPlayer'
import { KaraokeOverlay } from './KaraokeOverlay'
import { VideoActions } from './VideoActions'
import { VideoInfo } from './VideoInfo'
import { CommentSheet } from './CommentSheet'
import { ShareSheet } from './ShareSheet'
import { useVideoPlayback } from '@/hooks/useVideoPlayback'
import type { VideoPostData } from './types'

export interface VideoPostProps extends VideoPostData {
  onLikeClick?: () => void
  onCommentClick?: () => void
  onShareClick?: () => void
  onFollowClick?: () => void
  onProfileClick?: () => void
  onAudioClick?: () => void
  onSubscribe?: () => void | Promise<void>
  autoplay?: boolean // If true, attempt autoplay; if false, show paused
  className?: string
  karaokeClassName?: string // Optional className for karaoke overlay (e.g., to add padding when close button is present)
}

/**
 * VideoPost - TikTok-style video post component
 * Clean architecture with separated concerns
 * Mobile: full-screen with overlays
 * Desktop: centered 9:16 video with actions to the right
 */
export function VideoPost({
  videoUrl,
  thumbnailUrl,
  username,
  userAvatar,
  grade,
  musicTitle,
  musicAuthor,
  musicImageUrl,
  likes,
  comments,
  shares,
  karaokeLines,
  isLiked = false,
  isFollowing = false,
  canInteract = false,
  onLikeClick,
  onCommentClick,
  onShareClick,
  onFollowClick,
  onProfileClick,
  onAudioClick,
  autoplay = true,
  className,
  karaokeClassName
}: VideoPostProps) {
  // Use shared video playback logic
  const {
    isPlaying,
    isMuted,
    currentTime,
    setIsMuted,
    handleTogglePlay,
    handlePlayFailed,
    handleTimeUpdate,
  } = useVideoPlayback({ autoplay })

  const [commentSheetOpen, setCommentSheetOpen] = useState(false)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  const handleCommentClick = () => {
    setCommentSheetOpen(true)
    onCommentClick?.()
  }

  const handleShareClick = () => {
    setShareSheetOpen(true)
    onShareClick?.()
  }

  return (
    <div className={cn(
      'relative h-screen w-full bg-background snap-start flex items-center justify-center',
      className
    )}>
      {/* Video Container - mobile: full screen, desktop: 9:16 centered */}
      <div
        ref={videoContainerRef}
        className="relative w-full h-full md:w-[50.625vh] md:h-[90vh] md:max-w-[450px] md:max-h-[800px] bg-background md:rounded-lg overflow-hidden"
      >
        {/* Video Player */}
        <VideoPlayer
          key={videoUrl || thumbnailUrl} // Force remount when video changes to prevent thumbnail flash
          videoUrl={videoUrl}
          thumbnailUrl={thumbnailUrl}
          isPlaying={isPlaying}
          isMuted={isMuted}
          onTogglePlay={handleTogglePlay}
          onPlayFailed={handlePlayFailed}
          onTimeUpdate={handleTimeUpdate}
        />

        {/* Karaoke Overlay - top-center lyrics */}
        {karaokeLines && karaokeLines.length > 0 && (
          <KaraokeOverlay
            lines={karaokeLines}
            currentTime={currentTime}
            className={karaokeClassName}
          />
        )}

        {/* Video Info - bottom-left (desktop only, mobile uses gradient overlay below) */}
        <div className="absolute bottom-4 left-6 right-20 z-20 max-md:hidden">
          <VideoInfo
            username={username}
            musicTitle={musicTitle}
            musicAuthor={musicAuthor}
            onUsernameClick={onProfileClick}
            onMusicClick={onAudioClick}
          />
        </div>
      </div>

      {/* Mobile: Bottom gradient + Video Info */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 p-6 pb-4 pr-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10">
        <VideoInfo
          username={username}
          musicTitle={musicTitle}
          musicAuthor={musicAuthor}
          onUsernameClick={onProfileClick}
          onMusicClick={onAudioClick}
          className="pointer-events-auto"
        />
      </div>

      {/* Mobile: Actions overlay on right side */}
      <div className="md:hidden absolute right-4 bottom-20 z-20">
        <VideoActions
          userAvatar={userAvatar || ''}
          username={username}
          isFollowing={isFollowing}
          canFollow={canInteract}
          onFollowClick={onFollowClick || (() => {})}
          onProfileClick={onProfileClick || (() => {})}
          likes={likes}
          comments={comments}
          shares={shares}
          isLiked={isLiked}
          canLike={canInteract}
          onLikeClick={onLikeClick || (() => {})}
          onCommentClick={handleCommentClick}
          onShareClick={handleShareClick}
          musicTitle={musicTitle}
          musicAuthor={musicAuthor}
          musicImageUrl={musicImageUrl}
          onAudioClick={onAudioClick}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
        />
      </div>

      {/* Desktop: Actions column to the right */}
      <div className="max-md:hidden absolute left-[calc(50%+25vh+20px)] top-1/2 transform -translate-y-1/2 z-20">
        <VideoActions
          userAvatar={userAvatar || ''}
          username={username}
          isFollowing={isFollowing}
          canFollow={canInteract}
          onFollowClick={onFollowClick || (() => {})}
          onProfileClick={onProfileClick || (() => {})}
          likes={likes}
          comments={comments}
          shares={shares}
          isLiked={isLiked}
          canLike={canInteract}
          onLikeClick={onLikeClick || (() => {})}
          onCommentClick={handleCommentClick}
          onShareClick={handleShareClick}
          musicTitle={musicTitle}
          musicAuthor={musicAuthor}
          musicImageUrl={musicImageUrl}
          onAudioClick={onAudioClick}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
        />
      </div>

      {/* Comment Sheet */}
      <CommentSheet
        open={commentSheetOpen}
        onOpenChange={setCommentSheetOpen}
        comments={[]}
        commentCount={comments}
        canComment={canInteract}
        onSubmitComment={async (content) => {
          console.log('Submit comment:', content)
          return true
        }}
      />

      {/* Share Sheet */}
      <ShareSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        postUrl={typeof window !== 'undefined' ? window.location.href : ''}
        postDescription={`${username} got a ${grade || 'grade'} on ${musicTitle || 'karaoke'}`}
        onCopyLink={() => console.log('Link copied')}
        onDownload={() => console.log('Download video')}
      />
    </div>
  )
}
