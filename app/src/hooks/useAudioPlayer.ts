import { useState, useRef, useEffect } from 'react'

export interface UseAudioPlayerOptions {
  autoplay?: boolean
  startMuted?: boolean
  onEnded?: () => void
}

export interface UseAudioPlayerReturn {
  audioRef: React.RefObject<HTMLAudioElement>
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

// Audio player hook with playback controls and state management
export function useAudioPlayer(
  audioUrl?: string,
  options: UseAudioPlayerOptions = {}
): UseAudioPlayerReturn {
  const { autoplay = false, startMuted = false, onEnded } = options

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(startMuted)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Setup audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      onEnded?.()
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [onEnded])

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
