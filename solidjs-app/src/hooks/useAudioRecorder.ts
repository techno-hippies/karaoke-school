/**
 * Audio recording hook for SolidJS
 *
 * Records audio via MediaRecorder API and converts to WAV format.
 *
 * Used by:
 * - Chat: Voice messages to AI tutor
 * - Study/SayItBack: Pronunciation exercises
 *
 * Note: For karaoke line-by-line grading, use createKaraokeRecorder instead
 * which handles continuous recording with timestamp-based slicing.
 */

import { createSignal, onCleanup } from 'solid-js'
import { webmToWav, blobToBase64 } from '@/lib/audio'

export interface AudioRecorderResult {
  blob: Blob
  base64: string
}

export interface AudioRecorderState {
  isRecording: () => boolean
  isProcessing: () => boolean
  error: () => Error | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<AudioRecorderResult | null>
  cancelRecording: () => void
}

/**
 * Create an audio recorder instance
 *
 * @example
 * ```tsx
 * const recorder = createAudioRecorder()
 *
 * const handleRecord = async () => {
 *   await recorder.startRecording()
 *   // ... user speaks ...
 *   const result = await recorder.stopRecording()
 *   if (result) {
 *     sendToSTT(result.base64)
 *   }
 * }
 * ```
 */
export function createAudioRecorder(): AudioRecorderState {
  let mediaRecorder: MediaRecorder | null = null
  let chunks: Blob[] = []

  const [isRecording, setIsRecording] = createSignal(false)
  const [isProcessing, setIsProcessing] = createSignal(false)
  const [error, setError] = createSignal<Error | null>(null)

  const startRecording = async () => {
    try {
      setError(null)
      chunks = []

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Choose best available audio format (iOS Safari only supports MP4/AAC)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm' // Fallback

      // Create recorder with reasonable bitrate for speech
      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 96000,
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onerror = (event) => {
        setError(new Error(`Recording error: ${(event as any).error}`))
      }

      mediaRecorder.start()
      setIsRecording(true)

      console.log('[AudioRecorder] Started recording with', mimeType)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording')
      setError(error)
      console.error('[AudioRecorder] Start failed:', error)
      throw error
    }
  }

  const stopRecording = async (): Promise<AudioRecorderResult | null> => {
    try {
      setError(null)

      if (!mediaRecorder) {
        throw new Error('No active recording')
      }

      const recorder = mediaRecorder

      // Stop recording and wait for data
      return new Promise((resolve, reject) => {
        recorder.onstop = async () => {
          try {
            // Create blob from chunks
            const type = chunks[0]?.type || 'audio/webm'
            const recordingBlob = new Blob(chunks, { type })

            setIsRecording(false)
            setIsProcessing(true)

            console.log('[AudioRecorder] Recording stopped, size:', recordingBlob.size)

            // Convert to WAV (required for Voxtral STT)
            console.log('[AudioRecorder] Converting to WAV...')
            const wavBlob = await webmToWav(recordingBlob)

            console.log('[AudioRecorder] Converted to WAV, size:', wavBlob.size)

            // Convert to base64
            const base64 = await blobToBase64(wavBlob)

            setIsProcessing(false)

            resolve({ blob: wavBlob, base64 })
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to process recording')
            setError(error)
            setIsProcessing(false)
            reject(error)
          }
        }

        // Stop all tracks to release microphone
        recorder.stream.getTracks().forEach((track) => track.stop())
        recorder.stop()
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to stop recording')
      setError(error)
      console.error('[AudioRecorder] Stop failed:', error)
      setIsRecording(false)
      setIsProcessing(false)
      return null
    }
  }

  const cancelRecording = () => {
    if (!mediaRecorder) return

    try {
      // Clear event handlers
      mediaRecorder.ondataavailable = null
      mediaRecorder.onerror = null
      mediaRecorder.onstop = null
    } catch (err) {
      console.warn('[AudioRecorder] Failed to clear handlers', err)
    }

    try {
      // Stop all tracks to release microphone
      mediaRecorder.stream.getTracks().forEach((track) => track.stop())
    } catch (err) {
      console.warn('[AudioRecorder] Failed to stop stream tracks', err)
    }

    try {
      mediaRecorder.stop()
    } catch (err) {
      console.warn('[AudioRecorder] Failed to stop recorder', err)
    }

    mediaRecorder = null
    chunks = []
    setIsRecording(false)
    setIsProcessing(false)
    setError(null)
  }

  // Cleanup on unmount
  onCleanup(() => {
    cancelRecording()
  })

  return {
    isRecording,
    isProcessing,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}

export default createAudioRecorder
