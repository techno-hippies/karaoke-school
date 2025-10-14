import { X, Eye, EyeSlash, CameraRotate, MusicNotes, Timer, VideoCamera, VideoCameraSlash } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { KaraokeOverlay } from '@/components/feed/KaraokeOverlay'
import type { KaraokeLine } from '@/components/feed/types'
import { useCamera } from '@/hooks/useCamera'
import { useInstrumental } from '@/hooks/useInstrumental'
import { useKaraokeRecorder } from '@/hooks/useKaraokeRecorder'

export interface Song {
  id: string
  title: string
  artist?: string
  coverUrl?: string
  karaokeLines?: KaraokeLine[]
}

export interface VideoRecorderProps {
  /** Currently selected song */
  selectedSong?: Song
  /** URL of the instrumental audio track */
  instrumentalUrl: string
  /** Segment start time (seconds) */
  segmentStartTime: number
  /** Segment end time (seconds) */
  segmentEndTime: number
  /** Karaoke lyrics with timing */
  karaokeLines?: KaraokeLine[]
  /** Callback when recording completes successfully */
  onRecordingComplete?: (blob: Blob) => void
  /** Callback when close/exit is clicked */
  onClose?: () => void
  /** Callback when song selection is clicked */
  onSelectSong?: () => void
  /** Optional className */
  className?: string
}

export function VideoRecorder({
  selectedSong,
  instrumentalUrl,
  segmentStartTime,
  segmentEndTime,
  karaokeLines,
  onRecordingComplete,
  onClose,
  onSelectSong,
  className,
}: VideoRecorderProps) {
  // UI state
  const [showLyrics, setShowLyrics] = useState(true)
  const [showVideo, setShowVideo] = useState(true)
  const [countdownEnabled, setCountdownEnabled] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recordingState, setRecordingState] = useState<'idle' | 'countdown' | 'recording'>('idle')

  const isCountingDown = countdown !== null

  // Camera hook
  const camera = useCamera({
    videoEnabled: showVideo,
    facingMode: 'user',
    audioEnabled: true
  })

  // Instrumental hook
  const instrumental = useInstrumental({
    audioUrl: instrumentalUrl,
    startTime: segmentStartTime,
    endTime: segmentEndTime
  })

  // Recorder hook
  const recorder = useKaraokeRecorder({
    cameraStream: camera.stream,
    instrumentalSource: instrumental.sourceNode,
    audioContext: instrumental.audioContext,
    videoEnabled: showVideo,
    onComplete: (blob) => {
      console.log('[VideoRecorder] Recording complete, blob size:', blob.size)
      setRecordingState('idle')
      onRecordingComplete?.(blob)
    },
    micGain: 1.0,
    instrumentalGain: 0.6
  })

  // Handle record button click
  const handleRecordClick = () => {
    if (recordingState === 'recording') {
      // Stop recording
      recorder.stop()
      instrumental.stop()
      setRecordingState('idle')
    } else if (recordingState === 'idle') {
      // Start countdown or record immediately
      if (countdownEnabled) {
        startCountdown()
      } else {
        startRecording()
      }
    }
  }

  // Start countdown sequence
  const startCountdown = () => {
    setRecordingState('countdown')
    setCountdown(3)

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(timer)
          startRecording()
          return null
        }
        return prev! - 1
      })
    }, 1000)
  }

  // Start actual recording
  const startRecording = () => {
    console.log('[VideoRecorder] Starting recording')
    setRecordingState('recording')
    setCountdown(null)

    // Start instrumental playback
    instrumental.start()

    // Start recorder
    recorder.start()

    // Auto-stop after segment duration
    const duration = (segmentEndTime - segmentStartTime) * 1000
    setTimeout(() => {
      if (recordingState === 'recording') {
        console.log('[VideoRecorder] Auto-stopping at segment end')
        recorder.stop()
        instrumental.stop()
        setRecordingState('idle')
      }
    }, duration)
  }

  // Cleanup countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdown !== null) {
        setCountdown(null)
      }
    }
  }, [countdown])

  // Show camera preview
  useEffect(() => {
    if (camera.videoRef.current && camera.stream && showVideo) {
      camera.videoRef.current.srcObject = camera.stream
    }
  }, [camera.stream, camera.videoRef, showVideo])

  // Determine if controls should be disabled
  const controlsDisabled = recordingState !== 'idle'

  // Check if ready to record
  const isReadyToRecord = camera.isReady && instrumental.isReady && recorder.isReady

  return (
    <div className={cn('fixed inset-0 z-50 bg-black flex items-center justify-center', className)}>
      {/* Camera Container - mobile: full screen, desktop: 9:16 centered */}
      <div className="relative w-full h-full md:w-[50.625vh] md:h-[90vh] md:max-w-[450px] md:max-h-[800px] md:rounded-lg overflow-hidden bg-background">

        {/* Camera preview or error state */}
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          {camera.error ? (
            <div className="text-center px-8 max-w-xs mx-auto">
              {/* Icon based on error type */}
              {camera.error.type === 'permission' ? (
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              ) : camera.error.type === 'unavailable' ? (
                <VideoCameraSlash className="w-16 h-16 text-orange-400 mx-auto mb-4" weight="regular" />
              ) : (
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}

              {/* Error title */}
              <p className="text-white font-semibold text-lg mb-2">
                {camera.error.title}
              </p>

              {/* Error message */}
              <p className="text-white/70 text-sm mb-6 leading-relaxed">
                {camera.error.message}
              </p>

              {/* Action buttons */}
              <div className="flex flex-col gap-3 w-full">
                {camera.error.canRetry && (
                  <Button
                    onClick={() => {
                      // Force re-initialization by toggling facing mode
                      camera.switchCamera()
                      setTimeout(() => camera.switchCamera(), 100)
                    }}
                    variant="default"
                    size="sm"
                    className="w-full"
                  >
                    Try Again
                  </Button>
                )}
                {camera.error.canUseAudioOnly && showVideo && (
                  <Button
                    onClick={() => setShowVideo(false)}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Use Audio Only
                  </Button>
                )}
              </div>
            </div>
          ) : showVideo ? (
            camera.isReady ? (
              <video
                ref={camera.videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // Mirror for selfie view
              />
            ) : (
              <span className="text-muted-foreground text-lg">Loading camera...</span>
            )
          ) : (
            <div className="flex flex-col items-center gap-4">
              <VideoCameraSlash className="w-16 h-16 text-muted-foreground" weight="regular" />
              <span className="text-muted-foreground text-lg">Video hidden</span>
              <span className="text-muted-foreground text-sm">Audio-only mode</span>
            </div>
          )}
        </div>

        {/* Instrumental error overlay */}
        {instrumental.error && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
            <div className="text-center px-8">
              <p className="text-red-400 font-medium mb-2">Audio Error</p>
              <p className="text-muted-foreground text-sm">{instrumental.error}</p>
            </div>
          </div>
        )}

        {/* Recorder error overlay */}
        {recorder.error && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
            <div className="text-center px-8">
              <p className="text-red-400 font-medium mb-2">Recording Error</p>
              <p className="text-muted-foreground text-sm">{recorder.error}</p>
            </div>
          </div>
        )}

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

        {/* Lyrics - show when enabled and available */}
        {showLyrics && karaokeLines && karaokeLines.length > 0 && (
          <KaraokeOverlay
            lines={karaokeLines}
            currentTime={instrumental.currentTime}
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

          {/* Flip camera - only show on mobile with multiple cameras */}
          {camera.hasMultipleCameras && (
            <button
              onClick={camera.switchCamera}
              disabled={!showVideo || controlsDisabled}
              className={cn(
                "flex flex-col items-center cursor-pointer",
                (!showVideo || controlsDisabled) && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="rounded-full p-3 max-md:bg-transparent md:bg-secondary/50 md:backdrop-blur-sm md:hover:bg-secondary/70 transition-colors">
                <CameraRotate className="w-7 h-7 text-foreground" weight="fill" />
              </div>
              <span className="text-foreground text-xs max-md:mt-0 md:mt-1">
                {camera.currentFacingMode === 'user' ? 'Front' : 'Back'}
              </span>
            </button>
          )}

          {/* Countdown toggle */}
          <button
            onClick={() => setCountdownEnabled(!countdownEnabled)}
            disabled={controlsDisabled}
            className={cn(
              "flex flex-col items-center cursor-pointer",
              controlsDisabled && "opacity-50 cursor-not-allowed"
            )}
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

          {/* Show/Hide lyrics - only show if lyrics available */}
          {karaokeLines && karaokeLines.length > 0 && (
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
          )}

          {/* Show/Hide video - disabled during recording/countdown */}
          <button
            onClick={() => setShowVideo(!showVideo)}
            disabled={controlsDisabled}
            className={cn(
              "flex flex-col items-center cursor-pointer",
              controlsDisabled && "opacity-50 cursor-not-allowed"
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
            disabled={!isReadyToRecord}
            className={cn(
              'absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border-[6px]',
              recordingState === 'recording'
                ? 'border-red-500 bg-transparent'
                : 'border-red-500/40 bg-transparent hover:bg-red-500/10',
              !isReadyToRecord && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div
              className={cn(
                'transition-all duration-200 bg-red-500',
                recordingState === 'recording'
                  ? 'w-7 h-7 rounded-sm'
                  : 'w-14 h-14 rounded-full'
              )}
            />
          </button>

          {/* Song selection - to the left of record button */}
          <button
            onClick={onSelectSong}
            disabled={controlsDisabled}
            className={cn(
              "absolute bottom-[calc(2rem+16px)] left-[calc(25%-44px)] cursor-pointer",
              controlsDisabled && "opacity-50 cursor-not-allowed"
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

          {/* Ready indicator */}
          {!isReadyToRecord && !camera.error && !instrumental.error && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center">
              <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
