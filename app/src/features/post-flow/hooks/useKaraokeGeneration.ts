/**
 * Karaoke Generation Hook
 * Handles Lit Action execution for match/segment and grading
 */

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { executeMatchAndSegment } from '@/lib/lit/actions'
import type { Song, SongSegment, PerformanceGrade } from '../types'
import type { MatchSegmentResult } from '@/lib/lit/actions'

export function useKaraokeGeneration() {
  const { pkpWalletClient, pkpAuthContext } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGrading, setIsGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Generate karaoke segments for a song (Match and Segment Lit Action)
   * Uses PKP auth context for zero-signature execution
   */
  const generateKaraoke = async (song: Song): Promise<SongSegment[] | null> => {
    if (!pkpWalletClient || !pkpAuthContext) {
      setError('PKP wallet not ready')
      return null
    }

    setIsGenerating(true)
    setError(null)

    try {
      console.log('[KaraokeGen] Executing Match and Segment for:', song.geniusId)
      console.log('[KaraokeGen] Using PKP auth context (zero signatures required)')

      const result: MatchSegmentResult = await executeMatchAndSegment(song.geniusId, pkpWalletClient)

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate karaoke')
      }

      if (!result.isMatch) {
        throw new Error('Song metadata did not match. Please try a different song.')
      }

      if (!result.sections || result.sections.length === 0) {
        throw new Error('No song sections found')
      }

      // Convert Lit Action sections to SongSegment format
      const segments: SongSegment[] = result.sections.map((section, index) => ({
        id: `${section.type.toLowerCase()}-${index}`,
        displayName: section.type,
        startTime: section.startTime,
        endTime: section.endTime,
        duration: section.duration,
        isOwned: false, // Will be checked separately
      }))

      console.log('[KaraokeGen] Generated', segments.length, 'segments')
      return segments
    } catch (err) {
      console.error('[KaraokeGen] Generation failed:', err)
      setError(err instanceof Error ? err.message : 'Generation failed')
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  /**
   * Grade performance (placeholder - will use Lit Action in future)
   * For now, returns mock grade
   */
  const gradePerformance = async (
    videoBlob: Blob,
    segment: SongSegment
  ): Promise<PerformanceGrade | null> => {
    setIsGrading(true)
    setError(null)

    try {
      console.log('[KaraokeGen] Grading performance for segment:', segment.id)

      // TODO: Implement actual grading Lit Action
      // This would:
      // 1. Upload video blob to temporary storage
      // 2. Execute Lit Action with ElevenLabs voice analysis
      // 3. Return grade based on pitch accuracy, timing, etc.

      // For now, return mock grade
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate processing

      const mockGrade: PerformanceGrade = {
        grade: 'A',
        score: 85,
        feedback: 'Great performance! Your pitch control was excellent.',
        strengths: ['Pitch accuracy', 'Timing', 'Emotion'],
        improvements: ['Breath control', 'Volume consistency'],
      }

      console.log('[KaraokeGen] Grade:', mockGrade.grade)
      return mockGrade
    } catch (err) {
      console.error('[KaraokeGen] Grading failed:', err)
      setError(err instanceof Error ? err.message : 'Grading failed')
      return null
    } finally {
      setIsGrading(false)
    }
  }

  return {
    isGenerating,
    isGrading,
    error,
    generateKaraoke,
    gradePerformance,
  }
}
