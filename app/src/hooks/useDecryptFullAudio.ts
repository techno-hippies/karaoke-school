/**
 * useSubscriptionCheck
 * Checks if user owns Unlock subscription NFT on Base Sepolia
 *
 * NOTE: Lit Protocol decryption disabled due to large file (413) issues.
 * Instead, we verify subscription via NFT balance and use unencrypted fullInstrumental URL.
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
 * Hook to check subscription status via Unlock NFT balance
 *
 * @param spotifyTrackId - Spotify track ID (for logging)
 * @param fullInstrumentalUrl - Grove URL to unencrypted full audio (from metadata.assets.fullInstrumental)
 * @param unlockLockAddress - Unlock Protocol lock contract address
 * @param unlockChainId - Chain ID where lock contract is deployed (84532 = Base Sepolia)
 * @param recheckTrigger - Optional trigger to force re-check (increment after subscription purchase)
 * @returns hasSubscription flag and fullInstrumentalUrl if subscribed
 */
export function useDecryptFullAudio(
  spotifyTrackId?: string,
  fullInstrumentalUrl?: string,
  unlockLockAddress?: string,
  unlockChainId?: number,
  recheckTrigger?: number
): DecryptFullAudioResult {
  const { pkpInfo } = useAuth()
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string>()
  const [hasSubscription, setHasSubscription] = useState(false)

  useEffect(() => {
    // Reset state when track changes
    setError(undefined)
    setHasSubscription(false)

    if (!spotifyTrackId || !unlockLockAddress || !unlockChainId || !pkpInfo) {
      console.log('[useSubscriptionCheck] Missing required parameters:', {
        spotifyTrackId: !!spotifyTrackId,
        unlockLockAddress: !!unlockLockAddress,
        unlockChainId: !!unlockChainId,
        pkpInfo: !!pkpInfo,
      })
      return
    }

    const checkSubscription = async () => {
      console.log('[useSubscriptionCheck] Checking subscription...')
      console.log('[useSubscriptionCheck] Track:', spotifyTrackId)
      console.log('[useSubscriptionCheck] PKP Address:', pkpInfo.ethAddress)

      setIsChecking(true)
      setError(undefined)

      try {
        const lockAddress = unlockLockAddress as Address

        console.log('[useSubscriptionCheck] Checking Unlock NFT balance...')
        console.log('[useSubscriptionCheck] Lock address:', lockAddress)
        console.log('[useSubscriptionCheck] Chain ID:', unlockChainId)

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

        console.log('[useSubscriptionCheck] NFT Balance:', balance.toString())

        if (balance === 0n) {
          console.log('[useSubscriptionCheck] No subscription - user does not own NFT')
          setHasSubscription(false)
        } else {
          console.log('[useSubscriptionCheck] ✅ User has subscription!')
          setHasSubscription(true)
        }

      } catch (err) {
        console.error('[useSubscriptionCheck] ❌ Error:', err)
        const errorMsg = err instanceof Error ? err.message : 'Failed to check subscription'
        setError(errorMsg)
      } finally {
        setIsChecking(false)
      }
    }

    checkSubscription()
  }, [spotifyTrackId, unlockLockAddress, unlockChainId, pkpInfo, recheckTrigger])

  return {
    isDecrypting: isChecking,
    // Return the full instrumental URL if user has subscription
    decryptedAudioUrl: hasSubscription && fullInstrumentalUrl ? fullInstrumentalUrl : undefined,
    error,
    hasSubscription,
  }
}
