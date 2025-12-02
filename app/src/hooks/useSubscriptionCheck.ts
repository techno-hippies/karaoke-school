/**
 * useSubscriptionCheck
 *
 * Check if user has purchased/subscribed to content.
 * Priority:
 * 1. SongAccess contract (new: per-song USDC purchase)
 * 2. Unlock Protocol song lock (legacy per-track)
 * 3. Unlock Protocol artist lock (subscription)
 */

import { useState, useEffect } from 'react'
import { createPublicClient, http, type Address } from 'viem'
import { baseSepolia, base } from 'viem/chains'
import { useAuth } from '@/contexts/AuthContext'
import { ARTIST_SUBSCRIPTION_LOCKS, SONG_PURCHASE_LOCKS, SONG_ACCESS_CONTRACT } from '@/lib/contracts/addresses'

const IS_DEV = import.meta.env.DEV

const SONG_ACCESS_ABI = [
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'spotifyTrackId', type: 'string' },
    ],
    name: 'ownsSongByTrackId',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

interface UseSubscriptionCheckResult {
  hasSubscription: boolean
  isLoading: boolean
  error?: string
}

interface UseSubscriptionCheckParams {
  /** Spotify track ID for song-level lock lookup */
  spotifyTrackId?: string
  /** Artist slug for artist-level lock lookup (fallback) */
  artistSlug?: string
  /** Direct lock address (highest priority, e.g., from clip metadata) */
  lockAddress?: Address
  /** Chain ID for direct lock address (default: 84532 Base Sepolia) */
  lockChainId?: number
  /** Increment to force re-check after purchase */
  recheckTrigger?: number
}

/**
 * Check if user has subscription/purchase for a song or artist
 *
 * Priority: lockAddress > spotifyTrackId (song) > artistSlug (artist)
 */
export function useSubscriptionCheck(
  params?: UseSubscriptionCheckParams
): UseSubscriptionCheckResult {
  const { pkpInfo } = useAuth()
  const [hasSubscription, setHasSubscription] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()

  const spotifyTrackId = params?.spotifyTrackId
  const artistSlug = params?.artistSlug
  const directLockAddress = params?.lockAddress
  const directLockChainId = params?.lockChainId
  const recheckTrigger = params?.recheckTrigger

  useEffect(() => {
    // Reset state
    setHasSubscription(false)
    setError(undefined)

    if (!pkpInfo?.ethAddress) {
      return
    }

    // Resolve lock config with priority: direct > song > artist
    let lockAddress: Address | undefined
    let chainId = 84532 // Default to Base Sepolia

    if (directLockAddress) {
      lockAddress = directLockAddress
      chainId = directLockChainId ?? 84532
    } else if (spotifyTrackId && SONG_PURCHASE_LOCKS[spotifyTrackId]) {
      const songLock = SONG_PURCHASE_LOCKS[spotifyTrackId]
      lockAddress = songLock.lockAddress
      chainId = songLock.chainId
    } else if (artistSlug && ARTIST_SUBSCRIPTION_LOCKS[artistSlug.toLowerCase()]) {
      const artistLock = ARTIST_SUBSCRIPTION_LOCKS[artistSlug.toLowerCase()]
      lockAddress = artistLock.lockAddress
      chainId = artistLock.chainId
    }

    // Don't early return - we need to check SongAccess even without Unlock lock
    if (!lockAddress && !spotifyTrackId) {
      return
    }

    const checkSubscription = async () => {
      setIsLoading(true)

      try {
        // Step 1: Check SongAccess contract first (new per-song USDC model)
        if (spotifyTrackId && SONG_ACCESS_CONTRACT.testnet.address !== '0x0000000000000000000000000000000000000000') {
          const songAccessClient = createPublicClient({
            chain: baseSepolia,
            transport: http(),
          })

          try {
            const ownsSong = await songAccessClient.readContract({
              address: SONG_ACCESS_CONTRACT.testnet.address,
              abi: SONG_ACCESS_ABI,
              functionName: 'ownsSongByTrackId',
              args: [pkpInfo.ethAddress as Address, spotifyTrackId],
            } as any)

            if (ownsSong) {
              if (IS_DEV) console.log('[useSubscriptionCheck] User owns song via SongAccess')
              setHasSubscription(true)
              setIsLoading(false)
              return
            }
          } catch (err) {
            // SongAccess contract call failed - continue to Unlock Protocol fallback
            if (IS_DEV) console.log('[useSubscriptionCheck] SongAccess check failed:', err)
          }
        }

        // Step 2: Fall back to Unlock Protocol (legacy locks)
        if (!lockAddress) {
          setIsLoading(false)
          return
        }

        const chain = chainId === 8453 ? base : baseSepolia
        const publicClient = createPublicClient({
          chain,
          transport: http(),
        })

        const balance = await publicClient.readContract({
          address: lockAddress!,
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
        } as any)

        const hasKey = (balance as bigint) > 0n
        if (IS_DEV && hasKey) console.log('[useSubscriptionCheck] User has Unlock key')
        setHasSubscription(hasKey)
      } catch (err) {
        console.error('[useSubscriptionCheck] Error:', err)
        setError(err instanceof Error ? err.message : 'Failed to check subscription')
      } finally {
        setIsLoading(false)
      }
    }

    checkSubscription()
  }, [spotifyTrackId, artistSlug, directLockAddress, directLockChainId, pkpInfo?.ethAddress, recheckTrigger])

  return { hasSubscription, isLoading, error }
}
