import type { Address } from 'viem'
import type { QuotaCheck, UserSponsorship } from '../types'

/**
 * Check if user has remaining sponsored quota
 */
export function checkQuota(
  user: UserSponsorship | null,
  maxSponsoredTxs: number
): QuotaCheck {
  // User not found in DB - first transaction
  if (!user) {
    return {
      canSponsor: true,
      reason: 'First-time user',
      remainingQuota: maxSponsoredTxs,
    }
  }

  // Check sponsored count
  const remaining = maxSponsoredTxs - user.sponsored_count

  if (remaining > 0) {
    return {
      canSponsor: true,
      remainingQuota: remaining,
    }
  }

  // Quota exhausted - check if POH verified
  if (user.poh_score >= 20) {
    return {
      canSponsor: true,
      reason: 'POH verified',
      remainingQuota: Infinity,
    }
  }

  return {
    canSponsor: false,
    reason: 'Quota exhausted',
    remainingQuota: 0,
  }
}

/**
 * Check if PKP balance meets minimum requirement
 */
export function hasMinimumBalance(
  balanceWei: bigint,
  minBalanceWei: bigint
): boolean {
  return balanceWei >= minBalanceWei
}
