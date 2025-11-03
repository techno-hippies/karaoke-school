import { useState, useRef, useCallback } from 'react'

/**
 * Record user audio and upload to Grove/IPFS
 *
 * Flow:
 * 1. Start recording via MediaRecorder API
 * 2. Stop recording and get audio blob
 * 3. Convert to base64
 * 4. Upload to Grove via Irys
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

  const stopRecording = useCallback(async (): Promise<string | null> => {
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

            // Upload to Grove
            setIsUploading(true)
            const uri = await uploadToGrove(blob)
            setGroveUri(uri)
            setIsUploading(false)

            console.log('[useAudioRecorder] Uploaded to Grove:', uri)
            resolve(uri)
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

  return {
    isRecording,
    isUploading,
    audioBlob,
    groveUri,
    error,
    startRecording,
    stopRecording,
  }
}

/**
 * Upload audio blob to Grove via Irys
 *
 * TODO: Implement using Irys client (already used in pipeline)
 */
async function uploadToGrove(audioBlob: Blob): Promise<string> {
  // TODO: Use existing Irys integration from karaoke-pipeline
  // For now, return placeholder
  return `grove://${Date.now()}`
}

/**
 * Convert blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] // Remove data:audio/webm;base64, prefix
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
