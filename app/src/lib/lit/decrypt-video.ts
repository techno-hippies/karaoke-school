/**
 * HLS Video Decryption with Lit Protocol
 *
 * Hybrid decryption flow for HLS streaming:
 * 1. Videos are segmented into HLS chunks (4-second segments)
 * 2. Each segment is encrypted with AES-256-GCM using one shared symmetric key
 * 3. Each segment has a unique IV and authTag
 * 4. The symmetric key is encrypted with Lit Protocol (using Unlock access control)
 * 5. To decrypt and play:
 *    a) Decrypt symmetric key ONCE via Lit Protocol (if user has Unlock NFT)
 *    b) Decrypt each HLS segment on-the-fly using the symmetric key + segment IV
 *    c) HLS.js handles progressive loading and playback
 */

import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import type { PKPInfo, AuthData } from '@/lib/lit-webauthn/types'
import { createPKPDecryptionAuthContext } from '@/lib/lit-webauthn/auth-pkp'

export interface EncryptionMetadata {
  encryptedSymmetricKey: string // Base64 Lit-encrypted symmetric key
  dataToEncryptHash: string // Hash for Lit decrypt verification
  // HLS segment encryption (per-segment IV and authTag)
  segments: Array<{
    filename: string
    iv: string // AES-GCM IV (base64)
    authTag: string // AES-GCM auth tag (base64)
  }>
  unifiedAccessControlConditions: any[]
}

export interface HLSMetadata {
  segmented: true
  segmentDuration: number
  segmentCount: number
  playlistUri: string
  segmentUris: { [filename: string]: string }
}

/**
 * Decrypt the symmetric key using Lit Protocol (ONCE per video)
 * This key is then reused to decrypt all HLS segments
 */
export async function decryptSymmetricKey(
  encryption: EncryptionMetadata,
  pkpInfo: PKPInfo,
  authData: AuthData
): Promise<Uint8Array> {
  console.log('[DecryptSymmetricKey] Decrypting symmetric key with Lit Protocol...')

  try {
    // 1. Initialize Lit client
    const litClient = await createLitClient({
      network: nagaDev,
    })

    // 2. Create PKP auth context (no resource ID needed for decryption)
    const pkpAuthContext = await createPKPDecryptionAuthContext(
      pkpInfo,
      authData
    )

    // 3. Decrypt symmetric key with Lit Protocol
    const decryptedKeyResponse = await litClient.decrypt({
      ciphertext: encryption.encryptedSymmetricKey,
      dataToEncryptHash: encryption.dataToEncryptHash,
      unifiedAccessControlConditions: encryption.unifiedAccessControlConditions as any,
      chain: 'baseSepolia',
      authContext: pkpAuthContext,
    })

    console.log('[DecryptSymmetricKey] ✅ Symmetric key decrypted')

    // 4. Disconnect Lit client
    await litClient.disconnect()

    return decryptedKeyResponse.decryptedData
  } catch (error: any) {
    console.error('[DecryptSymmetricKey] ❌ Decryption failed:', error)
    throw new Error(`Symmetric key decryption failed: ${error.message}`)
  }
}

/**
 * Decrypt a single HLS segment using the symmetric key
 * @param encryptedSegment - Encrypted segment data
 * @param symmetricKey - Decrypted symmetric key (from Lit Protocol)
 * @param iv - Segment-specific IV (base64)
 * @param authTag - Segment-specific auth tag (base64)
 */
export async function decryptSegment(
  encryptedSegment: ArrayBuffer,
  symmetricKey: Uint8Array,
  iv: string,
  authTag: string
): Promise<ArrayBuffer> {
  // Import symmetric key for Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    symmetricKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // Decode IV and auth tag from base64
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
  const authTagBytes = Uint8Array.from(atob(authTag), c => c.charCodeAt(0))

  // For AES-GCM, auth tag is appended to ciphertext
  const ciphertextWithTag = new Uint8Array(
    encryptedSegment.byteLength + authTagBytes.byteLength
  )
  ciphertextWithTag.set(new Uint8Array(encryptedSegment), 0)
  ciphertextWithTag.set(authTagBytes, encryptedSegment.byteLength)

  // Decrypt using Web Crypto API
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
