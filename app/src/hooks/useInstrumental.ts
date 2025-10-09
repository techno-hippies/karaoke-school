/**
 * useInstrumental Hook
 * Manages instrumental track playback with Web Audio API integration
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export interface UseInstrumentalOptions {
  /** URL of the instrumental audio track */
  audioUrl: string
  /** Start time in seconds (for segment) */
  startTime: number
  /** End time in seconds (for segment) */
  endTime: number
}

export interface UseInstrumentalReturn {
  /** Audio element reference */
  audioElement: HTMLAudioElement | null
  /** Current playback time (seconds) */
  currentTime: number
  /** Whether audio is playing */
  isPlaying: boolean
  /** Audio context for Web Audio API mixing */
  audioContext: AudioContext | null
  /** Media element source node (created ONCE) */
  sourceNode: MediaElementAudioSourceNode | null
  /** Start playback from segment start */
  start: () => void
  /** Stop playback */
  stop: () => void
  /** Whether audio is ready to play */
  isReady: boolean
  /** Loading/playback error */
  error: string | null
}

export function useInstrumental({
  audioUrl,
  startTime,
  endTime
}: UseInstrumentalOptions): UseInstrumentalReturn {
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const stopTimerRef = useRef<number | null>(null)
  const timeUpdateIntervalRef = useRef<number | null>(null)

  // Create audio element and Web Audio API nodes ONCE
  useEffect(() => {
    console.log('[useInstrumental] Initializing audio element', { audioUrl, startTime, endTime })

    // Create audio element
    const audio = new Audio()
    audio.src = audioUrl
    audio.preload = 'auto'
    audio.crossOrigin = 'anonymous' // Important for Web Audio API
    audioElementRef.current = audio

    // Create audio context
    const context = new AudioContext()
    audioContextRef.current = context

    // Handle audio ready state
    const handleCanPlay = () => {
      console.log('[useInstrumental] ✅ Audio ready to play')
      setIsReady(true)
      setError(null)
    }

    const handleError = (e: ErrorEvent) => {
      console.error('[useInstrumental] Audio load error:', e)
      setError('Failed to load instrumental track')
      setIsReady(false)
    }

    const handleLoadStart = () => {
      console.log('[useInstrumental] Loading audio...')
      setIsReady(false)
    }

    audio.addEventListener('canplaythrough', handleCanPlay)
    audio.addEventListener('error', handleError as any)
    audio.addEventListener('loadstart', handleLoadStart)

    // Create MediaElementSource ONCE (cannot be recreated)
    try {
      const source = context.createMediaElementSource(audio)
      sourceNodeRef.current = source
      console.log('[useInstrumental] ✅ MediaElementSource created')
    } catch (err) {
      console.error('[useInstrumental] Failed to create MediaElementSource:', err)
      setError('Failed to initialize audio system')
    }

    // Cleanup
    return () => {
      console.log('[useInstrumental] Cleaning up audio')
      audio.pause()
      audio.removeEventListener('canplaythrough', handleCanPlay)
      audio.removeEventListener('error', handleError as any)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.src = ''

      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
      }
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current)
      }

      // Don't close AudioContext here - it's managed by useKaraokeRecorder
      // sourceNodeRef.current?.disconnect()
      // audioContextRef.current?.close()
    }
  }, [audioUrl]) // Only recreate if audioUrl changes

  // Start playback
  const start = useCallback(() => {
    const audio = audioElementRef.current
    if (!audio || !isReady) {
      console.warn('[useInstrumental] Cannot start - audio not ready')
      return
    }

    console.log('[useInstrumental] Starting playback from', startTime, 'to', endTime)

    // Set playback position to segment start
    audio.currentTime = startTime
    setCurrentTime(startTime)

    // Start playback
    audio.play().catch(err => {
      console.error('[useInstrumental] Play failed:', err)
      setError('Failed to play audio')
    })

    setIsPlaying(true)

    // Update current time for lyrics sync
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
    }
    timeUpdateIntervalRef.current = window.setInterval(() => {
      if (audio && !audio.paused) {
        setCurrentTime(audio.currentTime)
      }
    }, 100) // Update every 100ms for smooth lyrics

    // Auto-stop at segment end
    const duration = (endTime - startTime) * 1000
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
    }
    stopTimerRef.current = window.setTimeout(() => {
      console.log('[useInstrumental] Auto-stopping at segment end')
      stop()
    }, duration)

  }, [startTime, endTime, isReady])

  // Stop playback
  const stop = useCallback(() => {
    const audio = audioElementRef.current
    if (!audio) return

    console.log('[useInstrumental] Stopping playback')
    audio.pause()
    setIsPlaying(false)

    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
      timeUpdateIntervalRef.current = null
    }

    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
  }, [])

  // Auto-resume AudioContext if suspended (mobile Safari requirement)
  useEffect(() => {
    const context = audioContextRef.current
    if (!context) return

    if (context.state === 'suspended') {
      console.log('[useInstrumental] AudioContext suspended, will resume on user gesture')
    }

    const resumeContext = () => {
      if (context.state === 'suspended') {
        context.resume().then(() => {
          console.log('[useInstrumental] ✅ AudioContext resumed')
        })
      }
    }

    // Resume on any user interaction
    document.addEventListener('click', resumeContext, { once: true })
    document.addEventListener('touchstart', resumeContext, { once: true })

    return () => {
      document.removeEventListener('click', resumeContext)
      document.removeEventListener('touchstart', resumeContext)
    }
  }, [])

  return {
    audioElement: audioElementRef.current,
    currentTime,
    isPlaying,
    audioContext: audioContextRef.current,
    sourceNode: sourceNodeRef.current,
    start,
    stop,
    isReady,
    error
  }
}
