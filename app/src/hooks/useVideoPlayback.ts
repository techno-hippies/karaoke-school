import { useState, useCallback, useEffect } from 'react'
import { useVideoPlaybackContext } from '@/contexts/VideoPlaybackContext'

export interface UseVideoPlaybackOptions {
  /**
   * Whether this video should attempt to autoplay when mounted/active
   */
  autoplay?: boolean
  /**
   * Force autoplay regardless of user interaction state
   * Use for video detail pages where autoplay is always desired
   */
  forceAutoplay?: boolean
}

export interface UseVideoPlaybackReturn {
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  setIsPlaying: (playing: boolean) => void
  setIsMuted: (muted: boolean) => void
  setCurrentTime: (time: number) => void
  handleTogglePlay: () => void
  handlePlayFailed: () => void
  handleTimeUpdate: (time: number) => void
}

/**
 * useVideoPlayback - Shared video playback state logic
 *
 * Encapsulates common video player state and behavior:
 * - Play/pause state with user interaction tracking
 * - Mute state
 * - Current time tracking
 * - Autoplay logic based on global user interaction state
 *
 * Usage:
 * ```tsx
 * const {
 *   isPlaying,
 *   isMuted,
 *   currentTime,
 *   handleTogglePlay,
 *   handlePlayFailed,
 *   handleTimeUpdate,
 * } = useVideoPlayback({ autoplay: true })
 * ```
 */
export function useVideoPlayback({
  autoplay = true,
  forceAutoplay = false,
}: UseVideoPlaybackOptions = {}): UseVideoPlaybackReturn {
  const { hasUserInteracted, setUserInteracted } = useVideoPlaybackContext()

  // Start paused on first load, autoplay only if user has interacted before OR forceAutoplay is true
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false) // Try unmuted first
  const [currentTime, setCurrentTime] = useState(0)

  // Sync playing state with autoplay prop
  // Autoplay if: forceAutoplay OR (user has interacted before AND autoplay is true)
  useEffect(() => {
    if ((forceAutoplay || hasUserInteracted()) && autoplay) {
      setIsPlaying(true)
    } else if (!autoplay) {
      setIsPlaying(false)
    }
  }, [autoplay, forceAutoplay, hasUserInteracted])

  const handleTogglePlay = useCallback(() => {
    // Mark that user has interacted globally
    setUserInteracted()

    // If playing but muted, unmute instead of pausing
    if (isPlaying && isMuted) {
      setIsMuted(false)
      return
    }

    // Otherwise, toggle play state
    const newPlayingState = !isPlaying
    setIsPlaying(newPlayingState)

    // Unmute when starting to play
    if (newPlayingState && isMuted) {
      setIsMuted(false)
    }
  }, [isMuted, isPlaying, setUserInteracted])

  const handlePlayFailed = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  return {
    isPlaying,
    isMuted,
    currentTime,
    setIsPlaying,
    setIsMuted,
    setCurrentTime,
    handleTogglePlay,
    handlePlayFailed,
    handleTimeUpdate,
  }
}
