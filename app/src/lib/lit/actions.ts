/**
 * Lit Action Execution Utilities
 * Execute serverless functions on Lit Protocol
 */

import { getLitClient, litAuthManager } from './client'
import { LIT_ACTIONS } from './config'

/**
 * Segment Generation Result
 */
export interface SegmentGenerationResult {
  success: boolean
  genius: {
    artist: string
    title: string
    album: string
  }
  lrclib: {
    artist: string
    title: string
    album: string
    lyricsLines: number
    matchScore: number
  }
  isMatch: boolean
  confidence: 'high' | 'medium' | 'low'
  sections: Array<{
    type: string
    startTime: number
    endTime: number
    duration: number
  }>
  error?: string
}

/**
 * Karaoke Generation Result
 */
export interface KaraokeGenerationResult {
  success: boolean
  geniusId: number
  section: {
    index: number
    type: string
    startTime: number
    endTime: number
    duration: number
  }
  audio: {
    audioUrl: string
    vocalsZipSize: number
    drumsZipSize: number
    _note: string
  }
  processing: {
    downloadTime: number
    trimTime: number
    separationTime: number
    modalProcessingTime: number
    totalTime: number
  }
  speedup: {
    sectionDuration: number
    processingTime: number
    ratio: string
  }
  error?: string
}

/**
 * Execute match-and-segment-v2 Lit Action
 * Finds song segments (FREE operation)
 */
export async function executeSegmentGeneration(
  geniusId: number,
  encryptedKeys: {
    geniusKeyAccessControlConditions: any
    geniusKeyCiphertext: string
    geniusKeyDataToEncryptHash: string
    openrouterKeyAccessControlConditions: any
    openrouterKeyCiphertext: string
    openrouterKeyDataToEncryptHash: string
  }
): Promise<SegmentGenerationResult> {
  const client = await getLitClient()
  const authSig = await litAuthManager.getAuthSig()

  const result = await client.executeJs({
    ipfsId: LIT_ACTIONS.matchAndSegment,
    jsParams: {
      geniusId,
      ...encryptedKeys,
    },
    authSig,
  })

  return JSON.parse(result.response as string)
}

/**
 * Execute audio-processor-v1 Lit Action
 * Generates karaoke stems (PAID operation - requires credit)
 */
export async function executeKaraokeGeneration(
  geniusId: number,
  sectionIndex: number,
  sections: SegmentGenerationResult['sections'],
  soundcloudPermalink: string,
  encryptedKeys: {
    elevenlabsKeyAccessControlConditions: any
    elevenlabsKeyCiphertext: string
    elevenlabsKeyDataToEncryptHash: string
  }
): Promise<KaraokeGenerationResult> {
  const client = await getLitClient()
  const authSig = await litAuthManager.getAuthSig()

  const result = await client.executeJs({
    ipfsId: LIT_ACTIONS.audioProcessor,
    jsParams: {
      geniusId,
      sectionIndex,
      sections,
      soundcloudPermalink,
      ...encryptedKeys,
    },
    authSig,
  })

  return JSON.parse(result.response as string)
}
