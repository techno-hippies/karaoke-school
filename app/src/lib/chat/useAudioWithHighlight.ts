/**
 * useAudioWithHighlight - Play TTS audio with word-by-word highlighting
 *
 * Syncs audio playback with word timestamps from Kokoro TTS.
 * Returns current word index for highlighting in ChatMessage.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { TTSWord } from './service'

export interface UseAudioWithHighlightOptions {
  /** Called when playback ends */
  onEnd?: () => void
}

export interface UseAudioWithHighlightReturn {
  /** Play audio with word highlighting */
  play: (audioBase64: string, words: TTSWord[]) => void
  /** Stop playback */
  stop: () => void
  /** Whether audio is currently playing */
  isPlaying: boolean
  /** Current word index being spoken (-1 if not playing) */
  currentWordIndex: number
  /** Current playback time in seconds */
  currentTime: number
}

/**
 * Hook for playing TTS audio with synchronized word highlighting
 */
export function useAudioWithHighlight(
  options: UseAudioWithHighlightOptions = {}
): UseAudioWithHighlightReturn {
  const { onEnd } = options

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const [currentTime, setCurrentTime] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const wordsRef = useRef<TTSWord[]>([])
  const animationFrameRef = useRef<number | null>(null)

  // Update current word based on playback time
  const updateCurrentWord = useCallback(() => {
    if (!audioRef.current || !wordsRef.current.length) return

    const time = audioRef.current.currentTime
    setCurrentTime(time)

    // Find the word that contains the current time
    let wordIdx = -1
    for (let i = 0; i < wordsRef.current.length; i++) {
      const word = wordsRef.current[i]
      if (time >= word.start && time < word.end) {
        wordIdx = i
        break
      }
      // If we're past the end of a word but before the next, stay on current
      if (time >= word.end && (i === wordsRef.current.length - 1 || time < wordsRef.current[i + 1].start)) {
        wordIdx = i
        break
      }
    }

    setCurrentWordIndex(wordIdx)

    // Continue animation loop while playing
    if (audioRef.current && !audioRef.current.paused) {
      animationFrameRef.current = requestAnimationFrame(updateCurrentWord)
    }
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const play = useCallback((audioBase64: string, words: TTSWord[]) => {
    // Stop any existing playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Store words for highlighting
    wordsRef.current = words

    // Create audio element from base64
    // Handle both raw base64 and data URL formats
    const audioSrc = audioBase64.startsWith('data:') ? audioBase64 : `data:audio/mp3;base64,${audioBase64}`
    console.log('[useAudioWithHighlight] Creating audio:', {
      srcLength: audioSrc.length,
      srcPrefix: audioSrc.substring(0, 60),
      wordsCount: words.length,
    })
    const audio = new Audio(audioSrc)
    audioRef.current = audio

    // Set up event handlers
    audio.onplay = () => {
      console.log('[useAudioWithHighlight] Audio started playing')
      setIsPlaying(true)
      setCurrentWordIndex(0)
      animationFrameRef.current = requestAnimationFrame(updateCurrentWord)
    }

    audio.onended = () => {
      console.log('[useAudioWithHighlight] Audio ended')
      setIsPlaying(false)
      setCurrentWordIndex(-1)
      setCurrentTime(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      onEnd?.()
    }

    audio.onerror = (e) => {
      console.error('[useAudioWithHighlight] Audio error:', e, audio.error)
      setIsPlaying(false)
      setCurrentWordIndex(-1)
    }

    // Start playback
    console.log('[useAudioWithHighlight] Calling audio.play()')
    audio.play().catch((err) => {
      console.error('[useAudioWithHighlight] Failed to play:', err)
      setIsPlaying(false)
    })
  }, [updateCurrentWord, onEnd])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setIsPlaying(false)
    setCurrentWordIndex(-1)
    setCurrentTime(0)
  }, [])

  return {
    play,
    stop,
    isPlaying,
    currentWordIndex,
    currentTime,
  }
}
