/**
 * Chat audio hook - handles TTS playback and voice recording for chat
 */

import { createSignal, createEffect, onCleanup } from 'solid-js'
import { createStore } from 'solid-js/store'
import { createAudioRecorder } from '@/hooks/useAudioRecorder'
import {
  synthesizeSpeech,
  createAudioPlayback,
  buildHighlightedContent,
  type TTSWord,
} from '@/lib/chat'
import type { PKPAuthContext } from '@/lib/lit/types'

export interface MessageAudioData {
  audio: string // base64 MP3
  words: TTSWord[]
}

export interface UseChatAudioOptions {
  authContext: () => PKPAuthContext | null | undefined
  onAuthRequired?: () => void
}

export interface UseChatAudioReturn {
  // Recording state
  isRecording: () => boolean
  recordingDuration: () => number
  isProcessingAudio: () => boolean
  startRecording: () => Promise<void>
  stopRecording: () => Promise<{ base64: string } | null>

  // TTS state
  playingMessageId: () => string | null
  loadingTtsIds: () => Set<string>
  currentWordIndex: () => number
  audioDataMap: Record<string, MessageAudioData>

  // TTS actions
  playAudio: (messageId: string, text: string) => Promise<void>
  stopAudio: () => void

  // Utilities
  getHighlightedContent: (
    messageId: string,
    content: string
  ) => string | Array<{ text: string; isHighlighted: boolean }>
  isLoadingTts: (messageId: string) => boolean
  isPlaying: (messageId: string) => boolean
}

export function useChatAudio(options: UseChatAudioOptions): UseChatAudioReturn {
  const { authContext, onAuthRequired } = options

  // Recording state
  const [isRecording, setIsRecording] = createSignal(false)
  const [recordingDuration, setRecordingDuration] = createSignal(0)
  const [isProcessingAudio, setIsProcessingAudio] = createSignal(false)

  // TTS state
  const [audioDataMap, setAudioDataMap] = createStore<Record<string, MessageAudioData>>({})
  const [playingMessageId, setPlayingMessageId] = createSignal<string | null>(null)
  const [loadingTtsIds, setLoadingTtsIds] = createSignal<Set<string>>(new Set())
  const [currentWordIndex, setCurrentWordIndex] = createSignal(-1)

  // Instances
  let audioPlayback: ReturnType<typeof createAudioPlayback> | null = null
  let recordingTimerRef: ReturnType<typeof setInterval> | null = null
  const audioRecorder = createAudioRecorder()

  // Recording duration timer
  createEffect(() => {
    if (isRecording()) {
      setRecordingDuration(0)
      recordingTimerRef = setInterval(() => {
        setRecordingDuration((d) => d + 1)
      }, 1000)
    } else {
      if (recordingTimerRef) {
        clearInterval(recordingTimerRef)
        recordingTimerRef = null
      }
    }
  })

  onCleanup(() => {
    if (recordingTimerRef) {
      clearInterval(recordingTimerRef)
    }
    if (audioPlayback) {
      audioPlayback.stop()
    }
  })

  // Recording handlers
  const startRecording = async () => {
    try {
      setIsRecording(true)
      await audioRecorder.startRecording()
    } catch (error) {
      console.error('[useChatAudio] Failed to start recording:', error)
      setIsRecording(false)
    }
  }

  const stopRecording = async (): Promise<{ base64: string } | null> => {
    setIsRecording(false)
    setIsProcessingAudio(true)

    try {
      const result = await audioRecorder.stopRecording()
      return result
    } catch (error) {
      console.error('[useChatAudio] Recording error:', error)
      return null
    } finally {
      setIsProcessingAudio(false)
    }
  }

  // TTS handlers
  const playAudioData = (messageId: string, data: MessageAudioData) => {
    // Stop any existing playback
    if (audioPlayback) {
      audioPlayback.stop()
    }

    setPlayingMessageId(messageId)
    setCurrentWordIndex(-1)

    // Create playback instance with onEnd callback
    audioPlayback = createAudioPlayback({
      onEnd: () => {
        setPlayingMessageId(null)
        setCurrentWordIndex(-1)
      },
    })

    // Track word index during playback
    createEffect(() => {
      if (audioPlayback && playingMessageId() === messageId) {
        setCurrentWordIndex(audioPlayback.currentWordIndex())
      }
    })

    // Start playback
    audioPlayback.play(data.audio, data.words)
  }

  const playAudio = async (messageId: string, text: string) => {
    const auth = authContext()
    if (!auth) {
      onAuthRequired?.()
      return
    }

    // Check if we already have audio data
    if (audioDataMap[messageId]) {
      playAudioData(messageId, audioDataMap[messageId])
      return
    }

    // Mark as loading
    setLoadingTtsIds((prev) => new Set(prev).add(messageId))

    try {
      const response = await synthesizeSpeech({ text }, auth)

      if (response.success && response.audio) {
        const audioData: MessageAudioData = {
          audio: response.audio,
          words: response.words || [],
        }
        setAudioDataMap(messageId, audioData)
        playAudioData(messageId, audioData)
      }
    } catch (error) {
      console.error('[useChatAudio] TTS error:', error)
    } finally {
      setLoadingTtsIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    }
  }

  const stopAudio = () => {
    if (audioPlayback) {
      audioPlayback.stop()
    }
    setPlayingMessageId(null)
    setCurrentWordIndex(-1)
  }

  // Utilities
  const getHighlightedContent = (
    messageId: string,
    content: string
  ): string | Array<{ text: string; isHighlighted: boolean }> => {
    const audio = audioDataMap[messageId]
    const isThisPlaying = playingMessageId() === messageId

    if (isThisPlaying && audio?.words) {
      return buildHighlightedContent(content, audio.words, currentWordIndex())
    }
    return content
  }

  const isLoadingTts = (messageId: string) => loadingTtsIds().has(messageId)
  const isPlaying = (messageId: string) => playingMessageId() === messageId

  return {
    // Recording
    isRecording,
    recordingDuration,
    isProcessingAudio,
    startRecording,
    stopRecording,

    // TTS
    playingMessageId,
    loadingTtsIds,
    currentWordIndex,
    audioDataMap,
    playAudio,
    stopAudio,

    // Utilities
    getHighlightedContent,
    isLoadingTts,
    isPlaying,
  }
}
