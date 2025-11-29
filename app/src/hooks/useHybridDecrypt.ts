/**
 * useHybridDecrypt
 *
 * Decrypts full audio using hybrid encryption (v2):
 * 1. Check subscription via Unlock NFT balance
 * 2. Fetch encryption metadata from Grove (tiny JSON)
 * 3. Decrypt symmetric key with Lit Protocol (32 bytes - no 413 error!)
 * 4. Fetch encrypted audio from Grove
 * 5. Decrypt audio locally with WebCrypto AES-GCM
 * 6. Return object URL for playback
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Address } from 'viem'

export interface HybridEncryptionMetadata {
  version: string
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
  unlock: {
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
  hasSubscription: boolean
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
  const [hasSubscription, setHasSubscription] = useState(false)
  const [decryptedAudioUrl, setDecryptedAudioUrl] = useState<string>()
  const [progress, setProgress] = useState<number>()

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (decryptedAudioUrl) {
        URL.revokeObjectURL(decryptedAudioUrl)
      }
    }
  }, [decryptedAudioUrl])

  useEffect(() => {
    // Reset state when track changes
    setError(undefined)
    setHasSubscription(false)
    setDecryptedAudioUrl(undefined)
    setProgress(undefined)

    if (!encryptionMetadataUrl || !spotifyTrackId || !pkpInfo || !authData) {
      console.log('[useHybridDecrypt] Missing required parameters:', {
        encryptionMetadataUrl: !!encryptionMetadataUrl,
        spotifyTrackId: !!spotifyTrackId,
        pkpInfo: !!pkpInfo,
        authData: !!authData,
      })
      return
    }

    const decryptFullAudio = async () => {
      console.log('[useHybridDecrypt] Starting hybrid decryption...')
      console.log('[useHybridDecrypt] Track:', spotifyTrackId)
      console.log('[useHybridDecrypt] PKP Address:', pkpInfo.ethAddress)

      setIsLoading(true)
      setError(undefined)

      try {
        // Step 1: Fetch encryption metadata
        console.log('[useHybridDecrypt] Step 1: Fetching encryption metadata...')
        setProgress(10)

        const metadataResponse = await fetch(encryptionMetadataUrl)
        if (!metadataResponse.ok) {
          throw new Error(`Failed to fetch encryption metadata: ${metadataResponse.status}`)
        }

        const metadata: HybridEncryptionMetadata = await metadataResponse.json()

        // Verify this is v2 hybrid encryption
        if (metadata.version !== '2.0.0' || metadata.method !== 'hybrid-aes-gcm-lit') {
          throw new Error(`Unsupported encryption version: ${metadata.version} / ${metadata.method}`)
        }

        console.log('[useHybridDecrypt] Encryption metadata loaded')

        // Step 2: Check subscription
        console.log('[useHybridDecrypt] Step 2: Checking subscription...')
        setProgress(20)

        const lockAddress = metadata.unlock.lockAddress as Address

        const { createPublicClient, http } = await import('viem')
        const { baseSepolia } = await import('viem/chains')

        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        })

        const balance = await publicClient.readContract({
          authorizationList: undefined as any,
          address: lockAddress,
          abi: [
            {
              inputs: [{ name: '_owner', type: 'address' }],
              name: 'balanceOf',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ] as const,
          functionName: 'balanceOf',
          args: [pkpInfo.ethAddress as Address],
        })

        console.log('[useHybridDecrypt] NFT Balance:', balance.toString())

        if (balance === 0n) {
          console.log('[useHybridDecrypt] No subscription - user does not own NFT')
          setHasSubscription(false)
          setIsLoading(false)
          return
        }

        console.log('[useHybridDecrypt] ✅ User has subscription!')
        setHasSubscription(true)

        // Step 3: Decrypt symmetric key with Lit Protocol (tiny - 32 bytes!)
        console.log('[useHybridDecrypt] Step 3: Decrypting symmetric key with Lit...')
        setIsDecrypting(true)
        setProgress(40)

        const { getLitClient } = await import('@/lib/lit/client')
        const { createPKPAuthContext } = await import('@/lib/lit/auth-pkp')

        // Use the singleton Lit client (same as used for auth)
        console.log('[useHybridDecrypt] Getting singleton Lit client...')
        const litClient = await getLitClient()

        // Use the cached auth context (now includes decryption resources after login update)
        // NOTE: If you see "Resource id not found" errors, you need to LOG OUT and LOG BACK IN
        // to get a new session with decryption capabilities
        console.log('[useHybridDecrypt] Getting PKP auth context...')
        const authContext = await createPKPAuthContext(pkpInfo, authData)

        console.log('[useHybridDecrypt] Decrypting symmetric key...')
        const decryptedKeyResponse = await litClient.decrypt({
          ciphertext: metadata.lit.encryptedKey,
          dataToEncryptHash: metadata.lit.dataToEncryptHash,
          unifiedAccessControlConditions: metadata.lit.unifiedAccessControlConditions,
          chain: metadata.unlock.chainName === 'base-sepolia' ? 'baseSepolia' : metadata.unlock.chainName,
          authContext: authContext,
        })

        const symmetricKey = decryptedKeyResponse.decryptedData
        console.log('[useHybridDecrypt] ✅ Symmetric key decrypted!')

        // Don't disconnect the singleton client - it's shared across the app

        // Step 4: Fetch encrypted audio from Grove
        console.log('[useHybridDecrypt] Step 4: Fetching encrypted audio...')
        setProgress(60)

        const audioResponse = await fetch(metadata.encryptedAudio.url)
        if (!audioResponse.ok) {
          throw new Error(`Failed to fetch encrypted audio: ${audioResponse.status}`)
        }

        const encryptedAudio = await audioResponse.arrayBuffer()
        console.log(`[useHybridDecrypt] Downloaded ${(encryptedAudio.byteLength / 1024 / 1024).toFixed(2)} MB encrypted audio`)

        // Step 5: Decrypt audio locally with WebCrypto
        console.log('[useHybridDecrypt] Step 5: Decrypting audio with WebCrypto...')
        setProgress(80)

        const decryptedAudio = await decryptAudioWithAesGcm(
          encryptedAudio,
          symmetricKey,
          metadata.aes.iv,
          metadata.aes.authTag
        )

        console.log(`[useHybridDecrypt] ✅ Decrypted ${(decryptedAudio.byteLength / 1024 / 1024).toFixed(2)} MB audio`)

        // Create object URL for playback
        const blob = new Blob([decryptedAudio], { type: 'audio/mpeg' })
        const objectUrl = URL.createObjectURL(blob)

        setDecryptedAudioUrl(objectUrl)
        setProgress(100)

        console.log('[useHybridDecrypt] ✅ Decryption complete!')

      } catch (err) {
        console.error('[useHybridDecrypt] ❌ Error:', err)
        const errorMsg = err instanceof Error ? err.message : 'Failed to decrypt audio'
        setError(errorMsg)
      } finally {
        setIsLoading(false)
        setIsDecrypting(false)
      }
    }

    decryptFullAudio()
  }, [encryptionMetadataUrl, spotifyTrackId, pkpInfo, authData, recheckTrigger])

  return {
    isLoading,
    isDecrypting,
    decryptedAudioUrl,
    error,
    hasSubscription,
    progress,
  }
}
