/**
 * Auth Capabilities Hook
 * Computes granular capabilities based on auth state
 *
 * Replaces single isReady flag with detailed capability analysis:
 * - Tier 1: PKP features (browse, search, match/segment)
 * - Tier 2: Paid features (generate, unlock, record)
 * - Tier 3: Social features (post, like, follow, comment)
 */

import { useMemo } from 'react'
import type { PKPAuthContext } from '@/lib/lit-webauthn'
import type { AuthCapabilities } from '@/features/post-flow/types'

interface UseAuthCapabilitiesParams {
  isPKPReady: boolean
  pkpAuthContext: PKPAuthContext | null
  hasLensSession: boolean
  hasLensAccount: boolean
  credits: number
}

/**
 * Resolve what user can do based on current auth state
 * Returns granular capabilities instead of single isReady flag
 */
export function useAuthCapabilities({
  isPKPReady,
  pkpAuthContext,
  hasLensSession,
  hasLensAccount,
  credits,
}: UseAuthCapabilitiesParams): AuthCapabilities {
  return useMemo(() => {
    // Tier 1: PKP features
    const hasPKP = isPKPReady && !!pkpAuthContext
    const canBrowse = hasPKP
    const canSearch = hasPKP
    const canMatchSegment = hasPKP

    // Tier 2: Paid features
    const hasCredits = credits > 0
    const canGenerate = hasPKP && hasCredits
    const canUnlock = hasPKP && hasCredits
    const canRecord = hasPKP && hasCredits // Must own segment

    // Tier 3: Social features
    const hasSocial = hasPKP && hasLensAccount
    const canPost = hasSocial
    const canLike = hasSocial
    const canFollow = hasSocial
    const canComment = hasSocial

    // Compute blocking issues
    const blockingIssues: string[] = []
    if (!hasPKP) blockingIssues.push('PKP_REQUIRED')
    if (!hasLensSession && !hasLensAccount) blockingIssues.push('LENS_SESSION_REQUIRED')
    if (hasLensSession && !hasLensAccount) blockingIssues.push('LENS_ACCOUNT_REQUIRED')
    if (credits === 0) blockingIssues.push('CREDITS_REQUIRED')

    return {
      canBrowse,
      canSearch,
      canMatchSegment,
      canGenerate,
      canUnlock,
      canRecord,
      canPost,
      canLike,
      canFollow,
      canComment,
      blockingIssues,
      capabilities: {
        hasPKP,
        hasLensSession,
        hasLensAccount,
        hasCredits,
        creditBalance: credits,
      },
    }
  }, [isPKPReady, pkpAuthContext, hasLensSession, hasLensAccount, credits])
}
