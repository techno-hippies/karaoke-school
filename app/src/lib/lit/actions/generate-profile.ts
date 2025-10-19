/**
 * Generate Artist Profile Lit Action
 * On-demand artist profile creation via Render service
 *
 * Flow:
 * 1. Check if artist already exists in ArtistRegistryV2 contract
 * 2. If exists → return cached data immediately
 * 3. If not → trigger Render service to generate profile (fast-track)
 * 4. Render creates: PKP → Lens Account → Contract Registration (~15s)
 * 5. Return profile data immediately
 * 6. Background: Render runs video pipeline (TikTok crawl → processing → Lens posts)
 * 7. Frontend listens for ContentFlagUpdated event when videos are ready
 */

import { getLitClient } from '../../lit-webauthn/client'
import { LIT_ACTIONS } from '@/config/lit-actions'
import type { GenerateProfileResult } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Execute Generate Artist Profile Lit Action
 * Calls Render service to create artist profile on-demand
 *
 * @param geniusArtistId - Genius artist ID
 * @param authContext - PKP auth context (required for Lit Action execution)
 * @returns Profile data (immediate if cached, or newly generated)
 *
 * @example
 * ```ts
 * const result = await executeGenerateProfile(447, pkpAuthContext) // Lady Gaga
 * if (result.success) {
 *   console.log('Profile ready:', result.lensHandle)
 *   if (result.contentGenerating) {
 *     console.log('Videos processing in background...')
 *     // Listen for ContentFlagUpdated(447, true) event
 *   }
 * }
 * ```
 */
export async function executeGenerateProfile(
  geniusArtistId: number,
  authContext: any
): Promise<GenerateProfileResult> {
  try {
    const litClient = await getLitClient()

    if (IS_DEV) {
      console.log('[executeGenerateProfile] Calling with:', {
        geniusArtistId,
        ipfsId: LIT_ACTIONS.generateProfile,
      })
    }

    const startTime = Date.now()

    const result = await litClient.executeJs({
      ipfsId: LIT_ACTIONS.generateProfile,
      authContext,
      jsParams: {
        geniusArtistId
      },
    })

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2)

    const response: GenerateProfileResult = typeof result.response === 'string'
      ? JSON.parse(result.response)
      : result.response

    if (IS_DEV) {
      if (response.success) {
        const source = response.alreadyRegistered ? '💾 CACHED' : '✨ GENERATED'
        console.log(`[Generate Profile] ${source} - ${response.artistName}`)
        console.log(`[Generate Profile] Lens: ${response.lensHandle}`)
        console.log(`[Generate Profile] PKP: ${response.pkpAddress}`)
        console.log(`[Generate Profile] Has Content: ${response.hasContent ? '✅' : '❌'}`)
        console.log(`[Generate Profile] Execution time: ${executionTime}s`)

        if (response.contentGenerating) {
          console.log('[Generate Profile] 🎬 Videos generating in background...')
          console.log('[Generate Profile] Listen for: ContentFlagUpdated(', geniusArtistId, ', true)')
        }

        if (response.nextSteps) {
          console.log('[Generate Profile] Next Steps:')
          response.nextSteps.forEach((step, idx) => {
            console.log(`  ${idx + 1}. ${step}`)
          })
        }
      } else {
        console.error('[Generate Profile] ❌ Failed:', response.error)
      }
    }

    return response
  } catch (err) {
    console.error('[Generate Profile] Failed:', err)
    return {
      success: false,
      source: 'GENERATED',
      profileReady: false,
      contentGenerating: false,
      error: err instanceof Error ? err.message : 'Profile generation failed',
    }
  }
}
