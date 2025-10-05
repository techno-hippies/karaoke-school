import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { VideoPlayer } from './VideoPlayer'
import { KaraokeOverlay } from './KaraokeOverlay'
import { VideoActions } from './VideoActions'
import { VideoInfo } from './VideoInfo'
import { CommentSheet } from './CommentSheet'
import { ShareSheet } from './ShareSheet'
import type { VideoPostData } from './types'

export interface VideoPostProps extends VideoPostData {
  onLikeClick?: () => void
  onCommentClick?: () => void
  onShareClick?: () => void
  onFollowClick?: () => void
  onProfileClick?: () => void
  onAudioClick?: () => void
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
  description,
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
  className,
  karaokeClassName
}: VideoPostProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
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

  // Track video time for karaoke
  useEffect(() => {
    if (!videoContainerRef.current) return

    const video = videoContainerRef.current.querySelector('video')
    if (!video) return

    const updateTime = () => setCurrentTime(video.currentTime)
    video.addEventListener('timeupdate', updateTime)
    return () => video.removeEventListener('timeupdate', updateTime)
  }, [])

  return (
    <div className={cn(
      'relative h-screen w-full bg-neutral-900 snap-start flex items-center justify-center',
      className
    )}>
      {/* Video Container - mobile: full screen, desktop: 9:16 centered */}
      <div
        ref={videoContainerRef}
        className="relative w-full h-full md:w-[50.625vh] md:h-[90vh] md:max-w-[450px] md:max-h-[800px] bg-neutral-900 md:rounded-lg overflow-hidden"
      >
        {/* Video Player */}
        <VideoPlayer
          videoUrl={videoUrl}
          thumbnailUrl={thumbnailUrl}
          isPlaying={isPlaying}
          isMuted={isMuted}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
        />

        {/* Karaoke Overlay - top-center lyrics */}
        {karaokeLines && karaokeLines.length > 0 && (
          <KaraokeOverlay
            lines={karaokeLines}
            currentTime={currentTime}
            className={karaokeClassName}
          />
        )}

        {/* Video Info - bottom-left (desktop only, inside video) - username + caption + music */}
        <div className="max-md:hidden absolute bottom-4 left-6 right-20 z-20">
          <VideoInfo
            username={username}
            description={description}
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
          description={description}
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
        postDescription={description}
        onCopyLink={() => console.log('Link copied')}
        onDownload={() => console.log('Download video')}
      />
    </div>
  )
}
