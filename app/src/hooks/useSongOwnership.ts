/**
 * useSongOwnership
 * Hook to check if user owns a song via SongAccess contract
 * Used for access control checks (Lit Protocol decryption, UI gating)
 */

import { useState, useEffect, useCallback } from 'react'
import { type Address, type PublicClient } from 'viem'
import { baseSepolia } from 'viem/chains'
import { usePublicClient } from 'wagmi'
import { SONG_ACCESS_CONTRACT } from '@/lib/contracts/addresses'

const CONTRACT = SONG_ACCESS_CONTRACT.testnet

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

interface UseSongOwnershipOptions {
  publicClient?: PublicClient
  enabled?: boolean
}

export interface UseSongOwnershipResult {
  isOwned: boolean
  isLoading: boolean
  error: string | null
  refetch: () => Promise<boolean>
}

export function useSongOwnership(
  spotifyTrackId?: string,
  userAddress?: Address,
  options?: UseSongOwnershipOptions
): UseSongOwnershipResult {
  const [isOwned, setIsOwned] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wagmiPublicClient = usePublicClient({ chainId: CONTRACT.chainId })
  const publicClient = options?.publicClient ?? wagmiPublicClient
  const enabled = options?.enabled !== false

  const checkOwnership = useCallback(async (): Promise<boolean> => {
    if (!publicClient || !userAddress || !spotifyTrackId) {
      setIsOwned(false)
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      // @ts-expect-error - viem version mismatch
      const owned = await publicClient.readContract({
        address: CONTRACT.address,
        abi: SONG_ACCESS_ABI,
        functionName: 'ownsSongByTrackId',
        args: [userAddress, spotifyTrackId],
      })

      const result = owned as boolean
      setIsOwned(result)
      setIsLoading(false)
      return result
    } catch (err) {
      console.error('[useSongOwnership] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to check ownership')
      setIsOwned(false)
      setIsLoading(false)
      return false
    }
  }, [publicClient, userAddress, spotifyTrackId])

  // Auto-check on mount and when deps change
  useEffect(() => {
    if (enabled && spotifyTrackId && userAddress) {
      checkOwnership()
    }
  }, [enabled, spotifyTrackId, userAddress, checkOwnership])

  return {
    isOwned,
    isLoading,
    error,
    refetch: checkOwnership,
  }
}

/**
 * Utility function to check ownership without React hook
 * For use in Lit Protocol access control
 */
export async function checkSongOwnership(
  spotifyTrackId: string,
  userAddress: Address,
  publicClient: PublicClient
): Promise<boolean> {
  try {
    // @ts-expect-error - viem version mismatch
    const owned = await publicClient.readContract({
      address: CONTRACT.address,
      abi: SONG_ACCESS_ABI,
      functionName: 'ownsSongByTrackId',
      args: [userAddress, spotifyTrackId],
    })
    return owned as boolean
  } catch (error) {
    console.error('[checkSongOwnership] Error:', error)
    return false
  }
}
