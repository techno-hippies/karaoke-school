import { useRef, useEffect } from 'react'
import { Play, SpeakerHigh, SpeakerX } from '@phosphor-icons/react'
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
  onToggleMute,
  className
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Sync isPlaying prop with actual video playback state
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return

    if (isPlaying) {
      videoRef.current.play().catch(e =>
        console.log('[VideoPlayer] Play failed:', e)
      )
    } else {
      videoRef.current.pause()
    }
  }, [isPlaying, videoUrl])

  // Sync isMuted prop with video element
  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.muted = isMuted
  }, [isMuted])

  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Video or Thumbnail */}
      {videoUrl ? (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          loop
          playsInline
          poster={thumbnailUrl}
          onClick={onTogglePlay}
        />
      ) : thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Video thumbnail"
          className="w-full h-full object-cover cursor-pointer"
          onClick={onTogglePlay}
        />
      ) : (
        <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
          <span className="text-white/50">No media</span>
        </div>
      )}

      {/* Play/Pause Overlay - only show when paused */}
      {videoUrl && !isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
          onClick={onTogglePlay}
        >
          <div className="w-20 h-20 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Play className="w-10 h-10 text-white fill-white ml-1" weight="fill" />
          </div>
        </div>
      )}

      {/* Mute/Unmute Button - top-left */}
      {videoUrl && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleMute()
          }}
          className="absolute top-4 left-4 p-2 rounded-full max-md:bg-transparent md:bg-black/40 md:backdrop-blur-sm md:hover:bg-black/60 transition-colors cursor-pointer z-10"
        >
          {isMuted ? (
            <SpeakerX className="w-6 h-6 text-white drop-shadow-lg" />
          ) : (
            <SpeakerHigh className="w-6 h-6 text-white drop-shadow-lg" />
          )}
        </button>
      )}
    </div>
  )
}
