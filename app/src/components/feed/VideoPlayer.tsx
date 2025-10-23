import { useRef, useEffect } from 'react'
import { Play } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useMachine } from '@xstate/react'
import { videoPlayerMachine } from './videoPlayerMachine'
import type { VideoPlayerProps } from './types'

/**
 * VideoPlayer - Clean video element with play/pause and mute controls
 * Handles video playback, poster images, and basic controls
 * Uses XState machine for reliable state management
 */
export function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  isPlaying,
  isMuted,
  onTogglePlay,
  onPlayFailed,
  onTimeUpdate,
  forceAutoplay = false,
  className
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isFirstRenderRef = useRef(true)
  const [state, send] = useMachine(videoPlayerMachine, {
    input: {
      videoUrl,
      thumbnailUrl,
      isMuted,
      autoplay: isPlaying,
    },
  })

  // Mark that first render is complete
  useEffect(() => {
    isFirstRenderRef.current = false
  }, [])

  // Handle play/pause - delegates to state machine
  const handlePlayPause = () => {
    if (!videoRef.current || !videoUrl) return
    send({ type: 'TOGGLE_PLAY' })
    onTogglePlay()
  }

  // Load video when URL changes
  useEffect(() => {
    if (!videoUrl) return
    send({ type: 'LOAD', videoUrl, thumbnailUrl })
  }, [videoUrl, thumbnailUrl, send])

  // Setup video element and event listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video || !state.context.videoUrl) return

    // Set video source
    video.src = state.context.videoUrl
    video.load()

    const handleLoadedMetadata = () => {
      send({ type: 'VIDEO_LOADED' })
    }

    const handleError = () => {
      if (video.error) {
        const errorMsg = `Code ${video.error.code}: ${video.error.message || 'Unknown error'}`
        // Only log non-empty errors
        if (video.error.message) {
          console.error('[VideoPlayer] Video error:', errorMsg)
        }
        send({ type: 'VIDEO_ERROR', error: errorMsg })
      }
    }

    const handlePlaying = () => {
      send({ type: 'PLAYING' })
    }

    const handlePause = () => {
      send({ type: 'PAUSED' })
    }

    const handleTimeUpdate = () => {
      if (onTimeUpdate) {
        onTimeUpdate(video.currentTime)
      }
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('error', handleError)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('pause', handlePause)
    video.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('error', handleError)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [state.context.videoUrl, send, onTimeUpdate])

  // Sync isPlaying prop with state machine
  useEffect(() => {
    send({ type: 'SET_AUTOPLAY', autoplay: isPlaying })
  }, [isPlaying, send])

  // Sync actual video playback with state machine
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const isInPlayingState = state.matches({ loaded: 'playing' }) || state.matches({ loaded: 'attemptingPlay' })

    if (isInPlayingState && video.paused) {
      video.play().catch((e) => {
        if (e.name === 'NotAllowedError') {
          send({ type: 'AUTOPLAY_BLOCKED' })
          onPlayFailed?.()
        }
      })
    } else if (!isInPlayingState && !video.paused) {
      video.pause()
    }
  }, [state.value, send, onPlayFailed])

  // Sync isMuted prop with video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

  const showThumbnail = !!state.context.thumbnailUrl
  const showVideo = !!state.context.videoUrl
  const hasStartedPlaying = state.context.hasStartedPlaying
  const isLoading = state.matches('loading') || state.matches({ loaded: 'attemptingPlay' })
  // Show play button if not autoplay and hasn't started playing yet (including during loading)
  const showPlayButton = !state.context.shouldAutoplay && !hasStartedPlaying
  // Show spinner only when user has interacted (clicked play or autoplay is enabled) and video is loading
  const showSpinner = isLoading && (state.context.shouldAutoplay || hasStartedPlaying)

  // Hide thumbnail on first render when forceAutoplay is true (e.g., video detail navigation)
  // This prevents the flash of the previous video's thumbnail during navigation
  const hideThumbnailOnFirstRender = isFirstRenderRef.current && forceAutoplay
  // Also hide thumbnail once video has started playing
  const hideThumbnail = hideThumbnailOnFirstRender || hasStartedPlaying

  return (
    <div className={cn('relative w-full h-full bg-black', className)}>
      {/* Thumbnail - hide on first render when autoplaying OR when video is playing */}
      {showThumbnail && !hideThumbnail && (
        <img
          src={state.context.thumbnailUrl}
          alt="Video thumbnail"
          className="absolute inset-0 w-full h-full object-cover z-10"
        />
      )}

      {/* Video element - always z-20 (above thumbnail) */}
      {showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-20"
          style={{ transform: 'translateZ(0)' }} // Force GPU layer for Chromium
          loop
          playsInline
          preload="auto" // Eager load for better rendering
          muted={isMuted}
          onClick={(e) => {
            e.stopPropagation()
            handlePlayPause()
          }}
        />
      )}

      {/* Fallback for no media */}
      {!state.context.videoUrl && !state.context.thumbnailUrl && (
        <div className="absolute inset-0 w-full h-full bg-background flex items-center justify-center z-0">
          <span className="text-foreground/50">No media</span>
        </div>
      )}

      {/* Error state */}
      {state.matches('error') && state.context.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-red-500 text-center p-4">
            <p className="font-semibold">Playback Error</p>
            <p className="text-sm mt-2">{state.context.error}</p>
          </div>
        </div>
      )}

      {/* Loading Spinner - show when loading or attempting to play, z-30 to be above everything */}
      {showSpinner && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Play/Pause Overlay - only show when paused, z-30 to be above everything */}
      {showPlayButton && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 cursor-pointer transition-colors group z-30"
          onClick={(e) => {
            e.stopPropagation()
            handlePlayPause()
          }}
        >
          <div className="w-20 h-20 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-black/60 transition-colors">
            <Play className="w-10 h-10 text-foreground fill-white ml-1" weight="fill" />
          </div>
        </div>
      )}
    </div>
  )
}
