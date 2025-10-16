import { useState, useRef, useEffect } from 'react'
import { X, CaretUp, CaretDown, Play, MusicNote, Heart, ChatCircle, ShareFat } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { VideoPost } from './VideoPost'
import { VideoPlayer } from './VideoPlayer'
import { HLSPlayer } from '../video/HLSPlayer'
import { KaraokeOverlay } from './KaraokeOverlay'
import { CommentSheet } from './CommentSheet'
import { ShareSheet } from './ShareSheet'
import { SubscribeCard } from '../profile/SubscribeCard'
import { Comment, type CommentData } from './Comment'
import { CommentInput } from './CommentInput'
import type { VideoPostData } from './types'

export interface VideoDetailProps extends VideoPostData {
  // Handlers
  onLikeClick?: () => void
  onCommentClick?: () => void
  onShareClick?: () => void
  onFollowClick?: () => void
  onProfileClick?: () => void
  onAudioClick?: () => void
  onClose?: () => void
  onSubscribe?: () => void | Promise<void>

  // Navigation
  currentVideoIndex?: number
  totalVideos?: number
  onNavigatePrevious?: () => void
  onNavigateNext?: () => void

  // Comment data
  commentsData?: CommentData[]
  onSubmitComment?: (content: string) => Promise<boolean>
  onLikeComment?: (commentId: string) => void
  isCommentsLoading?: boolean
  isCommentSubmitting?: boolean

  className?: string
}

/**
 * VideoDetail - Full-screen video detail view
 *
 * Mobile: Delegates to VideoPost (TikTok-style full-screen)
 * Desktop: Video left, sidebar right (TikTok desktop pattern)
 *
 * Used by: Feed (click video), Profile (click grid), Search, etc.
 * Provides consistent video viewing experience across the app
 */
export function VideoDetail({
  onClose,
  currentVideoIndex,
  totalVideos,
  onNavigatePrevious,
  onNavigateNext,
  commentsData = [],
  onSubmitComment,
  onLikeComment,
  isCommentsLoading = false,
  isCommentSubmitting = false,
  className,
  ...videoPostProps
}: VideoDetailProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [commentSheetOpen, setCommentSheetOpen] = useState(false)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Format engagement counts
  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && onNavigatePrevious) {
        e.preventDefault()
        onNavigatePrevious()
      } else if (e.key === 'ArrowDown' && onNavigateNext) {
        e.preventDefault()
        onNavigateNext()
      } else if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onNavigatePrevious, onNavigateNext, onClose])

  // Track video time for karaoke
  useEffect(() => {
    if (!videoContainerRef.current) return

    const video = videoContainerRef.current.querySelector('video')
    if (!video) return

    const updateTime = () => setCurrentTime(video.currentTime)
    video.addEventListener('timeupdate', updateTime)
    return () => video.removeEventListener('timeupdate', updateTime)
  }, [])

  // Auto-play when component mounts
  useEffect(() => {
    setIsPlaying(true)
    // Try to unmute (will work if user clicked to navigate here)
    // If blocked by browser, user's first click will unmute
    setIsMuted(false)
  }, [])

  // Handlers must be defined BEFORE any conditional returns
  const handleCommentClick = () => {
    setCommentSheetOpen(true)
    videoPostProps.onCommentClick?.()
  }

  const handleShareClick = () => {
    setShareSheetOpen(true)
    videoPostProps.onShareClick?.()
  }

  const togglePlayPause = () => {
    console.log('[VideoDetail] togglePlayPause called, current isPlaying:', isPlaying, 'isMuted:', isMuted)

    // If playing but muted, unmute instead of pausing
    if (isPlaying && isMuted) {
      console.log('[VideoDetail] Video is muted, unmuting instead of pausing')
      setIsMuted(false)
      return
    }

    // Otherwise, toggle play state
    const newPlayingState = !isPlaying
    setIsPlaying(newPlayingState)
    console.log('[VideoDetail] Setting isPlaying to:', newPlayingState)

    // Unmute when starting to play
    if (newPlayingState && isMuted) {
      console.log('[VideoDetail] Unmuting video on play')
      setIsMuted(false)
    }
  }

  // Mobile: Use VideoPost for full-screen TikTok experience
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return (
      <div className="fixed inset-0 z-50">
        <VideoPost
          {...videoPostProps}
          onCommentClick={handleCommentClick}
          onShareClick={handleShareClick}
          karaokeClassName="pt-16"
        />

        {/* Close button - top left */}
        {onClose && (
          <Button
            variant="ghost"
            size="lg"
            onClick={onClose}
            className="absolute top-4 left-4 z-[100] w-12 px-0 text-foreground hover:bg-black/30 hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-6 h-6" weight="regular" />
          </Button>
        )}

        {/* Comment Sheet */}
        <CommentSheet
          open={commentSheetOpen}
          onOpenChange={setCommentSheetOpen}
          comments={commentsData}
          commentCount={videoPostProps.comments}
          canComment={videoPostProps.canInteract || false}
          isLoading={isCommentsLoading}
          isSubmitting={isCommentSubmitting}
          onSubmitComment={onSubmitComment}
          onLikeComment={onLikeComment}
        />

        {/* Share Sheet */}
        <ShareSheet
          open={shareSheetOpen}
          onOpenChange={setShareSheetOpen}
          postUrl={typeof window !== 'undefined' ? window.location.href : ''}
          postDescription={videoPostProps.description}
        />
      </div>
    )
  }

  // Desktop: Video left, sidebar right
  return (
    <div className={cn('fixed inset-0 bg-neutral-900 z-50 flex overflow-hidden', className)}>
      {/* Video Area - Left Side */}
      <div className="flex-1 relative bg-neutral-900 flex items-center justify-center overflow-hidden">
        {/* Close button - Top Left */}
        {onClose && (
          <Button
            variant="ghost"
            size="lg"
            onClick={onClose}
            className="absolute top-4 left-4 z-10 w-12 px-0 text-foreground hover:bg-black/30 hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-6 h-6" weight="regular" />
          </Button>
        )}

        {/* Video Container - 9:16 aspect ratio, centered */}
        <div
          ref={videoContainerRef}
          className={cn(
            "relative bg-neutral-900 rounded-lg overflow-hidden",
            !(videoPostProps.isPremium && !videoPostProps.userIsSubscribed) && "cursor-pointer"
          )}
          style={{ height: '90vh', width: 'calc(90vh * 9 / 16)', maxWidth: '100%' }}
          onClick={videoPostProps.isPremium && !videoPostProps.userIsSubscribed ? undefined : togglePlayPause}
        >
          {/* Video Player - Use HLS player for encrypted videos if user is subscribed */}
          {videoPostProps.isPremium &&
           videoPostProps.userIsSubscribed &&
           videoPostProps.encryption &&
           videoPostProps.hlsMetadata &&
           videoPostProps.pkpInfo &&
           videoPostProps.authData ? (
            <HLSPlayer
              playlistUrl={videoPostProps.videoUrl || ''}
              thumbnailUrl={videoPostProps.thumbnailUrl}
              hlsMetadata={videoPostProps.hlsMetadata}
              encryption={videoPostProps.encryption}
              pkpInfo={videoPostProps.pkpInfo}
              authData={videoPostProps.authData}
              autoPlay={isPlaying}
              muted={isMuted}
              controls={false}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(error) => {
                console.error('[VideoDetail] HLS playback error:', error)
              }}
              onTimeUpdate={setCurrentTime}
            />
          ) : (
            <VideoPlayer
              videoUrl={videoPostProps.videoUrl}
              thumbnailUrl={videoPostProps.thumbnailUrl}
              isPlaying={isPlaying}
              isMuted={isMuted}
              onTogglePlay={togglePlayPause}
              onPlayFailed={() => {
                // When autoplay fails (e.g., Chrome blocking), set isPlaying to false
                // so the play button overlay appears
                console.log('[VideoDetail] Autoplay failed, showing play button')
                setIsPlaying(false)
              }}
              forceShowThumbnail={videoPostProps.isPremium && !videoPostProps.userIsSubscribed}
            />
          )}

          {/* Play/Pause Overlay - only show when paused and not locked */}
          {videoPostProps.videoUrl && !isPlaying && !(videoPostProps.isPremium && !videoPostProps.userIsSubscribed) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-200 pointer-events-none">
              <div className="w-20 h-20 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Play className="w-10 h-10 text-foreground ml-1" weight="fill" />
              </div>
            </div>
          )}

          {/* Premium Lock Overlay - show when video is locked (but not while subscription status is loading) */}
          {videoPostProps.isPremium && !videoPostProps.userIsSubscribed && !videoPostProps.isSubscriptionLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-30 pointer-events-auto">
              <SubscribeCard
                username={videoPostProps.username}
                userAvatar={videoPostProps.userAvatar}
                onSubscribe={videoPostProps.onSubscribe}
                isLoading={videoPostProps.isSubscribing}
                className="bg-card/90 rounded-lg px-6 py-6 w-[calc(100%-2rem)] max-w-md mx-auto"
              />
            </div>
          )}

          {/* Karaoke Overlay */}
          {videoPostProps.karaokeLines && videoPostProps.karaokeLines.length > 0 && !(videoPostProps.isPremium && !videoPostProps.userIsSubscribed) && (
            <KaraokeOverlay
              lines={videoPostProps.karaokeLines}
              currentTime={currentTime}
            />
          )}
        </div>

        {/* Navigation Controls - Vertically centered on right side */}
        {totalVideos && totalVideos > 1 && (
          <div className="absolute top-1/2 right-4 transform -translate-y-1/2 z-10 flex flex-col items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigatePrevious}
              disabled={currentVideoIndex === 0}
              className="bg-black/50 backdrop-blur-sm hover:bg-black/70"
              aria-label="Previous video"
            >
              <CaretUp className="w-5 h-5" weight="bold" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateNext}
              disabled={currentVideoIndex === (totalVideos - 1)}
              className="bg-black/50 backdrop-blur-sm hover:bg-black/70"
              aria-label="Next video"
            >
              <CaretDown className="w-5 h-5" weight="bold" />
            </Button>
          </div>
        )}
      </div>

      {/* Right Sidebar - Fixed Width */}
      <div className="w-[560px] bg-neutral-900 flex flex-col h-full border-l border-neutral-800">
        {/* Profile Section */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  videoPostProps.onProfileClick?.()
                }}
                className="flex-shrink-0 hover:scale-105 transition-transform"
              >
                <img
                  src={videoPostProps.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${videoPostProps.username}`}
                  alt={videoPostProps.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              </button>
              <div className="min-w-0 flex-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    videoPostProps.onProfileClick?.()
                  }}
                  className="hover:underline text-left block"
                >
                  <h3 className="font-semibold text-base text-foreground truncate">
                    {videoPostProps.username}
                  </h3>
                </button>
                <p className="text-sm text-muted-foreground truncate">
                  {videoPostProps.userHandle && (
                    <>
                      {videoPostProps.userHandle}
                      {videoPostProps.createdAt && <span> · </span>}
                    </>
                  )}
                  {videoPostProps.createdAt && (
                    <span>{videoPostProps.createdAt}</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                if (videoPostProps.canInteract) videoPostProps.onFollowClick?.()
              }}
              disabled={!videoPostProps.canInteract}
              variant={videoPostProps.isFollowing ? 'secondary' : 'default'}
              size="sm"
            >
              {videoPostProps.isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>
        </div>

        {/* Description & Music Section */}
        <div className="p-4 border-b border-neutral-800">
          <p className="text-foreground leading-relaxed mb-3 whitespace-pre-wrap">
            {videoPostProps.description}
          </p>
          {videoPostProps.musicTitle && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                videoPostProps.onAudioClick?.()
              }}
              className="flex items-center text-muted-foreground hover:text-foreground hover:underline transition-colors cursor-pointer"
            >
              <MusicNote className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="text-sm truncate">
                {videoPostProps.musicTitle}
                {videoPostProps.musicAuthor && ` - ${videoPostProps.musicAuthor}`}
              </span>
            </button>
          )}
        </div>

        {/* Engagement Section */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center gap-6">
            {/* Like */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (videoPostProps.canInteract) videoPostProps.onLikeClick?.()
              }}
              disabled={!videoPostProps.canInteract}
              className="flex items-center gap-2 group"
            >
              <div className={cn(
                'rounded-full p-2 transition-colors',
                videoPostProps.isLiked
                  ? 'bg-red-500/20'
                  : 'bg-neutral-800/50 group-hover:bg-neutral-700/50'
              )}>
                <Heart
                  className={cn(
                    'w-6 h-6',
                    videoPostProps.isLiked ? 'text-red-500' : 'text-foreground'
                  )}
                  weight="fill"
                />
              </div>
              <span className={cn(
                'text-sm font-medium',
                videoPostProps.isLiked ? 'text-red-500' : 'text-foreground'
              )}>
                {formatCount(videoPostProps.likes)}
              </span>
            </button>

            {/* Comment */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Comments are shown in sidebar, no need for sheet on desktop
              }}
              className="flex items-center gap-2 group"
            >
              <div className="rounded-full p-2 bg-neutral-800/50 group-hover:bg-neutral-700/50 transition-colors">
                <ChatCircle className="w-6 h-6 text-foreground" weight="fill" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatCount(videoPostProps.comments)}
              </span>
            </button>

            {/* Share */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleShareClick()
              }}
              className="flex items-center gap-2 group"
            >
              <div className="rounded-full p-2 bg-neutral-800/50 group-hover:bg-neutral-700/50 transition-colors">
                <ShareFat className="w-6 h-6 text-foreground" weight="fill" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatCount(videoPostProps.shares)}
              </span>
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-neutral-800">
            <h3 className="font-semibold text-base text-foreground">
              Comments {videoPostProps.comments > 0 && `(${videoPostProps.comments})`}
            </h3>
          </div>

          {/* Comments List - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isCommentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-muted-foreground text-sm">Loading comments...</span>
              </div>
            ) : commentsData.length > 0 ? (
              commentsData.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  onLike={onLikeComment}
                />
              ))
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground text-center text-sm">
                  No comments yet. Be the first!
                </p>
              </div>
            )}
          </div>

          {/* Comment Input - Sticky at bottom */}
          <div className="border-t border-neutral-800">
            <CommentInput
              onSubmit={(content) => {
                if (onSubmitComment) {
                  onSubmitComment(content)
                }
              }}
              disabled={!videoPostProps.canInteract || isCommentSubmitting}
              placeholder={
                videoPostProps.canInteract ? 'Add a comment...' : 'Sign in to comment'
              }
            />
          </div>
        </div>
      </div>

      {/* Share Sheet (desktop) */}
      <ShareSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        postUrl={typeof window !== 'undefined' ? window.location.href : ''}
        postDescription={videoPostProps.description}
      />
    </div>
  )
}
