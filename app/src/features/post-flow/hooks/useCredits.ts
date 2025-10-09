/**
 * Credits Hook
 * Handles credit purchases and segment unlocking
 */

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Song, SongSegment } from '../types'
import { CREDIT_PACKAGES } from '../types'

export function useCredits() {
  const { walletClient } = useAuth()
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Purchase credits from smart contract
   */
  const purchaseCredits = async (packageId: number): Promise<boolean> => {
    if (!walletClient) {
      setError('Wallet not connected')
      return false
    }

    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
    if (!pkg) {
      setError('Invalid package')
      return false
    }

    setIsPurchasing(true)
    setError(null)

    try {
      const contractAddress = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`
      const value = BigInt(parseFloat(pkg.price) * 1e18) // Convert ETH to wei

      console.log('[Credits] Purchasing package:', packageId, 'for', pkg.price, 'ETH')

      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: [{
          name: 'purchaseCreditsETH',
          type: 'function',
          stateMutability: 'payable',
          inputs: [{ name: 'packageId', type: 'uint8' }],
          outputs: [],
        }],
        functionName: 'purchaseCreditsETH',
        args: [packageId],
        value,
      })

      console.log('[Credits] Purchase transaction:', hash)
      return true
    } catch (err) {
      console.error('[Credits] Purchase failed:', err)
      setError(err instanceof Error ? err.message : 'Purchase failed')
      return false
    } finally {
      setIsPurchasing(false)
    }
  }

  /**
   * Unlock segment (spend 1 credit)
   */
  const unlockSegment = async (song: Song, segment: SongSegment): Promise<boolean> => {
    if (!walletClient) {
      setError('Wallet not connected')
      return false
    }

    setIsUnlocking(true)
    setError(null)

    try {
      const contractAddress = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`

      console.log('[Credits] Unlocking segment:', segment.id, 'for song:', song.id)

      // Create segment identifier (song ID + segment ID)
      const segmentIdentifier = `${song.geniusId}-${segment.id}`

      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: [{
          name: 'unlockSegment',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'segmentId', type: 'string' }],
          outputs: [],
        }],
        functionName: 'unlockSegment',
        args: [segmentIdentifier],
      })

      console.log('[Credits] Unlock transaction:', hash)
      return true
    } catch (err) {
      console.error('[Credits] Unlock failed:', err)
      setError(err instanceof Error ? err.message : 'Unlock failed')
      return false
    } finally {
      setIsUnlocking(false)
    }
  }

  /**
   * Check if segment is owned (unlocked)
   */
  const checkSegmentOwnership = async (song: Song, segment: SongSegment): Promise<boolean> => {
    if (!walletClient) return false

    try {
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia } = await import('viem/chains')

      const contractAddress = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`
      const [address] = await walletClient.getAddresses()
      const segmentIdentifier = `${song.geniusId}-${segment.id}`

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      const isOwned = await publicClient.readContract({
        address: contractAddress,
        abi: [{
          name: 'hasSegmentAccess',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'user', type: 'address' },
            { name: 'segmentId', type: 'string' }
          ],
          outputs: [{ name: '', type: 'bool' }],
        }],
        functionName: 'hasSegmentAccess',
        args: [address, segmentIdentifier],
      })

      return Boolean(isOwned)
    } catch (err) {
      console.error('[Credits] Ownership check failed:', err)
      return false
    }
  }

  return {
    isPurchasing,
    isUnlocking,
    error,
    purchaseCredits,
    unlockSegment,
    checkSegmentOwnership,
  }
}
