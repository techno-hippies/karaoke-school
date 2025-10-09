import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { VideoPoster } from './VideoPoster'
import type { KaraokeLine } from '@/components/feed/types'

export interface PerformanceGradePageProps {
  /** Performance grade */
  grade: string
  /** User's top grade for this song */
  topGrade?: string
  /** Song information */
  songTitle: string
  artist: string
  artworkUrl?: string
  /** Video (optional) - if true, shows "Next" button to VideoPoster */
  hasVideo?: boolean
  videoUrl?: string
  karaokeLines?: KaraokeLine[]
  /** Most problematic line feedback (optional) */
  problematicLine?: string
  problematicLineFeedback?: string
  /** Callbacks */
  onComplete?: () => void // For audio-only (no video)
  onNext?: () => void // For video users (go to VideoPoster)
  onPost?: () => void // For VideoPoster
  /** Optional className */
  className?: string
}

export function PerformanceGradePage({
  grade,
  topGrade,
  songTitle,
  artist,
  artworkUrl,
  hasVideo = false,
  videoUrl,
  karaokeLines,
  problematicLine,
  problematicLineFeedback,
  onComplete,
  onNext,
  onPost,
  className,
}: PerformanceGradePageProps) {
  const [showVideoPoster, setShowVideoPoster] = useState(false)

  // If VideoPoster is open, show it
  if (showVideoPoster && hasVideo && videoUrl) {
    return (
      <VideoPoster
        videoUrl={videoUrl}
        karaokeLines={karaokeLines}
        onBack={() => setShowVideoPoster(false)}
        onPost={onPost}
      />
    )
  }

  const handleButtonClick = () => {
    if (hasVideo) {
      // Show VideoPoster for video review
      setShowVideoPoster(true)
      onNext?.()
    } else {
      // Audio-only, go home/complete
      onComplete?.()
    }
  }

  return (
    <div className={cn('fixed inset-0 z-50 bg-background overflow-hidden flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-2xl">
      {/* Main content */}
      <ScrollArea className="absolute top-0 left-0 right-0 bottom-20">
        {/* Album Art Hero */}
        <div className="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
          {artworkUrl && (
            <img
              src={artworkUrl}
              alt={songTitle}
              className="w-full h-full object-cover"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.95) 100%)'
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="text-foreground text-2xl font-bold mb-1">
              {songTitle}
            </h1>
            <p className="text-muted-foreground text-base">
              {artist}
            </p>
          </div>
        </div>

        {/* Content sections */}
        <div className="p-4 space-y-6">
          {/* Grade section - two column layout */}
          <div className="bg-neutral-900/30 rounded-lg border border-neutral-800/50 flex relative">
            {/* Your Grade */}
            <div className="flex-1 p-6 text-center">
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {grade}
              </div>
              <div className="text-neutral-400 text-sm font-medium">
                Your Grade
              </div>
            </div>

            {/* Divider */}
            {topGrade && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-2/3 bg-neutral-800/50" />
            )}

            {/* Top Grade */}
            {topGrade && (
              <div className="flex-1 p-6 text-center">
                <div className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                  {topGrade}
                </div>
                <div className="text-neutral-400 text-sm font-medium">
                  Your Best
                </div>
              </div>
            )}
          </div>

          {/* Performance feedback (if provided) */}
          {(problematicLine || problematicLineFeedback) && (
            <div className="text-left space-y-2">
              {problematicLineFeedback && (
                <div className="text-base text-muted-foreground leading-relaxed">
                  {problematicLineFeedback}
                </div>
              )}
              {problematicLine && (
                <div className="text-lg font-semibold text-foreground leading-relaxed">
                  {problematicLine}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom button */}
      <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4">
        <Button
          size="lg"
          onClick={handleButtonClick}
          className="w-full"
        >
          {hasVideo ? 'Next' : 'Complete'}
        </Button>
      </div>
      </div>
    </div>
  )
}
