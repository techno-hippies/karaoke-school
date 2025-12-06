import { createSignal, onMount, onCleanup, type Accessor } from 'solid-js'

export interface UseAudioPlayerOptions {
  autoplay?: boolean
  startMuted?: boolean
  onEnded?: () => void
}

export interface UseAudioPlayerReturn {
  audioRef: HTMLAudioElement | undefined
  setAudioRef: (el: HTMLAudioElement) => void
  isPlaying: Accessor<boolean>
  isMuted: Accessor<boolean>
  currentTime: Accessor<number>
  duration: Accessor<number>
  play: () => Promise<void>
  pause: () => void
  togglePlayPause: () => void
  toggleMute: () => void
  setMuted: (muted: boolean) => void
  seek: (time: number) => void
}

/**
 * Audio player hook with playback controls and state management (SolidJS)
 */
export function useAudioPlayer(options: UseAudioPlayerOptions = {}): UseAudioPlayerReturn {
  const { autoplay = false, startMuted = false, onEnded } = options

  const [isPlaying, setIsPlaying] = createSignal(false)
  const [isMuted, setIsMuted] = createSignal(startMuted)
  const [currentTime, setCurrentTime] = createSignal(0)
  const [duration, setDuration] = createSignal(0)

  let audioRef: HTMLAudioElement | undefined
  let rafId: number | null = null
  let lastUpdate = 0

  const setAudioRef = (el: HTMLAudioElement) => {
    audioRef = el
    setupAudioListeners()
  }

  const updateCurrentTime = (timestamp: number) => {
    if (!audioRef) return
    if (timestamp - lastUpdate >= 50) {
      setCurrentTime(audioRef.currentTime)
      lastUpdate = timestamp
    }
    rafId = requestAnimationFrame(updateCurrentTime)
  }

  const setupAudioListeners = () => {
    if (!audioRef) return

    const handleLoadedMetadata = () => setDuration(audioRef!.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      onEnded?.()
    }
    const handlePlay = () => {
      setIsPlaying(true)
      lastUpdate = 0
      rafId = requestAnimationFrame(updateCurrentTime)
    }
    const handlePause = () => {
      setIsPlaying(false)
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    audioRef.addEventListener('loadedmetadata', handleLoadedMetadata)
    audioRef.addEventListener('ended', handleEnded)
    audioRef.addEventListener('play', handlePlay)
    audioRef.addEventListener('pause', handlePause)

    onCleanup(() => {
      if (rafId) cancelAnimationFrame(rafId)
      audioRef?.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audioRef?.removeEventListener('ended', handleEnded)
      audioRef?.removeEventListener('play', handlePlay)
      audioRef?.removeEventListener('pause', handlePause)
    })

    // Handle autoplay
    if (autoplay) {
      audioRef.play().catch(() => {})
    }
  }

  const play = async () => {
    if (audioRef) {
      await audioRef.play()
    }
  }

  const pause = () => {
    audioRef?.pause()
  }

  const togglePlayPause = () => {
    if (isPlaying()) {
      pause()
    } else {
      play()
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted())
  }

  const seek = (time: number) => {
    if (audioRef) {
      audioRef.currentTime = time
      setCurrentTime(time)
    }
  }

  return {
    get audioRef() { return audioRef },
    setAudioRef,
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
