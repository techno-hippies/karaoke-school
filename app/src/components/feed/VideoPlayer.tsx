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
          <span className="text-foreground/50">No media</span>
        </div>
      )}

      {/* Play/Pause Overlay - only show when paused */}
      {videoUrl && !isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 cursor-pointer transition-colors group"
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
