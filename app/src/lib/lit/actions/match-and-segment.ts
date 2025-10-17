/**
 * Match and Segment Lit Action (v7 - Hardcoded System PKP)
 * Matches Genius song with LRCLib and extracts song sections
 *
 * Flow:
 * 1. Fetch song metadata from Genius
 * 2. Get synced lyrics from LRClib
 * 3. Match + segment with AI (NO alignment, NO translations)
 * 4. Write to blockchain using SYSTEM PKP (hardcoded in Lit Action)
 *
 * Expected time: ~5-10s (was ~30-60s with v5 alignment)
 * Expected cost: ~$0.01 (was ~$0.05 with v5)
 *
 * Security:
 * - System PKP credentials hardcoded in IPFS code (immutable, can't be spoofed)
 * - User's PKP only for authentication, system PKP signs transactions
 * - Contract only allows system PKP as trustedProcessor
 *
 * Note: Alignment and translations are done separately via base-alignment-v1 and translate-lyrics-v1
 */

import { getLitClient } from '../../lit-webauthn/client'
import { getKaraokeKeyParams } from '../keys'
import { LIT_ACTIONS } from '@/config/lit-actions'
import type { MatchSegmentResult } from './types'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'

const IS_DEV = import.meta.env.DEV

/**
 * Execute Match and Segment Lit Action
 *
 * @param geniusId - Genius song ID
 * @param authContext - PKP auth context (user's PKP for authentication)
 */
export async function executeMatchAndSegment(
  geniusId: number,
  authContext: any
): Promise<MatchSegmentResult> {
  const litClient = await getLitClient()
  const keyParams = getKaraokeKeyParams()

  const jsParams: any = {
    geniusId,
    ...keyParams,
    contractAddress: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
    writeToBlockchain: true
  }

  if (IS_DEV) {
    console.log('[Match] jsParams:', {
      geniusId,
      hasGeniusACC: !!jsParams.geniusKeyAccessControlConditions,
      hasOpenRouterACC: !!jsParams.openrouterKeyAccessControlConditions,
      hasElevenlabsACC: !!jsParams.elevenlabsKeyAccessControlConditions,
      contractAddress: jsParams.contractAddress,
      ipfsId: LIT_ACTIONS.matchSegment
    })
  }

  const result = await litClient.executeJs({
    ipfsId: LIT_ACTIONS.matchSegment,
    authContext,
    jsParams,
  })

  const response: MatchSegmentResult = typeof result.response === 'string'
    ? JSON.parse(result.response)
    : result.response

  if (IS_DEV && response.success && response.isMatch) {
    console.log(`[Match] ${response.genius?.artist} - ${response.genius?.title}`,
      `(${response.confidence}, ${response.sections?.length || 0} sections)`)
  }

  return response
}
