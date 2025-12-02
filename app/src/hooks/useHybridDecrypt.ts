/**
 * useHybridDecrypt
 *
 * Decrypts full audio using hybrid encryption (v2):
 * 1. Fetch encryption metadata from Grove (tiny JSON)
 * 2. Check LRU cache - if hit, skip to step 6
 * 3. Decrypt symmetric key with Lit Protocol (32 bytes - no 413 error!)
 * 4. Fetch encrypted audio from Grove
 * 5. Decrypt audio locally with WebCrypto AES-GCM
 * 6. Cache decrypted blob, return object URL for playback
 *
 * Cache key includes dataToEncryptHash for auto-invalidation on re-encryption.
 */

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  buildCacheKey,
  getFromCache,
  saveToCache,
  getInFlightDecrypt,
  setInFlightDecrypt,
} from '@/lib/audioCache'

const IS_DEV = import.meta.env.DEV

export interface HybridEncryptionMetadata {
  version: string // '2.0.0' or '2.1.0'
  method: string
  aes: {
    algorithm: string
    keyBits: number
    iv: string
    authTag: string
  }
  lit: {
    network: string
    encryptedKey: string
    dataToEncryptHash: string
    unifiedAccessControlConditions: any[]
  }
  // v2.1.0: New accessControl field (SongAccess or Unlock)
  accessControl?: {
    type: 'songAccess' | 'unlock'
    contractAddress?: string // For songAccess
    lockAddress?: string // For unlock
    chainId: number
    chainName: string
  }
  // v2.0.0: Legacy unlock field (backwards compat)
  unlock?: {
    lockAddress: string
    chainId: number
    chainName: string
  }
  encryptedAudio: {
    url: string
    sizeBytes: number
  }
}

export interface HybridDecryptResult {
  isLoading: boolean
  isDecrypting: boolean
  decryptedAudioUrl?: string
  error?: string
  progress?: number
}

/**
 * Convert base64 string to Uint8Array
 */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Decrypt audio using AES-GCM with the decrypted symmetric key
 */
async function decryptAudioWithAesGcm(
  encryptedAudio: ArrayBuffer,
  symmetricKey: Uint8Array,
  iv: string,
  authTag: string
): Promise<ArrayBuffer> {
  // Import symmetric key for WebCrypto
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    symmetricKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // Decode IV and auth tag from base64
  const ivBytes = fromBase64(iv)
  const authTagBytes = fromBase64(authTag)

  // For AES-GCM, auth tag is appended to ciphertext
  const ciphertextWithTag = new Uint8Array(
    encryptedAudio.byteLength + authTagBytes.byteLength
  )
  ciphertextWithTag.set(new Uint8Array(encryptedAudio), 0)
  ciphertextWithTag.set(authTagBytes, encryptedAudio.byteLength)

  // Decrypt using WebCrypto
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    cryptoKey,
    ciphertextWithTag
  )

  return decryptedBuffer
}

/**
 * Hook to decrypt full audio using hybrid encryption
 *
 * @param encryptionMetadataUrl - Grove URL to encryption metadata JSON
 * @param spotifyTrackId - Spotify track ID (for logging)
 * @param recheckTrigger - Optional trigger to force re-check (increment after subscription purchase)
 */
export function useHybridDecrypt(
  encryptionMetadataUrl?: string,
  spotifyTrackId?: string,
  recheckTrigger?: number
): HybridDecryptResult {
  const { pkpInfo, authData } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [error, setError] = useState<string>()
  const [decryptedAudioUrl, setDecryptedAudioUrl] = useState<string>()
  const [progress, setProgress] = useState<number>()

  // Track previous URL for cleanup on swap
  const prevUrlRef = useRef<string | undefined>(undefined)

  // Cleanup object URL on change or unmount
  useEffect(() => {
    // Revoke previous URL when a new one is set
    if (prevUrlRef.current && prevUrlRef.current !== decryptedAudioUrl) {
      URL.revokeObjectURL(prevUrlRef.current)
    }
    prevUrlRef.current = decryptedAudioUrl

    return () => {
      if (decryptedAudioUrl) {
        URL.revokeObjectURL(decryptedAudioUrl)
      }
    }
  }, [decryptedAudioUrl])

  useEffect(() => {
    // Reset state when track changes
    setError(undefined)
    setDecryptedAudioUrl(undefined)
    setProgress(undefined)

    if (!encryptionMetadataUrl || !spotifyTrackId || !pkpInfo || !authData) {
      return
    }

    const decryptFullAudio = async () => {
      if (IS_DEV) console.log('[useHybridDecrypt] Starting decryption for:', spotifyTrackId)

      setError(undefined)

      try {
        // Step 1: Fetch encryption metadata (needed for cache key) - silent, no loading indicator
        const metadataResponse = await fetch(encryptionMetadataUrl)
        if (!metadataResponse.ok) {
          throw new Error(`Failed to fetch encryption metadata: ${metadataResponse.status}`)
        }

        const metadata: HybridEncryptionMetadata = await metadataResponse.json()

        // Verify this is v2 hybrid encryption (2.0.0 or 2.1.0)
        if (!['2.0.0', '2.1.0'].includes(metadata.version) || metadata.method !== 'hybrid-aes-gcm-lit') {
          throw new Error(`Unsupported encryption version: ${metadata.version} / ${metadata.method}`)
        }

        // Step 2: Check cache BEFORE showing any loading state
        const cacheKey = buildCacheKey(spotifyTrackId, metadata.lit.dataToEncryptHash)

        // Check for in-flight decrypt (prevents duplicate work on re-renders)
        const inFlight = getInFlightDecrypt(cacheKey)
        if (inFlight) {
          const cachedBlob = await inFlight
          const objectUrl = URL.createObjectURL(cachedBlob)
          setDecryptedAudioUrl(objectUrl)
          return
        }

        // Check cache - if hit, no loading indicator needed
        const cachedBlob = await getFromCache(cacheKey)
        if (cachedBlob) {
          if (IS_DEV) console.log('[useHybridDecrypt] Cache hit')
          const objectUrl = URL.createObjectURL(cachedBlob)
          setDecryptedAudioUrl(objectUrl)
          return
        }

        // Cache miss - NOW show loading indicator
        setIsLoading(true)
        setProgress(40)

        // Step 3: Decrypt symmetric key with Lit Protocol (tiny - 32 bytes!)
        if (IS_DEV) console.log('[useHybridDecrypt] Decrypting with Lit...')
        setIsDecrypting(true)

        // Create decrypt promise and register as in-flight
        const decryptPromise = performLitDecryption(metadata, pkpInfo, authData)
        setInFlightDecrypt(cacheKey, decryptPromise)

        const decryptedBlob = await decryptPromise

        // Save to cache (async, don't await)
        saveToCache(cacheKey, decryptedBlob).catch(() => {
          // Cache save failed - non-critical
        })

        // Create object URL for playback
        const objectUrl = URL.createObjectURL(decryptedBlob)
        setDecryptedAudioUrl(objectUrl)
        setProgress(100)

        if (IS_DEV) console.log('[useHybridDecrypt] Decryption complete')
        return

      } catch (err) {
        console.error('[useHybridDecrypt] Error:', err)
        const errorMsg = err instanceof Error ? err.message : 'Failed to decrypt audio'
        setError(errorMsg)
      } finally {
        setIsLoading(false)
        setIsDecrypting(false)
      }
    }

    /**
     * Perform the actual Lit decryption + AES decrypt (extracted for in-flight tracking)
     */
    async function performLitDecryption(
      metadata: HybridEncryptionMetadata,
      pkpInfoParam: NonNullable<typeof pkpInfo>,
      authDataParam: NonNullable<typeof authData>
    ): Promise<Blob> {
      const { getLitClient } = await import('@/lib/lit/client')
      const { createPKPAuthContext } = await import('@/lib/lit/auth-pkp')

      const litClient = await getLitClient()

      // NOTE: If you see "Resource id not found" errors, user needs to log out and back in
      const authContext = await createPKPAuthContext(pkpInfoParam, authDataParam)

      // Resolve chain name from accessControl (v2.1.0) or unlock (v2.0.0)
      const chainName = metadata.accessControl?.chainName || metadata.unlock?.chainName || 'baseSepolia'
      const litChain = chainName === 'base-sepolia' ? 'baseSepolia' : chainName

      const decryptedKeyResponse = await litClient.decrypt({
        ciphertext: metadata.lit.encryptedKey,
        dataToEncryptHash: metadata.lit.dataToEncryptHash,
        unifiedAccessControlConditions: metadata.lit.unifiedAccessControlConditions,
        chain: litChain,
        authContext: authContext,
      })

      const symmetricKey = decryptedKeyResponse.decryptedData

      // Fetch encrypted audio from Grove
      setProgress(60)
      const audioResponse = await fetch(metadata.encryptedAudio.url)
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch encrypted audio: ${audioResponse.status}`)
      }

      const encryptedAudio = await audioResponse.arrayBuffer()

      // Decrypt audio locally with WebCrypto
      setProgress(80)
      const decryptedAudio = await decryptAudioWithAesGcm(
        encryptedAudio,
        symmetricKey,
        metadata.aes.iv,
        metadata.aes.authTag
      )

      return new Blob([decryptedAudio], { type: 'audio/mpeg' })
    }

    decryptFullAudio()
  }, [encryptionMetadataUrl, spotifyTrackId, pkpInfo, authData, recheckTrigger])

  return {
    isLoading,
    isDecrypting,
    decryptedAudioUrl,
    error,
    progress,
  }
}
