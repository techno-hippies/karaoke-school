import { Show, createEffect, createMemo, type Component } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { VideoPlayer } from './VideoPlayer'
import { VideoActions } from './VideoActions'
import { useVideoPlayback } from '@/hooks/useVideoPlayback'
import { toast } from 'solid-sonner'
import { Icon } from '@/components/icons'
import { useTranslation } from '@/lib/i18n'
import { getLocalizedTitle, getLocalizedArtist } from '@/lib/localize-metadata'
import type { VideoPostData } from './types'

export interface VideoPostProps extends VideoPostData {
  onLikeClick?: () => void
  onShareClick?: () => void
  onProfileClick?: () => void
  onAudioClick?: () => void
  autoplay?: boolean
  priorityLoad?: boolean
  class?: string
  hasMobileFooter?: boolean
  /** Show back button (for single video mode) */
  showBackButton?: boolean
  /** Back button click handler */
  onBack?: () => void
  /** Called when video has been watched for 3+ seconds */
  onViewed?: (postId: string) => void
}

/**
 * VideoPost - TikTok-style video post component (SolidJS)
 * Mobile: Full-screen with overlays
 * Desktop: Centered 9:16 card with actions
 */
export const VideoPost: Component<VideoPostProps> = (props) => {
  const navigate = useNavigate()
  const { uiLanguage } = useTranslation()

  // Localized music title and author (12 languages)
  const localizedMusicTitle = createMemo(() =>
    getLocalizedTitle({
      title: props.musicTitle,
      title_zh: props.musicTitle_zh,
      title_vi: props.musicTitle_vi,
      title_id: props.musicTitle_id,
      title_ja: props.musicTitle_ja,
      title_ko: props.musicTitle_ko,
      title_es: props.musicTitle_es,
      title_pt: props.musicTitle_pt,
      title_ar: props.musicTitle_ar,
      title_tr: props.musicTitle_tr,
      title_ru: props.musicTitle_ru,
      title_hi: props.musicTitle_hi,
      title_th: props.musicTitle_th,
    }, uiLanguage()) || props.musicTitle
  )

  const localizedMusicAuthor = createMemo(() =>
    getLocalizedArtist({
      artist: props.musicAuthor,
      artist_zh: props.musicAuthor_zh,
      artist_vi: props.musicAuthor_vi,
      artist_id: props.musicAuthor_id,
      artist_ja: props.musicAuthor_ja,
      artist_ko: props.musicAuthor_ko,
      artist_es: props.musicAuthor_es,
      artist_pt: props.musicAuthor_pt,
      artist_ar: props.musicAuthor_ar,
      artist_tr: props.musicAuthor_tr,
      artist_ru: props.musicAuthor_ru,
      artist_hi: props.musicAuthor_hi,
      artist_th: props.musicAuthor_th,
    }, uiLanguage()) || props.musicAuthor
  )

  // Pass autoplay as getter for reactivity - critical for scroll behavior
  const {
    isPlaying,
    isMuted,
    currentTime,
    setIsMuted,
    handleTogglePlay,
    handlePlayFailed,
    handleTimeUpdate,
  } = useVideoPlayback({
    autoplay: () => props.autoplay ?? true
  })

  // Track view: call onViewed after 3 seconds of watch time
  let hasMarkedViewed = false
  let watchTime = 0
  let lastTime = 0
  let trackedPostId = ''

  createEffect(() => {
    // Reset when post changes
    if (props.id !== trackedPostId) {
      hasMarkedViewed = false
      watchTime = 0
      lastTime = 0
      trackedPostId = props.id
    }
  })

  createEffect(() => {
    if (hasMarkedViewed || !isPlaying() || !props.onViewed) return

    const time = currentTime()
    const delta = time - lastTime

    // Only count small forward progress (normal playback, not seeks)
    if (delta > 0 && delta < 1) {
      watchTime += delta
    }
    lastTime = time

    if (watchTime >= 3) {
      hasMarkedViewed = true
      props.onViewed(props.id)
    }
  })

  // Study navigation
  const canStudy = () => !!(props.artistSlug && props.songSlug)

  const handleStudyClick = () => {
    if (canStudy()) {
      navigate(`/${props.artistSlug}/${props.songSlug}/study`)
    }
  }

  const handleShareClick = () => {
    const url = `${window.location.origin}/#/u/${props.username}/video/${props.id}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied!')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
    props.onShareClick?.()
  }

  const handleAudioClick = () => {
    // Navigate to song page if we have the data
    if (props.artistSlug && props.songSlug) {
      navigate(`/${props.artistSlug}/${props.songSlug}`)
    } else if (props.spotifyTrackId) {
      navigate(`/song/${props.spotifyTrackId}`)
    }
    props.onAudioClick?.()
  }

  // Safe area calculations for mobile footer
  const safeAreaBottom = 'var(--safe-area-bottom, 0px)'
  const actionsBottomOffset = props.hasMobileFooter
    ? `calc(${safeAreaBottom} + 5rem)`
    : `calc(${safeAreaBottom} + 1rem)`
  const infoBottomOffset = props.hasMobileFooter
    ? `calc(${safeAreaBottom} + 4rem)`
    : safeAreaBottom

  return (
    <div class={`relative h-vh-screen md:h-screen w-full bg-background snap-start flex items-center justify-center ${props.class || ''}`}>
      {/* Back button - shown in single video mode */}
      <Show when={props.showBackButton}>
        <button
          onClick={() => props.onBack?.()}
          class="absolute top-4 left-4 z-50 w-10 h-10 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        >
          <Icon name="caret-left" class="text-2xl text-white" />
        </button>
      </Show>

      {/* Video Container - responsive sizing */}
      <div class="relative w-full h-full md:w-[50.625vh] md:h-[90vh] md:max-w-[450px] md:max-h-[800px] bg-background md:rounded-lg overflow-hidden">
        {/* Video Player */}
        <VideoPlayer
          videoUrl={props.videoUrl}
          thumbnailUrl={props.thumbnailUrl}
          isPlaying={isPlaying()}
          isMuted={isMuted()}
          onTogglePlay={handleTogglePlay}
          onPlayFailed={handlePlayFailed}
          onTimeUpdate={handleTimeUpdate}
          priorityLoad={props.priorityLoad}
        />

        {/* Desktop: Video Info Overlay - bottom left (inside video container) */}
        <div class="absolute bottom-4 left-6 right-20 z-20 pointer-events-none max-md:hidden">
          <button
            onClick={() => props.onProfileClick?.()}
            class="text-lg font-semibold text-white drop-shadow-lg hover:underline cursor-pointer pointer-events-auto"
          >
            @{props.username}
          </button>
          <Show when={localizedMusicTitle()}>
            <button
              onClick={handleAudioClick}
              class="block text-base text-white/80 mt-1 hover:underline cursor-pointer pointer-events-auto"
            >
              {localizedMusicTitle()} - {localizedMusicAuthor()}
            </button>
          </Show>
        </div>
      </div>

      {/* Mobile: Video Info - absolute positioned outside container */}
      <div
        class="md:hidden absolute left-0 right-0 p-6 pr-20 pointer-events-none z-40"
        style={{ bottom: infoBottomOffset }}
      >
        <button
          onClick={() => props.onProfileClick?.()}
          class="text-lg font-semibold text-white drop-shadow-lg hover:underline cursor-pointer pointer-events-auto"
        >
          @{props.username}
        </button>
        <Show when={localizedMusicTitle()}>
          <button
            onClick={handleAudioClick}
            class="block text-base text-white/80 mt-1 hover:underline cursor-pointer pointer-events-auto"
          >
            {localizedMusicTitle()} - {localizedMusicAuthor()}
          </button>
        </Show>
      </div>

      {/* Mobile: Actions overlay on right side */}
      <div
        class="md:hidden absolute right-4 z-40"
        style={{ bottom: actionsBottomOffset }}
      >
        <VideoActions
          username={props.username}
          userAvatar={props.userAvatar}
          onProfileClick={() => props.onProfileClick?.()}
          isLiked={props.isLiked ?? false}
          onLikeClick={() => props.onLikeClick?.()}
          onShareClick={handleShareClick}
          canStudy={canStudy()}
          onStudyClick={handleStudyClick}
          musicTitle={localizedMusicTitle()}
          musicAuthor={localizedMusicAuthor()}
          musicImageUrl={props.musicImageUrl}
          onAudioClick={handleAudioClick}
          isMuted={isMuted()}
          onToggleMute={() => setIsMuted(!isMuted())}
        />
      </div>

      {/* Desktop: Actions column to the right of video */}
      <div class="max-md:hidden absolute left-[calc(50%+25vh+20px)] top-1/2 transform -translate-y-1/2 z-20">
        <VideoActions
          username={props.username}
          userAvatar={props.userAvatar}
          onProfileClick={() => props.onProfileClick?.()}
          isLiked={props.isLiked ?? false}
          onLikeClick={() => props.onLikeClick?.()}
          onShareClick={handleShareClick}
          canStudy={canStudy()}
          onStudyClick={handleStudyClick}
          musicTitle={localizedMusicTitle()}
          musicAuthor={localizedMusicAuthor()}
          musicImageUrl={props.musicImageUrl}
          onAudioClick={handleAudioClick}
          isMuted={isMuted()}
          onToggleMute={() => setIsMuted(!isMuted())}
        />
      </div>
    </div>
  )
}
