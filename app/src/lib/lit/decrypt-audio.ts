/**
 * Lit Protocol audio decryption helper
 * Handles hybrid encryption (AES-GCM + Lit access control)
 */

import { decryptAudioWithAesGcm } from '@/lib/crypto/aes-decrypt'
import { getLitClient } from './client'
import { createPKPAuthContext } from './auth-pkp'

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
  accessControl?: {
    type: 'songAccess' | 'unlock'
    contractAddress?: string
    lockAddress?: string
    chainId: number
    chainName: string
  }
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

/**
 * Perform Lit Protocol decryption for hybrid-encrypted audio
 * @param metadata - Encryption metadata from Grove
 * @param pkpInfo - PKP info from auth context
 * @param authData - Auth data from auth context
 * @param setProgress - Progress callback (0-100)
 */
export async function performLitDecryption(
  metadata: HybridEncryptionMetadata,
  pkpInfo: any,
  authData: any,
  setProgress: (progress: number) => void
): Promise<Blob> {
  const litClient = await getLitClient()
  const authContext = await createPKPAuthContext(pkpInfo, authData)

  const chainName = metadata.accessControl?.chainName || metadata.unlock?.chainName || 'baseSepolia'
  const litChain = chainName === 'base-sepolia' ? 'baseSepolia' : chainName

  setProgress(40)

  const decryptedKeyResponse = await litClient.decrypt({
    ciphertext: metadata.lit.encryptedKey,
    dataToEncryptHash: metadata.lit.dataToEncryptHash,
    unifiedAccessControlConditions: metadata.lit.unifiedAccessControlConditions,
    chain: litChain,
    authContext: authContext,
  })

  const symmetricKey = decryptedKeyResponse.decryptedData

  setProgress(60)

  // Fetch encrypted audio
  const audioResponse = await fetch(metadata.encryptedAudio.url)
  if (!audioResponse.ok) {
    throw new Error(`Failed to fetch encrypted audio: ${audioResponse.status}`)
  }

  const encryptedAudio = await audioResponse.arrayBuffer()

  setProgress(80)

  // Decrypt with AES-GCM
  const decryptedAudio = await decryptAudioWithAesGcm(
    encryptedAudio,
    symmetricKey,
    metadata.aes.iv,
    metadata.aes.authTag
  )

  return new Blob([decryptedAudio], { type: 'audio/mpeg' })
}
