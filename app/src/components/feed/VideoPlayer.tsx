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
  captionTracks,
  className,
  priorityLoad = false // New prop: if true, load immediately without debounce
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, send] = useMachine(videoPlayerMachine, {
    input: {
      videoUrl,
      thumbnailUrl,
      isMuted,
      autoplay: isPlaying,
    },
  })

  // Handle play/pause - delegates to state machine
  const handlePlayPause = () => {
    if (!videoRef.current || !videoUrl) return
    send({ type: 'TOGGLE_PLAY' })
    onTogglePlay()
  }

  // Load video when URL changes - with smart debouncing based on priority
  const lastLoadRef = useRef<string>('')
  const errorStateRef = useRef<boolean>(false)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    if (!videoUrl) return

    const loadVideo = () => {
      // Don't load if we're in error state and the URL hasn't actually changed
      if (errorStateRef.current && videoUrl === lastLoadRef.current) {
        console.log('[VideoPlayer] Skipping load - in error state:', videoUrl)
        return
      }

      // Only load if URL actually changed or we're not in error state
      if (videoUrl !== lastLoadRef.current) {
        console.log('[VideoPlayer] Loading video:', videoUrl, priorityLoad ? '(priority load)' : '(normal load)')
        lastLoadRef.current = videoUrl
        errorStateRef.current = false // Reset error state
        send({ type: 'LOAD', videoUrl, thumbnailUrl })
      }
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (priorityLoad) {
      // Priority loads: Load immediately without debounce
      console.log('[VideoPlayer] Loading priority video immediately:', videoUrl)
      loadVideo()
    } else {
      // Normal loads: Use much shorter debounce (100ms vs 1000ms)
      console.log('[VideoPlayer] Scheduling normal load with 100ms debounce:', videoUrl)
      timeoutRef.current = setTimeout(loadVideo, 100)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [videoUrl, thumbnailUrl, send, priorityLoad])

  // Track error state to prevent immediate retries
  useEffect(() => {
    if (state.matches('error')) {
      console.log('[VideoPlayer] Entered error state, preventing retries for:', lastLoadRef.current)
      errorStateRef.current = true
      
      // Clear error state after 5 seconds to allow retries
      setTimeout(() => {
        errorStateRef.current = false
      }, 5000)
    }
  }, [state])

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
          console.error('[VideoPlayer] Error loading video:', errorMsg)
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
  const isInPlayingState = state.matches({ loaded: 'playing' }) || state.matches({ loaded: 'attemptingPlay' })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

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
  }, [isInPlayingState, onPlayFailed, send])

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
  // Show spinner only when loading, user has interacted, AND no thumbnail available
  // If we have a thumbnail, it serves as the loading state - no spinner needed
  const showSpinner = isLoading && (state.context.shouldAutoplay || hasStartedPlaying) && !showThumbnail

  return (
    <div className={cn('relative w-full h-full bg-black', className)}>
      {/* Thumbnail - always show when available, z-10 to appear above video until it has visible frames */}
      {showThumbnail && (
        <img
          src={state.context.thumbnailUrl}
          alt="Video thumbnail"
          className="absolute inset-0 w-full h-full object-cover z-10"
        />
      )}

      {/* Video element - z-20 when playing (above thumbnail), z-0 when paused (below thumbnail) */}
      {showVideo && (
        <video
          ref={videoRef}
          className={cn(
            "absolute inset-0 w-full h-full object-cover",
            hasStartedPlaying ? "z-20" : "z-0"
          )}
          style={{
            backgroundColor: 'black',
            objectFit: 'cover',
            willChange: 'transform',
          }}
          loop
          playsInline
          preload="auto"
          muted={isMuted}
          onClick={(e) => {
            e.stopPropagation()
            handlePlayPause()
          }}
        >
          {/* Native caption tracks */}
          {captionTracks?.map((track) => (
            <track
              key={track.srclang}
              kind="captions"
              src={track.src}
              srcLang={track.srclang}
              label={track.label}
              default={track.default}
            />
          ))}
        </video>
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
