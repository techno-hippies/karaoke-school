import { X, Eye, EyeSlash, CameraRotate, MusicNotes, Timer, VideoCamera, VideoCameraSlash } from '@phosphor-icons/react'
import { useState } from 'react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { KaraokeOverlay } from '@/components/feed/KaraokeOverlay'
import type { KaraokeLine } from '@/components/feed/types'

export interface Song {
  id: string
  title: string
  artist?: string
  coverUrl?: string
  karaokeLines?: KaraokeLine[]
}

export interface VideoRecorderProps {
  /** Whether recording is in progress */
  isRecording?: boolean
  /** Currently selected song */
  selectedSong?: Song
  /** Callback when record button is clicked */
  onRecord?: () => void
  /** Callback when stop is clicked */
  onStop?: () => void
  /** Callback when close/exit is clicked */
  onClose?: () => void
  /** Callback when song selection is clicked */
  onSelectSong?: () => void
  /** Callback when song is removed */
  onRemoveSong?: () => void
  /** Optional className */
  className?: string
}

export function VideoRecorder({
  isRecording = false,
  selectedSong,
  onRecord,
  onStop,
  onClose,
  onSelectSong,
  onRemoveSong,
  className,
}: VideoRecorderProps) {
  const [showLyrics, setShowLyrics] = useState(true)
  const [showVideo, setShowVideo] = useState(true)
  const [frontCamera, setFrontCamera] = useState(true)
  const [countdownEnabled, setCountdownEnabled] = useState(false)
  const [currentTime, setCurrentTime] = useState(1) // Demo time for lyrics highlighting
  const [countdown, setCountdown] = useState<number | null>(null)

  const isCountingDown = countdown !== null

  const handleRecordClick = () => {
    if (isRecording) {
      onStop?.()
      setCountdown(null)
    } else {
      // Start countdown if enabled, otherwise record immediately
      if (countdownEnabled) {
        setCountdown(3)

        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev === 1) {
              clearInterval(timer)
              onRecord?.() // Actually start recording
              return null
            }
            return prev! - 1
          })
        }, 1000)
      } else {
        onRecord?.() // Start recording immediately
      }
    }
  }

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (countdown !== null) {
        setCountdown(null)
      }
    }
  }, [])

  return (
    <div className={cn('fixed inset-0 z-50 bg-black flex items-center justify-center', className)}>
      {/* Camera Container - mobile: full screen, desktop: 9:16 centered */}
      <div className="relative w-full h-full md:w-[50.625vh] md:h-[90vh] md:max-w-[450px] md:max-h-[800px] md:rounded-lg overflow-hidden bg-background">
        {/* Camera preview placeholder or hidden state */}
        <div className="absolute inset-0 bg-secondary flex items-center justify-center">
          {showVideo ? (
            <span className="text-muted-foreground text-lg">Camera preview</span>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <VideoCameraSlash className="w-16 h-16 text-muted-foreground" weight="regular" />
              <span className="text-muted-foreground text-lg">Video hidden</span>
            </div>
          )}
        </div>

        {/* Close button - top left */}
        <Button
          variant="ghost"
          size="lg"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 left-4 z-50 w-12 px-0 text-foreground hover:bg-black/30 hover:text-foreground"
        >
          <X className="w-6 h-6" weight="regular" />
        </Button>

        {/* Lyrics - show in both modes when enabled - top of screen */}
        {showLyrics && selectedSong?.karaokeLines && (
          <KaraokeOverlay
            lines={selectedSong.karaokeLines}
            currentTime={currentTime}
            className="pt-16"
            showNextLine={true}
          />
        )}

        {/* Countdown overlay - centered */}
        {isCountingDown && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-[12rem] font-bold text-foreground drop-shadow-2xl animate-pulse">
              {countdown}
            </div>
          </div>
        )}

        {/* Right-side action stack */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 md:gap-6 z-20">
          {/* Flip camera - disabled when video is hidden */}
          <button
            onClick={() => setFrontCamera(!frontCamera)}
            disabled={!showVideo}
            className={cn(
              "flex flex-col items-center cursor-pointer",
              !showVideo && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="rounded-full p-3 max-md:bg-transparent md:bg-secondary/50 md:backdrop-blur-sm md:hover:bg-secondary/70 transition-colors">
              <CameraRotate className="w-7 h-7 text-foreground" weight="fill" />
            </div>
            <span className="text-foreground text-xs max-md:mt-0 md:mt-1">
              {frontCamera ? 'Front' : 'Back'}
            </span>
          </button>

          {/* Countdown toggle */}
          <button
            onClick={() => setCountdownEnabled(!countdownEnabled)}
            className="flex flex-col items-center cursor-pointer"
          >
            <div className={cn(
              "rounded-full p-3 max-md:bg-transparent md:bg-secondary/50 md:backdrop-blur-sm md:hover:bg-secondary/70 transition-colors",
              countdownEnabled && "md:bg-primary/50"
            )}>
              <Timer className="w-7 h-7 text-foreground" weight="fill" />
            </div>
            <span className="text-foreground text-xs max-md:mt-0 md:mt-1">
              {countdownEnabled ? '3s' : 'Timer'}
            </span>
          </button>

          {/* Show/Hide lyrics - enabled during countdown and recording */}
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            className="flex flex-col items-center cursor-pointer"
          >
            <div className="rounded-full p-3 max-md:bg-transparent md:bg-secondary/50 md:backdrop-blur-sm md:hover:bg-secondary/70 transition-colors">
              {showLyrics ? (
                <Eye className="w-7 h-7 text-foreground" weight="fill" />
              ) : (
                <EyeSlash className="w-7 h-7 text-foreground" weight="fill" />
              )}
            </div>
            <span className="text-foreground text-xs max-md:mt-0 md:mt-1">Lyrics</span>
          </button>

          {/* Show/Hide video - disabled during recording/countdown */}
          <button
            onClick={() => setShowVideo(!showVideo)}
            disabled={isRecording || isCountingDown}
            className={cn(
              "flex flex-col items-center cursor-pointer",
              (isRecording || isCountingDown) && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="rounded-full p-3 max-md:bg-transparent md:bg-secondary/50 md:backdrop-blur-sm md:hover:bg-secondary/70 transition-colors">
              {showVideo ? (
                <VideoCamera className="w-7 h-7 text-foreground" weight="fill" />
              ) : (
                <VideoCameraSlash className="w-7 h-7 text-foreground" weight="fill" />
              )}
            </div>
            <span className="text-foreground text-xs max-md:mt-0 md:mt-1">Video</span>
          </button>
        </div>

        {/* Bottom area - Song selection and Record button */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          {/* Record button - centered */}
          <button
            onClick={handleRecordClick}
            className={cn(
              'absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border-[6px] border-red-500/40',
              isRecording
                ? 'bg-transparent'
                : 'bg-transparent hover:bg-red-500/10'
            )}
          >
            <div
              className={cn(
                'transition-all duration-200 bg-red-500',
                isRecording
                  ? 'w-7 h-7 rounded-sm'
                  : 'w-14 h-14 rounded-full'
              )}
            />
          </button>

          {/* Song selection - to the left of record button, centered in remaining space */}
          <button
            onClick={onSelectSong}
            disabled={isRecording || isCountingDown}
            className={cn(
              "absolute bottom-[calc(2rem+16px)] left-[calc(25%-44px)] cursor-pointer",
              (isRecording || isCountingDown) && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center border-2 border-white">
              {selectedSong?.coverUrl ? (
                <img
                  src={selectedSong.coverUrl}
                  alt={selectedSong.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center">
                  <MusicNotes className="w-6 h-6 text-foreground drop-shadow-lg" weight="fill" />
                </div>
              )}
            </div>
          </button>

        </div>
      </div>
    </div>
  )
}
