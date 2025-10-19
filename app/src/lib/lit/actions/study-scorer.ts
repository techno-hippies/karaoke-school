/**
 * Study Scorer v1 Lit Action
 * Transcribes audio, scores pronunciation, runs FSRS-4.5 algorithm, and updates contract
 *
 * Flow:
 * 1. Decrypt Voxstral API key (in production) or use test mode
 * 2. Transcribe audio via Voxstral STT API
 * 3. Calculate pronunciation scores (Levenshtein distance)
 * 4. Run FSRS-4.5 algorithm for each line
 * 5. Sign and submit batch update to FSRSTrackerV1 contract
 *
 * Expected time: ~3-5s
 * Expected cost: ~$0.00015 (Base Sepolia gas)
 */

import { getLitClient } from '../../lit-webauthn/client'
import type { StudyScorerResult } from './types'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'
import { LIT_ACTIONS } from '@/config/lit-actions'
import type { LyricLine } from '@/types/karaoke'

const IS_DEV = import.meta.env.DEV

/**
 * Convert Blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Execute Study Scorer Lit Action
 *
 * @param audioBlob - Recorded audio blob
 * @param expectedLyrics - Expected lyrics lines with timing
 * @param songId - Song identifier for FSRS tracking
 * @param segmentId - Segment identifier for FSRS tracking
 * @param userAddress - User's Ethereum address
 * @param authContext - PKP auth context for authentication
 * @param testMode - If true, skip real transcription (use expected lyrics)
 */
export async function executeStudyScorer(
  audioBlob: Blob,
  expectedLyrics: LyricLine[],
  songId: string,
  segmentId: string,
  userAddress: string,
  authContext: any,
  testMode: boolean = false
): Promise<StudyScorerResult> {
  try {
    const litClient = await getLitClient()

    // Convert audio to base64
    const audioBase64 = await blobToBase64(audioBlob)

    if (IS_DEV) {
      console.log('[StudyScorer] Starting execution:', {
        songId,
        segmentId,
        userAddress,
        audioSize: audioBlob.size,
        linesCount: expectedLyrics.length,
        testMode
      })
    }

    // Format lyrics for Lit Action
    const formattedLyrics = expectedLyrics.map((line) => ({
      lineIndex: line.lineIndex,
      text: line.originalText,
      startTime: line.startTime || 0
    }))

    // Voxstral key encryption params (placeholder - will use actual encrypted key in production)
    // For now, test mode will skip decryption
    const voxstralKey = {
      ciphertext: "",
      dataToEncryptHash: "",
      accessControlConditions: []
    }

    const result = await litClient.executeJs({
      ipfsId: LIT_ACTIONS.studyScorer, // TODO: Deploy and add CID to config
      authContext,
      jsParams: {
        userAddress,
        songId,
        segmentId,
        expectedLyrics: formattedLyrics,
        audioBlob: audioBase64,
        testMode, // Enable test mode for development

        // Voxstral key encryption params
        voxstralKeyAccessControlConditions: voxstralKey.accessControlConditions,
        voxstralKeyCiphertext: voxstralKey.ciphertext,
        voxstralKeyDataToEncryptHash: voxstralKey.dataToEncryptHash,

        // Contract write params
        contractAddress: BASE_SEPOLIA_CONTRACTS.fsrsTrackerV1,
        writeToBlockchain: true,

        // No previous cards for now (TODO: fetch from contract)
        previousCards: null
      },
    })

    const response: StudyScorerResult = typeof result.response === 'string'
      ? JSON.parse(result.response)
      : result.response

    if (IS_DEV) {
      if (response.success) {
        console.log(`[StudyScorer] ✅ Success:`, {
          linesProcessed: response.linesProcessed,
          averageScore: response.averageScore,
          scores: response.scores,
          ratings: response.ratings,
          txHash: response.txHash,
          contractError: response.contractError
        })

        if (!response.txHash) {
          console.warn('[StudyScorer] ⚠️ No transaction hash - contract not updated!')
        }
        if (response.contractError) {
          console.error('[StudyScorer] ❌ Contract update failed:', response.contractError)
        }
      } else {
        console.error('[StudyScorer] ❌ Failed:', response.error)
      }
    }

    return response
  } catch (err) {
    console.error('[StudyScorer] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Study scoring failed',
      linesProcessed: 0,
      scores: [],
      ratings: [],
      averageScore: 0
    }
  }
}
