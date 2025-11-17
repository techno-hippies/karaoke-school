/**
 * useDecryptFullAudio
 * Decrypts Lit-encrypted full song audio when user owns Unlock subscription NFT
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Address } from 'viem'

export interface DecryptFullAudioResult {
  isDecrypting: boolean
  decryptedAudioUrl?: string
  error?: string
  hasSubscription: boolean
}

/**
 * Hook to decrypt full audio if user has subscription
 *
 * @param spotifyTrackId - Spotify track ID
 * @param encryptedFullUrl - Grove URL to encrypted full audio
 * @param unlockLockAddress - Unlock Protocol lock contract address
 * @param unlockChainId - Chain ID where lock contract is deployed (84532 = Base Sepolia)
 * @returns Decrypted audio URL or error
 */
export function useDecryptFullAudio(
  spotifyTrackId?: string,
  encryptedFullUrl?: string,
  unlockLockAddress?: string,
  unlockChainId?: number
): DecryptFullAudioResult {
  const { pkpAuthContext, pkpInfo } = useAuth()
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptedAudioUrl, setDecryptedAudioUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const [hasSubscription, setHasSubscription] = useState(false)

  useEffect(() => {
    // Reset state when track changes
    setDecryptedAudioUrl(undefined)
    setError(undefined)
    setHasSubscription(false)

    if (!spotifyTrackId || !encryptedFullUrl || !unlockLockAddress || !unlockChainId || !pkpAuthContext || !pkpInfo) {
      console.log('[useDecryptFullAudio] Missing required parameters:', {
        spotifyTrackId: !!spotifyTrackId,
        encryptedFullUrl: !!encryptedFullUrl,
        unlockLockAddress: !!unlockLockAddress,
        unlockChainId: !!unlockChainId,
        pkpAuthContext: !!pkpAuthContext,
        pkpInfo: !!pkpInfo,
      })
      return
    }

    const checkAndDecrypt = async () => {
      console.log('[useDecryptFullAudio] Checking subscription and decrypting...')
      console.log('[useDecryptFullAudio] Track:', spotifyTrackId)
      console.log('[useDecryptFullAudio] Encrypted URL:', encryptedFullUrl)
      console.log('[useDecryptFullAudio] PKP Address:', pkpInfo.ethAddress)

      setIsDecrypting(true)
      setError(undefined)

      try {
        // 1. Check if user has subscription (owns Unlock NFT)
        const lockAddress = unlockLockAddress as Address

        console.log('[useDecryptFullAudio] Checking Unlock NFT balance...')
        console.log('[useDecryptFullAudio] Lock address:', lockAddress)
        console.log('[useDecryptFullAudio] Chain ID:', unlockChainId)

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

        console.log('[useDecryptFullAudio] NFT Balance:', balance.toString())

        if (balance === 0n) {
          console.log('[useDecryptFullAudio] No subscription - user does not own NFT')
          setHasSubscription(false)
          setIsDecrypting(false)
          return
        }

        console.log('[useDecryptFullAudio] ✅ User has subscription!')
        setHasSubscription(true)

        // 2. Decrypt audio with Lit Protocol
        console.log('[useDecryptFullAudio] Decrypting full audio with Lit Protocol...')

        const { createLitClient } = await import('@lit-protocol/lit-client')
        const { nagaTest } = await import('@lit-protocol/networks')

        const litClient = await createLitClient({
      // @ts-expect-error - Lit Protocol version mismatch between dependencies
          network: nagaTest,
        })

        // Fetch encrypted data from Grove (stored as JSON with { ciphertext, dataToEncryptHash })
        console.log('[useDecryptFullAudio] Fetching encrypted data from:', encryptedFullUrl)
        const encryptedResponse = await fetch(encryptedFullUrl)
        const encryptedData = await encryptedResponse.json()

        console.log('[useDecryptFullAudio] Encrypted data fetched:', {
          hasCiphertext: !!encryptedData.ciphertext,
          hasDataToEncryptHash: !!encryptedData.dataToEncryptHash,
          ciphertextLength: encryptedData.ciphertext?.length,
        })

        // Build access control conditions (reconstructed from unlock parameters)
        const accessControlConditions = [
          {
            conditionType: 'evmBasic' as const,
            contractAddress: lockAddress.toLowerCase(),
            standardContractType: 'ERC721',
            chain: 'baseSepolia' as const,
            method: 'balanceOf',
            parameters: [':userAddress'],
            returnValueTest: {
              comparator: '>',
              value: '0',
            },
          },
        ]

        console.log('[useDecryptFullAudio] Access control conditions:', accessControlConditions)

        // Decrypt with Lit Protocol (pass encrypted data object directly)
        const decryptedData = await litClient.decrypt({
          data: encryptedData,
          unifiedAccessControlConditions: accessControlConditions as any,
          authContext: pkpAuthContext,
          chain: 'baseSepolia',
        })

        console.log('[useDecryptFullAudio] ✅ Audio decrypted successfully')

        // 3. Create blob URL from decrypted data
        const audioBlob = new Blob([decryptedData.decryptedData], { type: 'audio/mpeg' })
        const blobUrl = URL.createObjectURL(audioBlob)

        console.log('[useDecryptFullAudio] ✅ Decrypted audio URL created:', blobUrl)

        setDecryptedAudioUrl(blobUrl)

        // Disconnect Lit client
        await litClient.disconnect()

      } catch (err) {
        console.error('[useDecryptFullAudio] ❌ Error:', err)
        const errorMsg = err instanceof Error ? err.message : 'Failed to decrypt audio'
        setError(errorMsg)
      } finally {
        setIsDecrypting(false)
      }
    }

    checkAndDecrypt()
  }, [spotifyTrackId, encryptedFullUrl, unlockLockAddress, unlockChainId, pkpAuthContext, pkpInfo])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (decryptedAudioUrl) {
        URL.revokeObjectURL(decryptedAudioUrl)
      }
    }
  }, [decryptedAudioUrl])

  return {
    isDecrypting,
    decryptedAudioUrl,
    error,
    hasSubscription,
  }
}
