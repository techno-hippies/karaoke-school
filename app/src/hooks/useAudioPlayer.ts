import { useState, useRef, useEffect } from 'react'

export interface UseAudioPlayerOptions {
  autoplay?: boolean
  startMuted?: boolean
  onEnded?: () => void
  updateThrottleMs?: number // Throttle currentTime updates to reduce re-renders
}

export interface UseAudioPlayerReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
  play: () => Promise<void>
  pause: () => void
  togglePlayPause: () => void
  toggleMute: () => void
  setMuted: (muted: boolean) => void
  seek: (time: number) => void
}

/**
 * Audio player hook with playback controls and state management
 */
export function useAudioPlayer(
  _audioUrl?: string, // TODO: Use for setting audio source
  options: UseAudioPlayerOptions = {}
): UseAudioPlayerReturn {
  const { 
    autoplay = false, 
    startMuted = false, 
    onEnded,
    updateThrottleMs = 50 // Update currentTime at most every 50ms to reduce re-renders
  } = options

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(startMuted)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Throttling refs to prevent excessive re-renders
  const lastUpdateRef = useRef(0)
  const requestAnimationFrameRef = useRef<number | null>(null)

  // Setup audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Optimized time update function with throttling - defined INSIDE useEffect to avoid stale closures
    const updateCurrentTime = (timestamp: number) => {
      // Only update if enough time has passed since last update
      if (timestamp - lastUpdateRef.current >= updateThrottleMs) {
        setCurrentTime(audio.currentTime)
        lastUpdateRef.current = timestamp
      }

      // Continue the loop - always schedule next frame since audio is playing
      requestAnimationFrameRef.current = requestAnimationFrame(updateCurrentTime)
    }

    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      // Clean up animation frame on end
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current)
        requestAnimationFrameRef.current = null
      }
      onEnded?.()
    }
    const handlePlay = () => {
      setIsPlaying(true)
      // Start the throttled time update loop
      lastUpdateRef.current = 0
      requestAnimationFrameRef.current = requestAnimationFrame(updateCurrentTime)
    }
    const handlePause = () => {
      setIsPlaying(false)
      // Stop the animation frame loop
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current)
        requestAnimationFrameRef.current = null
      }
    }

    // Clean up any existing animation frame on mount
    if (requestAnimationFrameRef.current) {
      cancelAnimationFrame(requestAnimationFrameRef.current)
      requestAnimationFrameRef.current = null
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      // Clean up animation frame on unmount
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current)
        requestAnimationFrameRef.current = null
      }
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [onEnded, updateThrottleMs])

  // Handle autoplay
  useEffect(() => {
    if (autoplay && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Autoplay blocked - user interaction required
      })
    }
  }, [autoplay])

  const play = async () => {
    if (audioRef.current) {
      await audioRef.current.play()
    }
  }

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }

  const togglePlayPause = () => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  return {
    audioRef,
    isPlaying,
    isMuted,
    currentTime,
    duration,
    play,
    pause,
    togglePlayPause,
    toggleMute,
    setMuted: setIsMuted,
    seek,
  }
}
