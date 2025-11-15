import { useState, useRef, useCallback } from 'react'

/**
 * Record user audio and upload to Grove/IPFS
 *
 * Flow:
 * 1. Start recording via MediaRecorder API
 * 2. Stop recording and get audio blob
 * 3. Convert to base64
 * 4. Upload to Grove via IPFS
 * 5. Return grove:// URI
 *
 * @returns { isRecording, audioBlob, groveUri, startRecording, stopRecording, error }
 */
export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [groveUri, setGroveUri] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      chunksRef.current = []
      setAudioBlob(null)
      setGroveUri(null)

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Create recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = (event) => {
        setError(new Error(`Recording error: ${event.error}`))
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording')
      setError(error)
      console.error('[useAudioRecorder] Start failed:', error)
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<{ blob: Blob; base64: string; groveUri: string } | null> => {
    try {
      setError(null)

      if (!mediaRecorderRef.current) {
        throw new Error('No active recording')
      }

      const mediaRecorder = mediaRecorderRef.current

      // Stop recording and wait for data
      return new Promise((resolve, reject) => {
        mediaRecorder.onstop = async () => {
          try {
            // Create blob from chunks
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
            setAudioBlob(blob)
            setIsRecording(false)

            console.log('[useAudioRecorder] Recording stopped, blob size:', blob.size)

            // Convert to base64
            const base64 = await blobToBase64(blob)

            // Upload to Grove
            setIsUploading(true)
            const uri = await uploadToGrove()
            setGroveUri(uri)
            setIsUploading(false)

            console.log('[useAudioRecorder] Uploaded to Grove:', uri)
            resolve({ blob, base64, groveUri: uri })
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to process recording')
            setError(error)
            reject(error)
          }
        }

        mediaRecorder.stop()
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to stop recording')
      setError(error)
      console.error('[useAudioRecorder] Stop failed:', error)
      setIsRecording(false)
      return null
    }
  }, [])

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    try {
      recorder.ondataavailable = null
      recorder.onerror = null
      recorder.onstop = null
    } catch (err) {
      console.warn('[useAudioRecorder] Failed to clear recorder handlers', err)
    }

    try {
      recorder.stream.getTracks().forEach((track) => track.stop())
    } catch (err) {
      console.warn('[useAudioRecorder] Failed to stop stream tracks', err)
    }

    try {
      recorder.stop()
    } catch (err) {
      console.warn('[useAudioRecorder] Failed to stop recorder', err)
    }

    mediaRecorderRef.current = null
    chunksRef.current = []
    setIsRecording(false)
    setAudioBlob(null)
    setGroveUri(null)
    setError(null)
    setIsUploading(false)
  }, [])

  return {
    isRecording,
    isUploading,
    audioBlob,
    groveUri,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}

/**
 * Upload audio blob to Grove via IPFS
 *
 * TODO: Implement using Grove client (already used in pipeline)
 */
async function uploadToGrove(): Promise<string> {
  // TODO: Use existing Grove integration from karaoke-pipeline
  // For now, return placeholder
  return `grove://${Date.now()}`
}

/**
 * Convert blob to base64 string
 *
 * Handles the data URL format returned by FileReader.readAsDataURL()
 * Example: "data:audio/webm;base64,abc123..." → "abc123..."
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      try {
        const result = reader.result as string
        if (!result) {
          throw new Error('FileReader returned empty result')
        }

        // Extract base64 portion after "data:...;base64,"
        const parts = result.split(',')
        if (parts.length < 2) {
          throw new Error(`Invalid data URL format: expected comma separator, got "${result.substring(0, 50)}"`)
        }

        const base64 = parts[1]
        if (!base64) {
          throw new Error('No base64 data found after comma')
        }

        console.log('[blobToBase64] Converted blob to base64, length:', base64.length)
        resolve(base64)
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
    reader.onerror = (error) => {
      reject(new Error(`FileReader error: ${error}`))
    }
    reader.readAsDataURL(blob)
  })
}
