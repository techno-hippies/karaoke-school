import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/ui/back-button'
import { VideoPlayer } from '@/components/feed/VideoPlayer'
import { KaraokeOverlay } from '@/components/feed/KaraokeOverlay'
import type { KaraokeLine } from '@/components/feed/types'

export interface VideoPosterProps {
  /** URL of the recorded video to post */
  videoUrl?: string
  /** Karaoke lyrics to display at top */
  karaokeLines?: KaraokeLine[]
  /** Callback when back button is clicked */
  onBack?: () => void
  /** Callback when post button is clicked */
  onPost?: () => void
  /** Optional className */
  className?: string
}

export function VideoPoster({
  videoUrl,
  karaokeLines,
  onBack,
  onPost,
  className,
}: VideoPosterProps) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Track video time for karaoke
  useEffect(() => {
    if (!videoContainerRef.current) return

    const video = videoContainerRef.current.querySelector('video')
    if (!video) return

    const updateTime = () => setCurrentTime(video.currentTime)
    video.addEventListener('timeupdate', updateTime)
    return () => video.removeEventListener('timeupdate', updateTime)
  }, [videoUrl])

  return (
    <div className={cn('fixed inset-0 z-50 bg-black flex items-center justify-center', className)}>
      {/* Video Container - mobile: full screen, desktop: 9:16 centered */}
      <div className="relative w-full h-full md:w-[50.625vh] md:h-[90vh] md:max-w-[450px] md:max-h-[800px] md:rounded-lg overflow-hidden">
        {/* Video preview - full screen, looping */}
        <div ref={videoContainerRef} className="absolute inset-0">
        <VideoPlayer
          videoUrl={videoUrl}
          isPlaying={isPlaying}
          isMuted={false}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
        />
      </div>

      {/* Karaoke lyrics at top */}
      {karaokeLines && karaokeLines.length > 0 && (
        <KaraokeOverlay
          lines={karaokeLines}
          currentTime={currentTime}
          className="pt-12 pointer-events-none z-10"
          showNextLine={true}
        />
      )}

      {/* Back button - top left */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <div className="flex items-center h-12 px-4">
          <BackButton onClick={onBack} variant="floating" />
        </div>
      </div>

      {/* Post button - full width at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pb-8 px-4">
        <Button
          size="lg"
          onClick={onPost}
          className="w-full"
        >
          Post
        </Button>
      </div>
      </div>
    </div>
  )
}
