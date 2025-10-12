/**
 * Karaoke Generation Hook
 * Handles Lit Action execution for match/segment and audio processing
 */

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { executeMatchAndSegment, executeAudioProcessor } from '@/lib/lit/actions'
import type { Song, SongSegment, PerformanceGrade } from '../types'
import type { MatchSegmentResult, AudioProcessorResult } from '@/lib/lit/actions'

export function useKaraokeGeneration() {
  const { pkpWalletClient, pkpAuthContext, pkpAddress } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isGrading, setIsGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  /**
   * Generate karaoke segments for a song (Match and Segment Lit Action)
   * Uses PKP auth context for zero-signature execution
   * Returns segments + soundcloudPermalink for audio processing
   */
  const generateKaraoke = async (song: Song): Promise<{ segments: SongSegment[], soundcloudPermalink: string, songDuration: number } | null> => {
    if (!pkpAuthContext) {
      setError('PKP auth context not ready')
      return null
    }

    setIsGenerating(true)
    setError(null)

    try {
      console.log('[KaraokeGen] Executing Match and Segment for:', song.geniusId)
      console.log('[KaraokeGen] Using PKP auth context (zero signatures required)')

      const result: MatchSegmentResult = await executeMatchAndSegment(song.geniusId, pkpAuthContext)

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate karaoke')
      }

      if (!result.isMatch) {
        throw new Error('Song metadata did not match. Please try a different song.')
      }

      if (!result.sections || result.sections.length === 0) {
        throw new Error('No song sections found')
      }

      if (!result.genius?.soundcloudPermalink) {
        throw new Error('No SoundCloud link found for this song')
      }

      // Convert Lit Action sections to SongSegment format
      const segments: SongSegment[] = result.sections.map((section, index) => ({
        id: section.type.toLowerCase().replace(/\s+/g, '-'),
        displayName: section.type,
        startTime: section.startTime,
        endTime: section.endTime,
        duration: section.duration,
        isOwned: false, // Will be checked separately
      }))

      // Calculate song duration (max endTime from sections)
      const songDuration = Math.max(...result.sections.map(s => s.endTime))

      console.log('[KaraokeGen] Generated', segments.length, 'segments')
      console.log('[KaraokeGen] SoundCloud permalink:', result.genius.soundcloudPermalink)
      console.log('[KaraokeGen] Song duration:', songDuration, 'seconds')

      return {
        segments,
        soundcloudPermalink: result.genius.soundcloudPermalink,
        songDuration
      }
    } catch (err) {
      console.error('[KaraokeGen] Generation failed:', err)
      setError(err instanceof Error ? err.message : 'Generation failed')
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  /**
   * Trigger audio processing for a song (Audio Processor v4 Lit Action)
   * Called after user unlocks a segment
   * Processes ALL segments for the song (song-based optimization)
   */
  const processAudio = async (
    song: Song,
    selectedSegment: SongSegment,
    allSegments: SongSegment[],
    soundcloudPermalink: string,
    songDuration: number
  ): Promise<string | null> => {
    if (!pkpAuthContext || !pkpAddress) {
      setError('PKP auth context not ready')
      return null
    }

    setIsProcessing(true)
    setError(null)

    try {
      console.log('[KaraokeGen] Triggering audio processing for song:', song.geniusId)
      console.log('[KaraokeGen] Selected segment:', selectedSegment.id)
      console.log('[KaraokeGen] Total segments:', allSegments.length)

      // Find selected segment index (1-based)
      const sectionIndex = allSegments.findIndex(s => s.id === selectedSegment.id) + 1

      if (sectionIndex === 0) {
        throw new Error('Selected segment not found in segments array')
      }

      // Convert SongSegment[] to sections array format for Lit Action
      const sections = allSegments.map(seg => ({
        type: seg.displayName,
        startTime: seg.startTime,
        endTime: seg.endTime,
        duration: seg.duration
      }))

      const result: AudioProcessorResult = await executeAudioProcessor(
        song.geniusId,
        sectionIndex,
        sections,
        soundcloudPermalink,
        pkpAddress,
        songDuration,
        pkpAuthContext
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to start audio processing')
      }

      console.log('[KaraokeGen] Audio processing started')
      console.log('[KaraokeGen] Job ID:', result.jobId)
      console.log('[KaraokeGen] Poll URL:', result.pollUrl)
      console.log('[KaraokeGen] Estimated time:', result.estimatedTime)

      setCurrentJobId(result.jobId)
      return result.jobId
    } catch (err) {
      console.error('[KaraokeGen] Audio processing failed:', err)
      setError(err instanceof Error ? err.message : 'Audio processing failed')
      return null
    } finally {
      setIsProcessing(false)
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
    isProcessing,
    isGrading,
    error,
    currentJobId,
    generateKaraoke,
    processAudio,
    gradePerformance,
  }
}
