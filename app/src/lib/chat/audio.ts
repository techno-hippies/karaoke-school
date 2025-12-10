/**
 * Audio playback utilities for chat TTS
 *
 * Handles:
 * - Base64 MP3 decoding and playback
 * - Word-by-word highlighting sync
 */

import { createSignal, onCleanup } from 'solid-js'
import type { TTSWord } from './types'

interface UseAudioPlaybackOptions {
  onEnd?: () => void
}

interface UseAudioPlaybackReturn {
  play: (audioBase64: string, words: TTSWord[]) => void
  stop: () => void
  isPlaying: () => boolean
  currentWordIndex: () => number
}

/**
 * Hook for audio playback with word-level highlighting sync
 */
export function createAudioPlayback(
  options: UseAudioPlaybackOptions = {}
): UseAudioPlaybackReturn {
  const [isPlaying, setIsPlaying] = createSignal(false)
  const [currentWordIndex, setCurrentWordIndex] = createSignal(-1)

  let audioElement: HTMLAudioElement | null = null
  let animationFrameId: number | null = null
  let currentWords: TTSWord[] = []

  const updateHighlight = () => {
    if (!audioElement || !isPlaying()) return

    const currentTime = audioElement.currentTime
    let newIndex = -1

    // Find the word that contains the current time
    for (let i = 0; i < currentWords.length; i++) {
      const word = currentWords[i]
      if (currentTime >= word.start && currentTime < word.end) {
        newIndex = i
        break
      }
    }

    if (newIndex !== currentWordIndex()) {
      setCurrentWordIndex(newIndex)
    }

    // Continue the loop
    animationFrameId = requestAnimationFrame(updateHighlight)
  }

  const play = (audioBase64: string, words: TTSWord[]) => {
    // Stop any existing playback
    stop()

    currentWords = words

    // Create audio element from base64
    // Handle both raw base64 and data URL formats
    const audioSrc = audioBase64.startsWith('data:')
      ? audioBase64
      : `data:audio/mp3;base64,${audioBase64}`
    audioElement = new Audio(audioSrc)

    audioElement.onplay = () => {
      setIsPlaying(true)
      animationFrameId = requestAnimationFrame(updateHighlight)
    }

    audioElement.onended = () => {
      setIsPlaying(false)
      setCurrentWordIndex(-1)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
      options.onEnd?.()
    }

    audioElement.onerror = (e) => {
      console.error('[AudioPlayback] Error:', e)
      setIsPlaying(false)
      setCurrentWordIndex(-1)
    }

    audioElement.play().catch((error) => {
      console.error('[AudioPlayback] Play failed:', error)
      setIsPlaying(false)
    })
  }

  const stop = () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
      audioElement = null
    }

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    currentWords = []
    setIsPlaying(false)
    setCurrentWordIndex(-1)
  }

  // Cleanup on unmount
  onCleanup(() => {
    stop()
  })

  return {
    play,
    stop,
    isPlaying,
    currentWordIndex,
  }
}

/**
 * Merge standalone quote tokens with adjacent words
 * Fixes spacing issues from TTS word tokenization
 */
export function mergeQuoteTokens(words: TTSWord[]): TTSWord[] {
  const mergedWords: TTSWord[] = []

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const text = word.text.trim()

    // Skip empty
    if (!text) continue

    // Check for quote characters (straight and curly)
    const isQuote = /^["'""'']+$/.test(text)

    const nextWord = words[i + 1]
    const nextText = nextWord?.text.trim() || ''
    const prevMerged = mergedWords[mergedWords.length - 1]
    const prevText = prevMerged?.text || ''

    // Determine if this quote is opening or closing based on context
    const prevIsSentenceEnd = !prevText || /[.!?]$/.test(prevText)
    const nextStartsWithLetter = /^[a-zA-Z]/.test(nextText)
    const prevEndsWithLetter = /[a-zA-Z]$/.test(prevText)

    if (isQuote && prevIsSentenceEnd && nextStartsWithLetter) {
      // Opening quote: merge with next word
      mergedWords.push({
        ...nextWord,
        text: text + nextText,
        start: word.start,
      })
      i++ // Skip next word since we merged it
    } else if (isQuote && prevEndsWithLetter && prevMerged) {
      // Closing quote after word: merge with previous
      prevMerged.text = prevMerged.text + text
      prevMerged.end = word.end
    } else if (isQuote && prevMerged && /[…,;:]$/.test(prevText)) {
      // Closing quote after punctuation: merge with previous
      prevMerged.text = prevMerged.text + text
      prevMerged.end = word.end
    } else {
      mergedWords.push({ ...word, text })
    }
  }

  return mergedWords
}

/**
 * Build highlighted content that preserves emojis and non-spoken characters.
 * Maps TTS words back to original text, keeping emojis as non-highlighted segments.
 */
export function buildHighlightedContent(
  originalText: string,
  ttsWords: TTSWord[],
  currentWordIdx: number
): Array<{ text: string; isHighlighted: boolean }> {
  const result: Array<{ text: string; isHighlighted: boolean }> = []

  // Regex to match emoji sequences
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|✨|🎤|✈️|🎧/gu

  let searchPos = 0
  let wordIdx = 0

  for (const ttsWord of ttsWords) {
    const wordText = ttsWord.text.trim()
    if (!wordText) {
      wordIdx++
      continue
    }

    // Find this word in the original text (case-insensitive, skip emojis/whitespace)
    let foundPos = -1
    for (let i = searchPos; i < originalText.length; i++) {
      // Check if originalText starting at i matches wordText (ignoring case)
      const slice = originalText.slice(i, i + wordText.length)
      if (slice.toLowerCase() === wordText.toLowerCase()) {
        foundPos = i
        break
      }
    }

    if (foundPos === -1) {
      // Word not found, just add it
      result.push({ text: wordText + ' ', isHighlighted: wordIdx === currentWordIdx })
      wordIdx++
      continue
    }

    // Add any skipped content (emojis, extra spaces) as non-highlighted
    if (foundPos > searchPos) {
      const skipped = originalText.slice(searchPos, foundPos)
      if (skipped.trim() || emojiRegex.test(skipped)) {
        result.push({ text: skipped, isHighlighted: false })
      }
    }

    // Add the word with highlighting
    const actualWord = originalText.slice(foundPos, foundPos + wordText.length)
    result.push({ text: actualWord, isHighlighted: wordIdx === currentWordIdx })

    searchPos = foundPos + wordText.length
    wordIdx++

    // Add trailing space if present in original
    if (originalText[searchPos] === ' ') {
      result.push({ text: ' ', isHighlighted: false })
      searchPos++
    }
  }

  // Add any remaining content (trailing emojis, etc.)
  if (searchPos < originalText.length) {
    const remaining = originalText.slice(searchPos)
    if (remaining.trim() || emojiRegex.test(remaining)) {
      result.push({ text: remaining, isHighlighted: false })
    }
  }

  return result
}

/**
 * Format recording duration as M:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
