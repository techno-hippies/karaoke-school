import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CaretUp, CaretDown, Heart, Exam, ShareFat, MusicNote } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { VideoPost } from './VideoPost'
import { VideoPlayer } from './VideoPlayer'
import { KaraokeOverlay } from './KaraokeOverlay'
import { ShareSheet } from './ShareSheet'
import { useVideoPlayback } from '@/hooks/useVideoPlayback'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { VideoPostData } from './types'

export interface VideoDetailProps extends VideoPostData {
  // Handlers
  onLikeClick?: () => void
  onShareClick?: () => void
  onFollowClick?: () => void
  isFollowLoading?: boolean
  onProfileClick?: () => void
  onAudioClick?: () => void
  onClose?: () => void

  // Navigation
  currentVideoIndex?: number
  totalVideos?: number
  onNavigatePrevious?: () => void
  onNavigateNext?: () => void

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
  className,
  ...videoPostProps
}: VideoDetailProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Use shared video playback logic (force autoplay on detail view)
  const {
    isPlaying,
    isMuted,
    currentTime,
    handleTogglePlay,
    handlePlayFailed,
    handleTimeUpdate: onTimeUpdate,
  } = useVideoPlayback({ autoplay: true, forceAutoplay: true })

  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Study navigation - only available when song data exists
  const canStudy = !!(videoPostProps.artistSlug && videoPostProps.songSlug)
  const handleStudyClick = () => {
    if (canStudy) {
      navigate(`/${videoPostProps.artistSlug}/${videoPostProps.songSlug}/study`)
    }
  }

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

  const handleShareClick = () => {
    setShareSheetOpen(true)
    videoPostProps.onShareClick?.()
  }

  const handleCopyLink = () => {
    toast.success(t('share.linkCopied'))
  }

  const handleDownloadVideo = async () => {
    if (!videoPostProps.videoUrl) return

    try {
      // Fetch the video as a blob
      const response = await fetch(videoPostProps.videoUrl)
      if (!response.ok) throw new Error('Failed to fetch video')

      const blob = await response.blob()

      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `karaoke-${videoPostProps.username}-${videoPostProps.id}.mp4`

      // Trigger download
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(t('share.downloadStarted'))
    } catch (error) {
      console.error('Failed to download video:', error)
      toast.error('Failed to download video')
    }
  }

  // Mobile: Use VideoPost for full-screen TikTok experience
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return (
      <div className="fixed inset-0 z-50">
        <VideoPost
          {...videoPostProps}
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

        {/* Share Sheet */}
        <ShareSheet
          open={shareSheetOpen}
          onOpenChange={setShareSheetOpen}
          postUrl={typeof window !== 'undefined' ? `${window.location.origin}/#/u/${videoPostProps.username}/video/${videoPostProps.id}` : ''}
          postDescription={videoPostProps.description}
          onCopyLink={handleCopyLink}
          onDownload={handleDownloadVideo}
        />
      </div>
    )
  }

  // Desktop: Video left, sidebar right
  return (
    <div className={cn('fixed inset-0 bg-background z-50 flex overflow-hidden', className)}>
      {/* Video Area - Left Side */}
      <div className="flex-1 relative bg-background flex items-center justify-center overflow-hidden">
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
          className="relative bg-background rounded-lg overflow-hidden cursor-pointer"
          style={{ height: '90vh', width: 'calc(90vh * 9 / 16)', maxWidth: '100%' }}
          onClick={handleTogglePlay}
        >
          {/* Video Player */}
          <VideoPlayer
            videoUrl={videoPostProps.videoUrl}
            thumbnailUrl={videoPostProps.thumbnailUrl}
            isPlaying={isPlaying}
            isMuted={isMuted}
            onTogglePlay={handleTogglePlay}
            onPlayFailed={handlePlayFailed}
            onTimeUpdate={onTimeUpdate}
          />

          {/* Karaoke Overlay */}
          {videoPostProps.karaokeLines && videoPostProps.karaokeLines.length > 0 && (
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
      <div className="w-[560px] bg-card flex flex-col h-full border-l border-border">
        {/* Profile Section */}
        <div className="p-4 border-b border-border">
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
        <div className="p-4 border-b border-border">
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
        <div className="p-4 border-b border-border">
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
                  : 'bg-muted/50 group-hover:bg-accent/50'
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

            {/* Study - only show when song data is available */}
            {canStudy && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleStudyClick()
                }}
                className="flex items-center gap-2 group"
              >
                <div className="rounded-full p-2 bg-muted/50 group-hover:bg-accent/50 transition-colors">
                  <Exam className="w-6 h-6 text-foreground" weight="fill" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {t('nav.study')}
                </span>
              </button>
            )}

            {/* Share */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleShareClick()
              }}
              className="flex items-center gap-2 group"
            >
              <div className="rounded-full p-2 bg-muted/50 group-hover:bg-accent/50 transition-colors">
                <ShareFat className="w-6 h-6 text-foreground" weight="fill" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatCount(videoPostProps.shares)}
              </span>
            </button>
          </div>
        </div>

        {/* Study CTA Section */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {canStudy ? (
            <div className="text-center space-y-4">
              <Exam className="w-16 h-16 text-primary mx-auto" weight="fill" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">
                  {t('study.learnThisSong')}
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {t('study.practiceDescription')}
                </p>
              </div>
              <Button size="lg" onClick={handleStudyClick}>
                {t('study.startStudying')}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-muted-foreground text-sm">
                {t('study.notAvailable')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Share Sheet (desktop) */}
      <ShareSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        postUrl={typeof window !== 'undefined' ? `${window.location.origin}/#/u/${videoPostProps.username}/video/${videoPostProps.id}` : ''}
        postDescription={videoPostProps.description}
        onCopyLink={handleCopyLink}
        onDownload={handleDownloadVideo}
      />
    </div>
  )
}
