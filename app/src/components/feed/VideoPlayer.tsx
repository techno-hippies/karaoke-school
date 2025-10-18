import { useRef, useEffect, useState } from 'react'
import { Play } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { VideoPlayerProps } from './types'

/**
 * VideoPlayer - Clean video element with play/pause and mute controls
 * Handles video playback, poster images, and basic controls
 */
export function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  isPlaying,
  isMuted,
  onTogglePlay,
  onPlayFailed,
  onTimeUpdate,
  forceShowThumbnail = false,
  className
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false)

  // Handle play/pause with direct video control for better browser compatibility
  const handlePlayPause = (e?: React.MouseEvent) => {
    if (!videoRef.current || !videoUrl) return

    if (videoRef.current.paused) {
      // Directly call play() to ensure Chrome recognizes the user gesture
      const playPromise = videoRef.current.play()

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Only update parent state after play succeeds
            onTogglePlay()
          })
          .catch(e => {
            if (e.name === 'NotAllowedError') {
              console.error('[VideoPlayer] Autoplay blocked')
              if (onPlayFailed) onPlayFailed()
            }
          })
      }
    } else {
      // For pause, we can just call the parent handler
      onTogglePlay()
    }
  }

  // Load video source when URL is available
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return

    // Reset playing state when video URL changes
    setHasStartedPlaying(false)

    // Set video source directly - let browser auto-detect codec
    videoRef.current.src = videoUrl
    videoRef.current.load()

    const handleError = (e: Event) => {
      const video = videoRef.current
      if (video) {
        console.error('[VideoPlayer] Video load error:', {
          src: video.src,
          error: video.error,
          networkState: video.networkState,
          readyState: video.readyState
        })
      }
    }

    videoRef.current.addEventListener('error', handleError)

    return () => {
      videoRef.current?.removeEventListener('error', handleError)
    }
  }, [videoUrl])

  // Sync isPlaying prop with actual video playback state
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return

    if (isPlaying) {
      // Only call play() if video is not already playing (to avoid redundant calls)
      if (videoRef.current.paused) {
        videoRef.current.play()
          .catch(e => {
            // Notify parent that autoplay failed so it can show the play button
            if (e.name === 'NotAllowedError' && onPlayFailed) {
              onPlayFailed()
            }
          })
      }
    } else {
      // Only pause if video is actually playing
      if (!videoRef.current.paused) {
        videoRef.current.pause()
      }
    }
  }, [isPlaying, videoUrl, onPlayFailed])

  // Sync isMuted prop with video element
  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.muted = isMuted
  }, [isMuted])

  // Track when video actually starts playing (not just when play() is called)
  // Also track time updates for karaoke synchronization
  useEffect(() => {
    if (!videoRef.current) return

    const handlePlaying = () => {
      setHasStartedPlaying(true)
    }

    const handlePause = () => {
      setHasStartedPlaying(false)
    }

    const handleEnded = () => {
      setHasStartedPlaying(false)
    }

    const handleTimeUpdate = () => {
      if (onTimeUpdate && videoRef.current) {
        onTimeUpdate(videoRef.current.currentTime)
      }
    }

    videoRef.current.addEventListener('playing', handlePlaying)
    videoRef.current.addEventListener('pause', handlePause)
    videoRef.current.addEventListener('ended', handleEnded)
    videoRef.current.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      videoRef.current?.removeEventListener('playing', handlePlaying)
      videoRef.current?.removeEventListener('pause', handlePause)
      videoRef.current?.removeEventListener('ended', handleEnded)
      videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [onTimeUpdate])

  const showThumbnail = !!thumbnailUrl
  const showVideo = !!videoUrl

  return (
    <div className={cn('relative w-full h-full bg-black', className)}>
      {/* Thumbnail - always show when available, z-10 to appear above video until it has visible frames */}
      {showThumbnail && (
        <img
          src={thumbnailUrl}
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
          loop
          playsInline
          muted={isMuted}
          onClick={(e) => {
            e.stopPropagation()
            handlePlayPause()
          }}
        />
      )}

      {/* Fallback for no media */}
      {!videoUrl && !thumbnailUrl && (
        <div className="absolute inset-0 w-full h-full bg-background flex items-center justify-center z-0">
          <span className="text-foreground/50">No media</span>
        </div>
      )}

      {/* Play/Pause Overlay - only show when paused, z-30 to be above everything */}
      {videoUrl && !isPlaying && (
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
