import { useRef, useEffect } from 'react'
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
  className
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Set video source when URL changes
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return

    console.log('[VideoPlayer] Setting video source:', videoUrl)

    // Clear existing sources first
    videoRef.current.innerHTML = ''

    // Try to set video source directly for better browser compatibility
    videoRef.current.src = videoUrl

    // Also try adding source element with codec info for fallback
    const source = document.createElement('source')
    source.src = videoUrl
    source.type = 'video/mp4; codecs="hvc1"' // HEVC codec hint
    videoRef.current.appendChild(source)

    videoRef.current.load()

    // Log when video is ready
    const handleLoadedMetadata = () => {
      console.log('[VideoPlayer] Video metadata loaded, duration:', videoRef.current?.duration)
    }
    const handleLoadedData = () => {
      console.log('[VideoPlayer] Video data loaded (can start playing)')
    }
    const handleCanPlay = () => {
      console.log('[VideoPlayer] Video can play through')
    }
    const handlePlaying = () => {
      console.log('[VideoPlayer] Video is now playing!')
      if (videoRef.current) {
        console.log('[VideoPlayer] Video dimensions:', {
          videoWidth: videoRef.current.videoWidth,
          videoHeight: videoRef.current.videoHeight,
          clientWidth: videoRef.current.clientWidth,
          clientHeight: videoRef.current.clientHeight
        })
      }
    }
    const handleError = (e: Event) => {
      console.error('[VideoPlayer] Video load error:', e)
      console.error('[VideoPlayer] Error details:', videoRef.current?.error)
      if (videoRef.current?.error) {
        console.error('[VideoPlayer] Error code:', videoRef.current.error.code)
        console.error('[VideoPlayer] Error message:', videoRef.current.error.message)
      }
    }

    videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata)
    videoRef.current.addEventListener('loadeddata', handleLoadedData)
    videoRef.current.addEventListener('canplay', handleCanPlay)
    videoRef.current.addEventListener('playing', handlePlaying)
    videoRef.current.addEventListener('error', handleError)

    return () => {
      videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata)
      videoRef.current?.removeEventListener('loadeddata', handleLoadedData)
      videoRef.current?.removeEventListener('canplay', handleCanPlay)
      videoRef.current?.removeEventListener('playing', handlePlaying)
      videoRef.current?.removeEventListener('error', handleError)
    }
  }, [videoUrl])

  // Sync isPlaying prop with actual video playback state
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return

    if (isPlaying) {
      console.log('[VideoPlayer] Attempting to play video')
      console.log('[VideoPlayer] Video readyState:', videoRef.current.readyState)
      console.log('[VideoPlayer] Video networkState:', videoRef.current.networkState)
      console.log('[VideoPlayer] Video paused:', videoRef.current.paused)

      videoRef.current.play()
        .then(() => {
          console.log('[VideoPlayer] Play succeeded!')
        })
        .catch(e => {
          console.error('[VideoPlayer] Play failed:', e.name, e.message)
        })
    } else {
      console.log('[VideoPlayer] Pausing video')
      videoRef.current.pause()
    }
  }, [isPlaying, videoUrl])

  // Sync isMuted prop with video element
  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.muted = isMuted
  }, [isMuted])

  // Log rendering state
  const showThumbnail = thumbnailUrl && (!videoUrl || !isPlaying)
  const showVideo = !!videoUrl

  console.log('[VideoPlayer] Render state:', {
    isPlaying,
    hasVideoUrl: !!videoUrl,
    hasThumbnailUrl: !!thumbnailUrl,
    showThumbnail,
    showVideo
  })

  return (
    <div className={cn('relative w-full h-full bg-black', className)}>
      {/* Thumbnail - show only when video hasn't started or no video URL */}
      {showThumbnail && (
        <img
          src={thumbnailUrl}
          alt="Video thumbnail"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      )}

      {/* Video element */}
      {showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-10 bg-transparent"
          loop
          playsInline
          muted={isMuted}
          onClick={onTogglePlay}
        />
      )}

      {/* Fallback for no media */}
      {!videoUrl && !thumbnailUrl && (
        <div className="absolute inset-0 w-full h-full bg-neutral-900 flex items-center justify-center z-0">
          <span className="text-foreground/50">No media</span>
        </div>
      )}

      {/* Play/Pause Overlay - only show when paused */}
      {videoUrl && !isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 cursor-pointer transition-colors group z-20"
          onClick={onTogglePlay}
        >
          <div className="w-20 h-20 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-black/60 transition-colors">
            <Play className="w-10 h-10 text-foreground fill-white ml-1" weight="fill" />
          </div>
        </div>
      )}
    </div>
  )
}
