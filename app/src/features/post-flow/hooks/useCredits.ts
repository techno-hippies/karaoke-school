/**
 * Credits Hook
 * Handles credit purchases (USDC) and segment unlocking
 * Uses Smart Account for Universal Balance (cross-chain USDC)
 */

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Song, SongSegment } from '../types'
import { CREDIT_PACKAGES } from '../types'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'

export function useCredits() {
  const { pkpWalletClient, pkpAddress } = useAuth()
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Check USDC balance
   */
  const checkUSDCBalance = async (): Promise<bigint> => {
    if (!pkpWalletClient || !pkpAddress) return BigInt(0)

    try {
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia } = await import('viem/chains')

      const usdcContract = BASE_SEPOLIA_CONTRACTS.usdc
      const address = pkpAddress

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      const balance = await publicClient.readContract({
        address: usdcContract,
        abi: [{
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'balanceOf',
        args: [address],
      })

      return balance as bigint
    } catch (err) {
      console.error('[Credits] Balance check failed:', err)
      return BigInt(0)
    }
  }

  /**
   * Purchase credits using USDC
   * Uses PKP wallet client directly (no Smart Account)
   */
  const purchaseCredits = async (packageId: number): Promise<boolean> => {
    if (!pkpWalletClient) {
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
      const creditsContract = BASE_SEPOLIA_CONTRACTS.karaokeCredits
      const usdcContract = BASE_SEPOLIA_CONTRACTS.usdc
      const amount = BigInt(pkg.priceUSDC)

      console.log('[Credits] Purchasing package:', packageId, 'for', pkg.priceDisplay, 'USDC')
      console.log('[Credits] Using PKP wallet')

      // Step 1: Approve USDC
      console.log('[Credits] Step 1/2: Approving USDC...')
      const approveHash = await pkpWalletClient.writeContract({
        address: usdcContract,
        abi: [{
          name: 'approve',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool' }],
        }],
        functionName: 'approve',
        args: [creditsContract, amount],
      })
      console.log('[Credits] Approval transaction:', approveHash)

      // Wait for approval to confirm
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Step 2: Purchase credits
      console.log('[Credits] Step 2/2: Purchasing credits...')
      const purchaseHash = await pkpWalletClient.writeContract({
        address: creditsContract,
        abi: [{
          name: 'purchaseCreditsUSDC',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'packageId', type: 'uint8' }],
          outputs: [],
        }],
        functionName: 'purchaseCreditsUSDC',
        args: [packageId],
      })

      console.log('[Credits] Purchase transaction:', purchaseHash)
      return true
    } catch (err) {
      console.error('[Credits] Purchase failed:', err)
      const errorMsg = err instanceof Error ? err.message : 'Purchase failed'

      // Check if error is due to insufficient USDC
      if (errorMsg.toLowerCase().includes('usdc') || errorMsg.toLowerCase().includes('insufficient')) {
        setError('INSUFFICIENT_USDC')
      } else {
        setError(errorMsg)
      }
      return false
    } finally {
      setIsPurchasing(false)
    }
  }

  /**
   * Unlock segment (spend 1 credit)
   */
  const unlockSegment = async (song: Song, segment: SongSegment): Promise<boolean> => {
    if (!pkpWalletClient) {
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

      const hash = await pkpWalletClient.writeContract({
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
    if (!pkpWalletClient || !pkpAddress) return false

    try {
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia } = await import('viem/chains')

      const contractAddress = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`
      const address = pkpAddress
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
    checkUSDCBalance,
  }
}
