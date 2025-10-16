/**
 * HLS Video Player with Encrypted Segment Decryption
 *
 * Uses HLS.js with custom loader to decrypt segments on-the-fly
 */

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Spinner } from '@/components/ui/spinner'
import type { EncryptionMetadata, HLSMetadata } from '@/lib/lit/decrypt-video'
import { decryptSymmetricKey, decryptSegment } from '@/lib/lit/decrypt-video'
import type { PKPInfo, AuthData } from '@/lib/lit-webauthn/types'

interface HLSPlayerProps {
  playlistUrl: string
  thumbnailUrl?: string
  hlsMetadata: HLSMetadata
  encryption: EncryptionMetadata
  pkpInfo: PKPInfo
  authData: AuthData
  className?: string
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  controls?: boolean
  onError?: (error: Error) => void
  onTimeUpdate?: (currentTime: number) => void
}

/**
 * Converts lens:// URI to Grove storage URL
 */
function lensToGroveUrl(lensUri: string): string {
  if (!lensUri) return ''
  const lower = lensUri.toLowerCase()
  if (!lower.startsWith('lens') && !lower.startsWith('glen')) return lensUri

  const hash = lensUri
    .replace(/^(lens|glens?):\/\//i, '')
    .replace(/:\d+$/, '')

  return `https://api.grove.storage/${hash}`
}

export function HLSPlayer({
  playlistUrl,
  thumbnailUrl,
  hlsMetadata,
  encryption,
  pkpInfo,
  authData,
  className = '',
  autoPlay = false,
  muted = false,
  loop = false,
  controls = true,
  onError,
  onTimeUpdate,
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const symmetricKeyRef = useRef<Uint8Array | null>(null)
  const isInitializedRef = useRef(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Prevent double initialization (React StrictMode)
    if (isInitializedRef.current) {
      console.log('[HLSPlayer] Already initialized, skipping')
      return
    }

    console.log('[HLSPlayer] Initializing HLS player...')
    console.log('[HLSPlayer] Playlist:', playlistUrl)
    console.log('[HLSPlayer] Segments:', hlsMetadata.segmentCount)

    // Check if HLS.js is supported
    if (!Hls.isSupported()) {
      const errorMsg = 'HLS.js is not supported in this browser'
      console.error('[HLSPlayer]', errorMsg)
      setError(errorMsg)
      onError?.(new Error(errorMsg))
      return
    }

    isInitializedRef.current = true
    cancelledRef.current = false

    // Initialize: Decrypt symmetric key ONCE
    const init = async () => {
      try {
        console.log('[HLSPlayer] Decrypting symmetric key...')
        const symmetricKey = await decryptSymmetricKey(encryption, pkpInfo, authData)

        if (cancelledRef.current) return

        symmetricKeyRef.current = symmetricKey
        console.log('[HLSPlayer] ✅ Symmetric key decrypted, ready to play')

        // Create custom loader that decrypts segments
        const customLoader = class extends Hls.DefaultConfig.loader! {
          constructor(config: any) {
            super(config)
          }

          load(
            context: any,
            config: any,
            callbacks: {
              onSuccess: (response: any, stats: any, context: any) => void
              onError: (error: any, context: any) => void
              onTimeout: (stats: any, context: any) => void
            }
          ) {
            const url = context.url

            // Check if this is a segment (ends with .ts)
            const isSegment = url.endsWith('.ts')

            if (!isSegment) {
              // Playlist file - fetch normally
              super.load(context, config, callbacks)
              return
            }

            // Extract filename from URL (handle both relative and absolute URLs)
            const filename = url.split('/').pop()!

            // Find segment metadata
            const segmentMeta = encryption.segments.find(s => s.filename === filename)

            if (!segmentMeta) {
              console.error('[HLSPlayer] No encryption metadata for segment:', filename)
              callbacks.onError({ code: 404, text: 'Segment metadata not found' }, context)
              return
            }

            // Get the actual Grove URI for this segment
            const segmentUri = hlsMetadata.segmentUris[filename]
            if (!segmentUri) {
              console.error('[HLSPlayer] No Grove URI for segment:', filename)
              callbacks.onError({ code: 404, text: 'Segment URI not found' }, context)
              return
            }

            const resolvedUrl = lensToGroveUrl(segmentUri)
            console.log(`[HLSPlayer] Loading encrypted segment: ${filename} from ${resolvedUrl}`)

            // Fetch encrypted segment from Grove storage
            fetch(resolvedUrl)
              .then(response => {
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}`)
                }
                return response.arrayBuffer()
              })
              .then(async encryptedData => {
                // Check if component was unmounted during fetch
                if (cancelledRef.current) {
                  throw new Error('Component unmounted, aborting decryption')
                }

                // Check if symmetric key is still available
                if (!symmetricKeyRef.current) {
                  throw new Error('Decryption key not available')
                }

                // Decrypt segment with symmetric key
                const decryptedData = await decryptSegment(
                  encryptedData,
                  symmetricKeyRef.current,
                  segmentMeta.iv,
                  segmentMeta.authTag
                )

                console.log(`[HLSPlayer] ✅ Decrypted segment: ${filename} (${(decryptedData.byteLength / 1024).toFixed(1)} KB)`)

                // Return decrypted data to HLS.js
                callbacks.onSuccess(
                  {
                    url,
                    data: decryptedData,
                  },
                  {
                    trequest: performance.now(),
                    tfirst: performance.now(),
                    tload: performance.now(),
                    loaded: decryptedData.byteLength,
                    total: decryptedData.byteLength,
                  },
                  context
                )
              })
              .catch(error => {
                console.error(`[HLSPlayer] ❌ Failed to load/decrypt segment ${filename}:`, error)
                callbacks.onError(
                  { code: 500, text: error.message },
                  context
                )
              })
          }
        }

        // Initialize HLS.js with custom loader
        const hls = new Hls({
          loader: customLoader,
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        })

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('[HLSPlayer] HLS error:', data)
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('[HLSPlayer] Fatal network error, trying to recover...')
                hls.startLoad()
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('[HLSPlayer] Fatal media error, trying to recover...')
                hls.recoverMediaError()
                break
              default:
                console.error('[HLSPlayer] Fatal error, cannot recover')
                hls.destroy()
                setError('Playback error: ' + data.details)
                onError?.(new Error(data.details))
                break
            }
          }
        })

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('[HLSPlayer] ✅ Manifest parsed, video ready')
          setIsLoading(false)
        })

        // Track play/pause state
        const handlePlay = () => setIsPlaying(true)
        const handlePause = () => setIsPlaying(false)
        const handleWaiting = () => setIsLoading(true)
        const handleCanPlay = () => setIsLoading(false)
        const handleTimeUpdate = () => {
          if (onTimeUpdate) {
            onTimeUpdate(video.currentTime)
          }
        }

        video.addEventListener('play', handlePlay)
        video.addEventListener('pause', handlePause)
        video.addEventListener('waiting', handleWaiting)
        video.addEventListener('canplay', handleCanPlay)
        video.addEventListener('timeupdate', handleTimeUpdate)

        // Load playlist (will be fetched without decryption, segments will be decrypted)
        const resolvedPlaylistUrl = lensToGroveUrl(playlistUrl)
        console.log('[HLSPlayer] Loading playlist:', resolvedPlaylistUrl)
        hls.loadSource(resolvedPlaylistUrl)
        hls.attachMedia(video)

        hlsRef.current = hls

        // Cleanup event listeners
        return () => {
          video.removeEventListener('play', handlePlay)
          video.removeEventListener('pause', handlePause)
          video.removeEventListener('waiting', handleWaiting)
          video.removeEventListener('canplay', handleCanPlay)
          video.removeEventListener('timeupdate', handleTimeUpdate)
        }

      } catch (error: any) {
        console.error('[HLSPlayer] ❌ Initialization failed:', error)
        setError(error.message)
        onError?.(error)
      }
    }

    init()

    // Cleanup
    return () => {
      console.log('[HLSPlayer] Cleanup: Destroying HLS instance')
      cancelledRef.current = true

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      // Reset refs to allow re-initialization on next mount
      symmetricKeyRef.current = null
      isInitializedRef.current = false
    }
  }, [playlistUrl, hlsMetadata, encryption, pkpInfo, authData, onError, onTimeUpdate])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <div className="text-red-500 p-4 text-center">
          <p className="font-semibold">Playback Error</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        poster={thumbnailUrl}
      />

      {/* Thumbnail overlay when loading or paused */}
      {(isLoading || !isPlaying) && thumbnailUrl && (
        <div className="absolute inset-0 bg-black">
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Loading spinner overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
          <Spinner size="lg" className="text-white" />
        </div>
      )}
    </div>
  )
}
