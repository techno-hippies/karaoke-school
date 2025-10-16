/**
 * Credit Spending Module
 * Handles deducting credits for song unlocks
 */

import { executeTransactionWithPKP } from '@/lib/lit/pkp-transaction'
import type { PKPAuthContext, PKPInfo } from '@/lib/lit-webauthn/types'
import type { Hash } from 'viem'
import { encodeFunctionData } from 'viem'
import { getCreditBalance } from './queries'
import { InsufficientCreditsError } from '@/hooks/useUnlockSong'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'

const KARAOKE_CREDITS_CONTRACT = BASE_SEPOLIA_CONTRACTS.karaokeCredits

export interface SpendResult {
  txHash: Hash
  creditsSpent: number
  remainingBalance: number
}

/**
 * Unlock entire song via contract (IDEMPOTENT)
 * Contract tracks ownership via ownedSongs mapping and prevents double-charging
 *
 * @throws Error if:
 * - User has insufficient credits
 * - Song already owned (idempotent protection)
 * - Transaction fails
 */
export async function unlockSongWithCredits(
  geniusId: number,
  segmentCount: number,
  pkpAuthContext: PKPAuthContext,
  pkpInfo: PKPInfo
): Promise<SpendResult> {

  console.log('[UnlockSong] Unlocking song via contract:', {
    geniusId,
    segmentCount,
    pkpAddress: pkpInfo.ethAddress
  })

  // Encode contract call: unlockSong(uint32 geniusId, uint8 segmentCount)
  const unlockData = encodeFunctionData({
    abi: [{
      name: 'unlockSong',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'geniusId', type: 'uint32' },
        { name: 'segmentCount', type: 'uint8' },
      ],
      outputs: [],
    }],
    functionName: 'unlockSong',
    args: [geniusId, segmentCount],
  })

  console.log('[UnlockSong] Executing PKP transaction...')
  const txHash = await executeTransactionWithPKP({
    to: KARAOKE_CREDITS_CONTRACT,
    data: unlockData,
    pkpAuthContext,
    pkpInfo,
  })

  console.log('[UnlockSong] ✅ Song unlocked! TX:', txHash)

  // Fetch new balance
  const remainingBalance = await getCreditBalance(pkpInfo.ethAddress)

  return {
    txHash,
    creditsSpent: segmentCount,
    remainingBalance,
  }
}

/**
 * Simpler wrapper for unlocking songs
 */
export async function unlockSong({
  geniusId,
  segmentCount,
  pkpAuthContext,
  pkpInfo,
}: {
  geniusId: number
  segmentCount: number
  pkpAuthContext: PKPAuthContext
  pkpInfo: PKPInfo
}): Promise<{ success: boolean; txHash?: Hash; creditsSpent?: number; remainingBalance?: number; error?: string }> {
  try {
    const result = await unlockSongWithCredits(geniusId, segmentCount, pkpAuthContext, pkpInfo)
    return {
      success: true,
      ...result,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to unlock song'
    console.error('[UnlockSong] ❌ Failed:', errorMsg)

    // Classify and preserve error type semantics
    if (errorMsg.includes('Insufficient credits')) {
      throw new InsufficientCreditsError()
    }

    // Check for specific error patterns
    if (errorMsg.includes('Song already owned')) {
      return {
        success: true, // Treat as success if already owned (idempotent)
        error: 'Song already unlocked',
      }
    }

    // Re-throw other errors to preserve stack trace
    throw err
  }
}
