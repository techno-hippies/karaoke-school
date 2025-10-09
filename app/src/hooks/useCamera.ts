/**
 * useCamera Hook
 * Manages camera stream with permissions, device detection, and cleanup
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export type CameraErrorType = 'permission' | 'unavailable' | 'technical'

export interface CameraError {
  type: CameraErrorType
  title: string
  message: string
  canRetry: boolean
  canUseAudioOnly: boolean
}

export interface UseCameraOptions {
  /** Whether video should be enabled (false = audio-only) */
  videoEnabled: boolean
  /** Camera facing mode */
  facingMode?: 'user' | 'environment'
  /** Whether to request audio (microphone) */
  audioEnabled?: boolean
}

export interface UseCameraReturn {
  /** Camera + mic stream */
  stream: MediaStream | null
  /** Ref to attach to video element for preview */
  videoRef: React.RefObject<HTMLVideoElement>
  /** Structured error information */
  error: CameraError | null
  /** Whether stream is ready */
  isReady: boolean
  /** Whether device has multiple cameras */
  hasMultipleCameras: boolean
  /** Switch between front/back camera */
  switchCamera: () => void
  /** Current facing mode */
  currentFacingMode: 'user' | 'environment'
}

/**
 * Converts getUserMedia errors into user-friendly structured errors
 */
function categorizeError(err: any): CameraError {
  const errorName = err?.name || ''

  // Permission errors
  if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
    return {
      type: 'permission',
      title: 'Permission Required',
      message: 'Click the camera icon in your browser address bar to allow access',
      canRetry: false, // Browser won't prompt again without user action
      canUseAudioOnly: true
    }
  }

  if (errorName === 'SecurityError') {
    return {
      type: 'permission',
      title: 'Permission Required',
      message: 'Camera access is blocked. Check your browser settings.',
      canRetry: false,
      canUseAudioOnly: true
    }
  }

  // Hardware/device errors
  if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
    return {
      type: 'unavailable',
      title: 'Camera Unavailable',
      message: 'No camera found. Please connect a camera or try audio-only mode.',
      canRetry: true,
      canUseAudioOnly: true
    }
  }

  if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
    return {
      type: 'unavailable',
      title: 'Camera Unavailable',
      message: 'Camera is in use by another app. Close other apps and try again.',
      canRetry: true,
      canUseAudioOnly: true
    }
  }

  if (errorName === 'OverconstrainedError' || errorName === 'ConstraintNotSatisfiedError') {
    return {
      type: 'unavailable',
      title: 'Camera Unavailable',
      message: 'Your camera doesn\'t support the required settings.',
      canRetry: true,
      canUseAudioOnly: true
    }
  }

  // Technical/unknown errors
  return {
    type: 'technical',
    title: 'Something Went Wrong',
    message: 'Unable to access camera. This may be temporary.',
    canRetry: true,
    canUseAudioOnly: true
  }
}

export function useCamera({
  videoEnabled,
  facingMode = 'user',
  audioEnabled = true
}: UseCameraOptions): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<CameraError | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>(facingMode)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Detect available devices
  useEffect(() => {
    async function detectDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        setHasMultipleCameras(videoDevices.length > 1)
      } catch (err) {
        console.warn('[useCamera] Failed to enumerate devices:', err)
      }
    }
    detectDevices()
  }, [])

  // Initialize camera stream
  useEffect(() => {
    let mounted = true
    let currentStream: MediaStream | null = null

    async function initializeStream() {
      try {
        console.log('[useCamera] Requesting camera/mic access...', {
          videoEnabled,
          audioEnabled,
          facingMode: currentFacingMode
        })

        setError(null)
        setIsReady(false)

        const constraints: MediaStreamConstraints = {
          audio: audioEnabled ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false, // Keep raw volume for accurate recording
            sampleRate: 48000,
            channelCount: 1 // Mono
          } : false,
          video: videoEnabled ? {
            facingMode: currentFacingMode,
            width: { ideal: 1080 },
            height: { ideal: 1920 },
            frameRate: { ideal: 30 }
          } : false
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

        if (!mounted) {
          // Component unmounted during request, cleanup
          mediaStream.getTracks().forEach(track => track.stop())
          return
        }

        currentStream = mediaStream
        setStream(mediaStream)
        setIsReady(true)

        // Attach to video element for preview
        if (videoRef.current && videoEnabled) {
          videoRef.current.srcObject = mediaStream
          videoRef.current.play().catch(err => {
            console.warn('[useCamera] Video play failed:', err)
          })
        }

        console.log('[useCamera] ✅ Stream initialized', {
          videoTracks: mediaStream.getVideoTracks().length,
          audioTracks: mediaStream.getAudioTracks().length
        })

      } catch (err: any) {
        console.error('[useCamera] Failed to get user media:', err)

        if (!mounted) return

        // Convert to structured error
        const structuredError = categorizeError(err)
        setError(structuredError)
        setIsReady(false)

        console.log('[useCamera] Error categorized:', structuredError)
      }
    }

    initializeStream()

    // Cleanup function
    return () => {
      mounted = false
      if (currentStream) {
        console.log('[useCamera] Cleaning up stream')
        currentStream.getTracks().forEach(track => {
          track.stop()
          console.log('[useCamera] Stopped track:', track.kind, track.label)
        })
      }
    }
  }, [videoEnabled, audioEnabled, currentFacingMode])

  // Switch camera (front/back)
  const switchCamera = useCallback(() => {
    if (!hasMultipleCameras) {
      console.warn('[useCamera] Cannot switch camera - only one camera available')
      return
    }
    setCurrentFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [hasMultipleCameras])

  // Handle page visibility change (pause/cleanup when hidden)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && stream) {
        console.log('[useCamera] Page hidden, stream will be cleaned up on unmount')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [stream])

  return {
    stream,
    videoRef,
    error,
    isReady,
    hasMultipleCameras,
    switchCamera,
    currentFacingMode
  }
}
