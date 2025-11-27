import { useState, useRef, memo } from 'react'
import { cn } from '@/lib/utils'
import { VideoPlayer } from './VideoPlayer'
import { KaraokeOverlay } from './KaraokeOverlay'
import { VideoActions } from './VideoActions'
import { VideoInfo } from './VideoInfo'
import { CommentSheet } from './CommentSheet'
import { ShareSheet } from './ShareSheet'
import { useVideoPlayback } from '@/hooks/useVideoPlayback'
import type { KaraokeLine, KaraokeWord, VideoPostData } from './types'

export interface VideoPostProps extends VideoPostData {
  onLikeClick?: () => void
  onCommentClick?: () => void
  onShareClick?: () => void
  onFollowClick?: () => void
  isFollowLoading?: boolean
  onProfileClick?: () => void
  onAudioClick?: () => void
  onSubscribe?: () => void | Promise<void>
  autoplay?: boolean // If true, attempt autoplay; if false, show paused
  priorityLoad?: boolean // If true, load immediately without debounce (for first video)
  className?: string
  karaokeClassName?: string // Optional className for karaoke overlay (e.g., to add padding when close button is present)
  hasMobileFooter?: boolean // If true, add bottom spacing for mobile footer (default: false)
}

/**
 * VideoPost - TikTok-style video post component
 * Clean architecture with separated concerns
 * Mobile: full-screen with overlays
 * Desktop: centered 9:16 video with actions to the right
 */
function VideoPostComponent({
  id,
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
  isFollowLoading = false,
  onProfileClick,
  onAudioClick,
  autoplay = true,
  priorityLoad = false,
  className,
  karaokeClassName,
  hasMobileFooter = false
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

  const safeAreaBottom = 'var(--safe-area-bottom)'
  const gradientBottomOffset = hasMobileFooter
    ? `calc(${safeAreaBottom} + 4rem)`
    : safeAreaBottom
  const gradientPaddingBottom = hasMobileFooter
    ? `calc(${safeAreaBottom} + 1.5rem)`
    : `calc(${safeAreaBottom} + 1rem)`
  const actionsBottomOffset = hasMobileFooter
    ? `calc(${safeAreaBottom} + 5rem)`
    : `calc(${safeAreaBottom} + 1rem)`

  return (
    <div className={cn(
      'relative h-vh-screen md:h-screen w-full bg-background snap-start flex items-center justify-center',
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
          priorityLoad={priorityLoad}
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
      <div
        className={cn(
          'md:hidden absolute left-0 right-0 p-6 pr-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-30'
        )}
        style={{ bottom: gradientBottomOffset, paddingBottom: gradientPaddingBottom }}
      >
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
      <div
        className="md:hidden absolute right-4 z-20"
        style={{ bottom: actionsBottomOffset }}
      >
        <VideoActions
          userAvatar={userAvatar || ''}
          username={username}
          isFollowing={isFollowing}
          canFollow={canInteract}
          isFollowLoading={isFollowLoading}
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
          isFollowLoading={isFollowLoading}
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
        postUrl={typeof window !== 'undefined' ? `${window.location.origin}/#/u/${username}/video/${id}` : ''}
        postDescription={`${username} got a ${grade || 'grade'} on ${musicTitle || 'karaoke'}`}
        onCopyLink={() => console.log('Link copied')}
        onDownload={() => console.log('Download video')}
      />
    </div>
  )
}

const areWordsEqual = (prevWords?: KaraokeWord[], nextWords?: KaraokeWord[]) => {
  if (prevWords === nextWords) return true
  if (!prevWords || !nextWords) return prevWords === nextWords
  if (prevWords.length !== nextWords.length) return false

  for (let i = 0; i < prevWords.length; i++) {
    const prevWord = prevWords[i]
    const nextWord = nextWords[i]
    if (
      prevWord.text !== nextWord.text ||
      prevWord.start !== nextWord.start ||
      prevWord.end !== nextWord.end ||
      prevWord.isSung !== nextWord.isSung
    ) {
      return false
    }
  }

  return true
}

const areKaraokeLinesEqual = (prevLines?: KaraokeLine[], nextLines?: KaraokeLine[]) => {
  if (prevLines === nextLines) return true
  if (!prevLines || !nextLines) return prevLines === nextLines
  if (prevLines.length !== nextLines.length) return false

  for (let i = 0; i < prevLines.length; i++) {
    const prevLine = prevLines[i]
    const nextLine = nextLines[i]
    if (
      prevLine.text !== nextLine.text ||
      prevLine.translation !== nextLine.translation ||
      prevLine.start !== nextLine.start ||
      prevLine.end !== nextLine.end
    ) {
      return false
    }

    if (!areWordsEqual(prevLine.words, nextLine.words)) {
      return false
    }
  }

  return true
}

const areVideoPostPropsEqual = (prev: VideoPostProps, next: VideoPostProps) => {
  if (prev === next) return true

  return (
    prev.id === next.id &&
    prev.videoUrl === next.videoUrl &&
    prev.thumbnailUrl === next.thumbnailUrl &&
    prev.username === next.username &&
    prev.userHandle === next.userHandle &&
    prev.userAvatar === next.userAvatar &&
    prev.authorAddress === next.authorAddress &&
    prev.grade === next.grade &&
    prev.description === next.description &&
    prev.musicTitle === next.musicTitle &&
    prev.musicAuthor === next.musicAuthor &&
    prev.musicImageUrl === next.musicImageUrl &&
    prev.artistSlug === next.artistSlug &&
    prev.songSlug === next.songSlug &&
    prev.spotifyTrackId === next.spotifyTrackId &&
    prev.tiktokVideoId === next.tiktokVideoId &&
    prev.createdAt === next.createdAt &&
    prev.likes === next.likes &&
    prev.comments === next.comments &&
    prev.shares === next.shares &&
    prev.isLiked === next.isLiked &&
    prev.isFollowing === next.isFollowing &&
    prev.isFollowLoading === next.isFollowLoading &&
    prev.canInteract === next.canInteract &&
    prev.autoplay === next.autoplay &&
    prev.priorityLoad === next.priorityLoad &&
    prev.className === next.className &&
    prev.karaokeClassName === next.karaokeClassName &&
    prev.hasMobileFooter === next.hasMobileFooter &&
    areKaraokeLinesEqual(prev.karaokeLines, next.karaokeLines)
  )
}

// Memoized export with granular prop comparison to ignore handler identity changes
export const VideoPost = memo(VideoPostComponent, areVideoPostPropsEqual)
