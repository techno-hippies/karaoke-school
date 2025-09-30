/**
 * Voice Recorder Hook
 * Handles audio recording using MediaRecorder API
 * Produces audio blob compatible with Voxstral API (MP3 or WebM)
 */

import { useState, useRef } from 'react'

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  /**
   * Start recording audio from microphone
   */
  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono audio
          sampleRate: 16000, // 16kHz is standard for speech recognition
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      streamRef.current = stream

      // Use MP3 if available, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported('audio/mp3')
        ? 'audio/mp3'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/wav'

      console.log('[VoiceRecorder] Using MIME type:', mimeType)

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000 // 128 kbps
      })
      chunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          console.log('[VoiceRecorder] Data chunk received:', event.data.size, 'bytes')
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        console.log('[VoiceRecorder] Recording stopped, blob size:', blob.size, 'bytes')
        setAudioBlob(blob)

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorderRef.current.onerror = (event: any) => {
        console.error('[VoiceRecorder] Error:', event.error)
        setError(event.error?.message || 'Recording error')
        stopRecording()
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setError(null)
      console.log('[VoiceRecorder] ✅ Recording started')
    } catch (err: any) {
      console.error('[VoiceRecorder] Error starting recording:', err)
      setError(err.message || 'Failed to access microphone')

      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.')
      }
    }
  }

  /**
   * Stop recording
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      console.log('[VoiceRecorder] Stopping recording...')
    }
  }

  /**
   * Clear recording and reset state
   */
  const clearRecording = () => {
    setAudioBlob(null)
    chunksRef.current = []
    setError(null)
    console.log('[VoiceRecorder] Recording cleared')
  }

  /**
   * Cancel recording (stop without saving)
   */
  const cancelRecording = () => {
    if (isRecording) {
      // Stop recording but don't save blob
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
        setIsRecording(false)
      }

      // Stop tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      // Clear chunks
      chunksRef.current = []
      setAudioBlob(null)
      console.log('[VoiceRecorder] Recording cancelled')
    }
  }

  return {
    isRecording,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    clearRecording,
    cancelRecording,
    hasAudio: !!audioBlob
  }
}