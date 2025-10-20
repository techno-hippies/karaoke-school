/**
 * useKaraokeRecorder Hook
 * Manages karaoke recording with Web Audio API mixing
 * Combines microphone + instrumental into single output
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export interface UseKaraokeRecorderOptions {
  /** Camera/mic stream from useCamera */
  cameraStream: MediaStream | null
  /** Instrumental source node from useInstrumental */
  instrumentalSource: MediaElementAudioSourceNode | null
  /** Audio context from useInstrumental */
  audioContext: AudioContext | null
  /** Whether to record video (true) or audio-only (false) */
  videoEnabled: boolean
  /** Callback when recording completes */
  onComplete?: (blob: Blob) => void
  /** Mic gain level (0-1, default 1.0) */
  micGain?: number
  /** Instrumental gain level (0-1, default 0.6) */
  instrumentalGain?: number
}

export interface UseKaraokeRecorderReturn {
  /** Whether currently recording */
  isRecording: boolean
  /** Start recording */
  start: () => void
  /** Stop recording */
  stop: () => void
  /** Recording error */
  error: string | null
  /** Whether recorder is ready to record */
  isReady: boolean
}

export function useKaraokeRecorder({
  cameraStream,
  instrumentalSource,
  audioContext,
  videoEnabled,
  onComplete,
  micGain = 1.0,
  instrumentalGain = 0.6
}: UseKaraokeRecorderOptions): UseKaraokeRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mixedStreamRef = useRef<MediaStream | null>(null)

  // Audio nodes for mixing
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const micGainNodeRef = useRef<GainNode | null>(null)
  const bgGainNodeRef = useRef<GainNode | null>(null)
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)

  // Setup audio mixing graph
  useEffect(() => {
    if (!cameraStream || !instrumentalSource || !audioContext) {
      setIsReady(false)
      return
    }

    console.log('[useKaraokeRecorder] Setting up audio mixing graph')

    try {
      // Create microphone source from camera stream
      const micSource = audioContext.createMediaStreamSource(cameraStream)
      micSourceRef.current = micSource

      // Create gain nodes
      const micGainNode = audioContext.createGain()
      micGainNode.gain.value = micGain
      micGainNodeRef.current = micGainNode

      const bgGainNode = audioContext.createGain()
      bgGainNode.gain.value = instrumentalGain
      bgGainNodeRef.current = bgGainNode

      // Create destination for mixed audio
      const destination = audioContext.createMediaStreamDestination()
      destinationRef.current = destination

      // Connect audio graph:
      // Mic → MicGain → Destination (recording)
      micSource.connect(micGainNode)
      micGainNode.connect(destination)

      // Instrumental → BgGain → Destination (recording)
      // Also connect to speakers so user can hear it
      instrumentalSource.connect(bgGainNode)
      bgGainNode.connect(destination)
      bgGainNode.connect(audioContext.destination) // Speakers

      console.log('[useKaraokeRecorder] ✅ Audio mixing graph connected', {
        micGain,
        instrumentalGain
      })

      // Create combined stream with video (if enabled) + mixed audio
      const tracks = [
        ...(videoEnabled ? cameraStream.getVideoTracks() : []),
        ...destination.stream.getAudioTracks()
      ]
      const mixedStream = new MediaStream(tracks)
      mixedStreamRef.current = mixedStream

      // Determine MIME type
      let mimeType: string
      if (videoEnabled) {
        // Video recording
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus'
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm'
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4'
        } else {
          throw new Error('No supported video MIME type found')
        }
      } else {
        // Audio-only recording
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus'
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else {
          throw new Error('No supported audio MIME type found')
        }
      }

      console.log('[useKaraokeRecorder] Using MIME type:', mimeType)

      // Create MediaRecorder
      const recorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: videoEnabled ? 2500000 : undefined, // 2.5 Mbps for video
        audioBitsPerSecond: 128000 // 128 kbps for audio
      })

      // Handle data available
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          console.log('[useKaraokeRecorder] Chunk received:', event.data.size, 'bytes')
        }
      }

      // Handle recording start
      recorder.onstart = () => {
        console.log('[useKaraokeRecorder] MediaRecorder started')
        chunksRef.current = [] // Clear previous chunks
      }

      // Handle recording stop
      recorder.onstop = () => {
        console.log('[useKaraokeRecorder] MediaRecorder stopped, creating blob')

        if (chunksRef.current.length === 0) {
          console.error('[useKaraokeRecorder] No recorded chunks available')
          setError('Recording failed - no data captured')
          return
        }

        const blob = new Blob(chunksRef.current, { type: mimeType })
        console.log('[useKaraokeRecorder] ✅ Blob created:', blob.size, 'bytes')

        // Call completion callback
        onComplete?.(blob)
      }

      // Handle errors
      recorder.onerror = (event: any) => {
        console.error('[useKaraokeRecorder] MediaRecorder error:', event.error)
        setError(event.error?.message || 'Recording error')
      }

      mediaRecorderRef.current = recorder
      setIsReady(true)
      setError(null)

    } catch (err: any) {
      console.error('[useKaraokeRecorder] Setup failed:', err)
      setError(err.message || 'Failed to setup recorder')
      setIsReady(false)
    }

    // Cleanup
    return () => {
      console.log('[useKaraokeRecorder] Cleaning up audio graph')

      // Disconnect audio nodes
      micSourceRef.current?.disconnect()
      micGainNodeRef.current?.disconnect()
      bgGainNodeRef.current?.disconnect()
      destinationRef.current?.disconnect()

      micSourceRef.current = null
      micGainNodeRef.current = null
      bgGainNodeRef.current = null
      destinationRef.current = null
      mixedStreamRef.current = null
    }
  }, [cameraStream, instrumentalSource, audioContext, videoEnabled, micGain, instrumentalGain, onComplete])

  // Start recording
  const start = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || !isReady) {
      console.warn('[useKaraokeRecorder] Cannot start - recorder not ready')
      setError('Recorder not ready')
      return
    }

    if (isRecording) {
      console.warn('[useKaraokeRecorder] Already recording')
      return
    }

    try {
      console.log('[useKaraokeRecorder] Starting recording')
      recorder.start(100) // Record in 100ms chunks
      setIsRecording(true)
      setError(null)
    } catch (err: any) {
      console.error('[useKaraokeRecorder] Failed to start recording:', err)
      setError(err.message || 'Failed to start recording')
    }
  }, [isReady, isRecording])

  // Stop recording
  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) {
      console.warn('[useKaraokeRecorder] No recorder to stop')
      return
    }

    if (!isRecording) {
      console.warn('[useKaraokeRecorder] Not currently recording')
      return
    }

    try {
      console.log('[useKaraokeRecorder] Stopping recording')
      recorder.stop()
      setIsRecording(false)
    } catch (err: any) {
      console.error('[useKaraokeRecorder] Failed to stop recording:', err)
      setError(err.message || 'Failed to stop recording')
    }
  }, [isRecording])

  return {
    isRecording,
    start,
    stop,
    error,
    isReady
  }
}
