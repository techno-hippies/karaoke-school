import { X, Eye, EyeSlash, CameraRotate, MusicNotes, Timer } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KaraokeOverlay } from '@/components/feed/KaraokeOverlay'
import type { KaraokeLine } from '@/components/feed/types'

export interface Song {
  id: string
  title: string
  artist?: string
  hasInstrumental?: boolean
  coverUrl?: string
  karaokeLines?: KaraokeLine[]
}

export type RecordingMode = 'lipsync' | 'karaoke'

export interface CameraRecorderProps {
  /** Whether recording is in progress */
  isRecording?: boolean
  /** Currently selected song */
  selectedSong?: Song
  /** Recording mode - lip-sync or karaoke */
  mode?: RecordingMode
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
  /** Callback when mode changes */
  onModeChange?: (mode: RecordingMode) => void
  /** Optional className */
  className?: string
}

export function CameraRecorder({
  isRecording = false,
  selectedSong,
  mode = 'lipsync',
  onRecord,
  onStop,
  onClose,
  onSelectSong,
  onRemoveSong,
  onModeChange,
  className,
}: CameraRecorderProps) {
  const [showLyrics, setShowLyrics] = useState(true)
  const [frontCamera, setFrontCamera] = useState(true)
  const [countdownEnabled, setCountdownEnabled] = useState(false)
  const [currentTime, setCurrentTime] = useState(1) // Demo time for lyrics highlighting
  const [countdown, setCountdown] = useState<number | null>(null)

  const isKaraokeMode = mode === 'karaoke'
  const canShowKaraoke = selectedSong?.hasInstrumental
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
    <div className={cn('relative h-screen w-full bg-background snap-start flex items-center justify-center', className)}>
      {/* Camera Container */}
      <div className="relative w-full h-full bg-background">
        {/* Camera preview placeholder */}
        <div className="absolute inset-0 bg-secondary flex items-center justify-center">
          <span className="text-muted-foreground text-lg">Camera preview</span>
        </div>

        {/* Close button - top left */}
        <Button
          variant="ghost"
          size="lg"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 left-4 z-50 w-12 px-0 text-white hover:bg-black/30 hover:text-white"
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
            <div className="text-[12rem] font-bold text-white drop-shadow-2xl animate-pulse">
              {countdown}
            </div>
          </div>
        )}

        {/* Right-side action stack */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 md:gap-6 z-20">
          {/* Flip camera - enabled during countdown and recording */}
          <button
            onClick={() => setFrontCamera(!frontCamera)}
            className="flex flex-col items-center cursor-pointer"
          >
            <div className="rounded-full p-3 max-md:bg-transparent md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50 transition-colors">
              <CameraRotate className="w-7 h-7 text-white" weight="fill" />
            </div>
            <span className="text-white text-xs max-md:mt-0 md:mt-1">
              {frontCamera ? 'Front' : 'Back'}
            </span>
          </button>

          {/* Countdown toggle */}
          <button
            onClick={() => setCountdownEnabled(!countdownEnabled)}
            className="flex flex-col items-center cursor-pointer"
          >
            <div className={cn(
              "rounded-full p-3 max-md:bg-transparent md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50 transition-colors",
              countdownEnabled && "md:bg-primary/50"
            )}>
              <Timer className="w-7 h-7 text-white" weight="fill" />
            </div>
            <span className="text-white text-xs max-md:mt-0 md:mt-1">
              {countdownEnabled ? '3s' : 'Timer'}
            </span>
          </button>

          {/* Show/Hide lyrics - enabled during countdown and recording */}
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            className="flex flex-col items-center cursor-pointer"
          >
            <div className="rounded-full p-3 max-md:bg-transparent md:bg-neutral-800/50 md:backdrop-blur-sm md:hover:bg-neutral-700/50 transition-colors">
              {showLyrics ? (
                <Eye className="w-7 h-7 text-white" weight="fill" />
              ) : (
                <EyeSlash className="w-7 h-7 text-white" weight="fill" />
              )}
            </div>
            <span className="text-white text-xs max-md:mt-0 md:mt-1">Lyrics</span>
          </button>
        </div>

        {/* Bottom area - Song, Record, Mode selector */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          {/* Record button - centered anchor */}
          <button
            onClick={handleRecordClick}
            className={cn(
              'absolute bottom-16 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border-[6px] border-red-500/40',
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
              "absolute bottom-[calc(4rem+16px)] left-[calc(25%-44px)] cursor-pointer",
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
                  <MusicNotes className="w-6 h-6 text-white drop-shadow-lg" weight="fill" />
                </div>
              )}
            </div>
          </button>

          {/* Mode selector - centered at bottom, iOS/TikTok style - always visible */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <div className="flex gap-6 text-white text-sm font-medium">
              <button
                onClick={() => onModeChange?.('karaoke')}
                disabled={isRecording || isCountingDown || !canShowKaraoke}
                className={cn(
                  "pb-1 transition-all relative cursor-pointer text-white",
                  (isRecording || isCountingDown || !canShowKaraoke) && "opacity-50 cursor-not-allowed"
                )}
              >
                Karaoke
                {mode === 'karaoke' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>
              <button
                onClick={() => onModeChange?.('lipsync')}
                disabled={isRecording || isCountingDown}
                className={cn(
                  "pb-1 transition-all relative cursor-pointer text-white",
                  (isRecording || isCountingDown) && "opacity-50 cursor-not-allowed"
                )}
              >
                Lip Sync
                {mode === 'lipsync' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
