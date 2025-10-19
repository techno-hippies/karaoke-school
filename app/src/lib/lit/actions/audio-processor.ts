/**
 * Audio Processor Lit Action (v4 - Song-Based Demucs)
 * Triggers song-based karaoke generation (paid operation - requires credits)
 *
 * IMPORTANT: User must own the segment before calling this function.
import { LIT_ACTIONS } from '@/config/lit-actions'
 * Use checkSegmentOwnership() and unlockSegment() first if needed.
 *
 * Flow:
 * 1. Verifies segment ownership in KaraokeCreditsV1 contract
 * 2. Triggers Demucs /process-song-async (processes ALL segments)
 * 3. Returns jobId for frontend to poll
 * 4. Demucs processes in background → webhook → updates contract
 */

import { getLitClient } from '../../lit-webauthn/client'
import type { AudioProcessorResult, MatchSegmentResult } from './types'

/**
 * Execute Audio Processor Lit Action
 *
 * @param geniusId - Genius song ID
 * @param sectionIndex - Selected section (1-based index)
 * @param sections - Array of all sections from match-and-segment
 * @param soundcloudPermalink - SoundCloud track permalink
 * @param userAddress - User's wallet address (for ownership verification)
 * @param songDuration - Full song duration in seconds (from max section endTime)
 * @param authContext - PKP auth context
 */
export async function executeAudioProcessor(
  geniusId: number,
  sectionIndex: number,
  sections: MatchSegmentResult['sections'],
  soundcloudPermalink: string,
  userAddress: string,
  songDuration: number,
  authContext: any
): Promise<AudioProcessorResult> {
  const litClient = await getLitClient()

  const result = await litClient.executeJs({
    ipfsId: LIT_ACTIONS.audioProcessor,
    authContext,
    jsParams: {
      geniusId,
      sectionIndex,
      sections,
      soundcloudPermalink,
      userAddress,
      songDuration,
    },
  })

  const response: AudioProcessorResult = typeof result.response === 'string'
    ? JSON.parse(result.response)
    : result.response

  return response
}
