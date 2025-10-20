import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StudyExercisePage } from '@/components/exercises/StudyExercisePage'
import { useSongData } from '@/hooks/useSongData'
import { useSegmentLyrics } from '@/hooks/useSegmentLyrics'
import { useAuth } from '@/contexts/AuthContext'
import { executeStudyScorer } from '@/lib/lit/actions'
import type { LyricLine } from '@/types/karaoke'
import { toast } from 'sonner'

/**
 * StudyExercisePageContainer - Container for study exercise flow
 *
 * Loads segment data and integrates with study-scorer-v1 Lit Action
 */
export function StudyExercisePageContainer() {
  const navigate = useNavigate()
  const { geniusId, segmentId } = useParams<{ geniusId: string; segmentId: string }>()
  const { pkpAuthContext, pkpAddress } = useAuth()

  const { song, segments } = useSongData(
    geniusId ? parseInt(geniusId) : undefined,
    pkpAddress || undefined
  )

  // Find the selected segment
  const segment = segments.find(s => s.id === segmentId)

  // Load lyrics for this segment
  const alignmentUri = song?.alignmentUri || song?.metadataUri
  const { lyrics } = useSegmentLyrics(
    alignmentUri,
    segment?.startTime,
    segment?.endTime,
    geniusId ? parseInt(geniusId) : undefined
  )

  const handleBack = useCallback(() => {
    navigate(`/song/${geniusId}/segment/${segmentId}`)
  }, [navigate, geniusId, segmentId])

  const handleScoreSession = useCallback(async (
    audioBlob: Blob,
    lines: LyricLine[]
  ) => {
    if (!pkpAuthContext || !pkpAddress || !geniusId || !segmentId) {
      console.error('[StudyExerciseContainer] Missing auth context or params')
      toast.error('Please connect your wallet first')
      return {
        success: false,
        scores: [],
        ratings: [],
        averageScore: 0
      }
    }

    try {
      console.log('[StudyExerciseContainer] Calling study-scorer-v1 Lit Action...')

      // TODO: Remove testMode once Lit Action is deployed to IPFS
      const testMode = true // Enable test mode for development

      const result = await executeStudyScorer(
        audioBlob,
        lines,
        `genius-${geniusId}`, // songId format
        segmentId,
        pkpAddress,
        pkpAuthContext,
        testMode
      )

      if (result.success) {
        console.log('[StudyExerciseContainer] ✅ Study session scored!', result)
        toast.success(`Study session completed! Average: ${result.averageScore}%`)

        return {
          success: true,
          scores: result.scores,
          ratings: result.ratings,
          averageScore: result.averageScore,
          txHash: result.txHash
        }
      } else {
        console.error('[StudyExerciseContainer] ❌ Scoring failed:', result.error)
        toast.error(`Scoring failed: ${result.error || 'Unknown error'}`)

        return {
          success: false,
          scores: [],
          ratings: [],
          averageScore: 0
        }
      }
    } catch (error) {
      console.error('[StudyExerciseContainer] Error:', error)
      toast.error('Failed to score study session')

      return {
        success: false,
        scores: [],
        ratings: [],
        averageScore: 0
      }
    }
  }, [pkpAuthContext, pkpAddress, geniusId, segmentId])

  // Show loading state if data isn't ready
  if (!segment || lyrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <StudyExercisePage
      songId={`genius-${geniusId}`}
      segmentId={segmentId || ''}
      segmentName={segment.displayName}
      lyrics={lyrics}
      onBack={handleBack}
      onScoreSession={handleScoreSession}
      userAddress={pkpAddress || undefined}
      canRecord={!!pkpAuthContext && !!pkpAddress}
    />
  )
}
