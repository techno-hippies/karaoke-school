import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/ui/back-button'
import { KaraokeOverlay } from '@/components/feed/KaraokeOverlay'
import type { KaraokeLine } from '@/components/feed/types'

export interface VideoPosterProps {
  /** URL of the recorded video to post */
  videoUrl?: string
  /** Karaoke lyrics to display at top */
  karaokeLines?: KaraokeLine[]
  /** Current playback time for karaoke highlighting */
  currentTime?: number
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
  currentTime = 0,
  onBack,
  onPost,
  className,
}: VideoPosterProps) {
  const [isPlaying, setIsPlaying] = useState(true)

  return (
    <div className={cn('relative h-screen w-full bg-black overflow-hidden', className)}>
      {/* Video preview - full screen, looping */}
      {videoUrl ? (
        <video
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          onClick={() => setIsPlaying(!isPlaying)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <p className="text-foreground/60 text-lg">No video recorded</p>
        </div>
      )}

      {/* Karaoke lyrics at top */}
      {karaokeLines && (
        <KaraokeOverlay
          lines={karaokeLines}
          currentTime={currentTime}
          className="pt-16"
          showNextLine={true}
        />
      )}

      {/* Back button - top left */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <div className="flex items-center h-16 px-4">
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
  )
}
