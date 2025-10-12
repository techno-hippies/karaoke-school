/**
 * Post Flow State Machine Hook
 * Orchestrates the entire karaoke post flow
 */

import { useState, useCallback } from 'react'
import { usePostFlowAuth } from './usePostFlowAuth'
import { useCredits } from './useCredits'
import { useKaraokeGeneration } from './useKaraokeGeneration'
import type {
  PostFlowState,
  PostFlowData,
  PostFlowContext,
  Song,
  SongSegment,
  PerformanceGrade,
} from '../types'

const INITIAL_DATA: PostFlowData = {
  selectedSong: null,
  selectedSegment: null,
  karaokeLines: null,
  recordedVideoBlob: null,
  recordedVideoUrl: null,
  grade: null,
  postUrl: null,
  searchResults: [],
}

export function usePostFlow(onComplete: () => void) {
  const [state, setState] = useState<PostFlowState>('SONG_SELECT')
  const [data, setData] = useState<PostFlowData>(INITIAL_DATA)

  // Hooks
  const authHook = usePostFlowAuth()
  const creditsHook = useCredits()
  const karaokeHook = useKaraokeGeneration()

  /**
   * Update flow data (immutable)
   */
  const updateData = useCallback((updates: Partial<PostFlowData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Navigation: Song Select
   */
  const goToSongSelect = useCallback(() => {
    setState('SONG_SELECT')
  }, [])

  /**
   * Navigation: Segment Picker
   * Processed songs should already have segments loaded from contract metadata
   */
  const goToSegmentPicker = useCallback(async (song: Song) => {
    // If segments already loaded, go directly to picker
    if (song.segments && song.segments.length > 0) {
      updateData({ selectedSong: song })
      setState('SEGMENT_PICKER')
      return
    }

    // Fallback: if processed but no segments, run match-and-segment to populate
    // This shouldn't happen if search properly loaded from contract
    if (song.isProcessed) {
      console.warn('[PostFlow] Processed song missing segments, falling back to generateKaraoke')
    }

    updateData({ selectedSong: song })
    setState('GENERATE_KARAOKE')
  }, [updateData])

  /**
   * Navigation: Generate Karaoke (cold start)
   */
  const goToGenerateKaraoke = useCallback((song: Song) => {
    updateData({ selectedSong: song })
    setState('GENERATE_KARAOKE')
  }, [updateData])

  /**
   * Navigation: Purchase Credits
   */
  const goToPurchaseCredits = useCallback(() => {
    setState('PURCHASE_CREDITS')
  }, [])

  /**
   * Navigation: Recording
   */
  const goToRecording = useCallback((song: Song, segment: SongSegment) => {
    updateData({ selectedSong: song, selectedSegment: segment })
    setState('RECORDING')
  }, [updateData])

  /**
   * Navigation: Grading (after recording)
   */
  const goToGrading = useCallback((videoBlob: Blob) => {
    updateData({ recordedVideoBlob: videoBlob })
    setState('GRADING')
  }, [updateData])

  /**
   * Navigation: Posting (after grading)
   */
  const goToPosting = useCallback((videoUrl: string, grade: PerformanceGrade) => {
    updateData({ recordedVideoUrl: videoUrl, grade })
    setState('POSTING')
  }, [updateData])

  /**
   * Complete flow
   */
  const complete = useCallback(() => {
    setState('COMPLETE')
    setData(INITIAL_DATA)
    onComplete()
  }, [onComplete])

  /**
   * Cancel flow
   */
  const cancel = useCallback(() => {
    setState('COMPLETE')
    setData(INITIAL_DATA)
    onComplete()
  }, [onComplete])

  /**
   * Action: Generate Karaoke (Match and Segment only)
   */
  const generateKaraoke = useCallback(async (song: Song) => {
    if (!song) return

    const result = await karaokeHook.generateKaraoke(song)
    if (!result) {
      throw new Error('Failed to generate karaoke segments')
    }

    // Update song with segments + metadata for audio processing
    const updatedSong: Song = {
      ...song,
      isProcessed: true,
      segments: result.segments,
      soundcloudPermalink: result.soundcloudPermalink,
      songDuration: result.songDuration,
    }

    updateData({ selectedSong: updatedSong })

    // Auto-advance to segment picker
    goToSegmentPicker(updatedSong)
  }, [karaokeHook, updateData, goToSegmentPicker])

  /**
   * Action: Purchase Credits
   */
  const purchaseCredits = useCallback(async (packageId: number) => {
    const success = await creditsHook.purchaseCredits(packageId)
    if (!success) {
      // Throw error with details from creditsHook
      throw new Error(creditsHook.error || 'Failed to purchase credits')
    }

    // Reload credits
    await authHook.reloadCredits()

    // Wait for balance to update
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Return to song select - user can pick song again with credits
    goToSongSelect()
  }, [creditsHook, authHook, goToSongSelect])

  /**
   * Action: Unlock Segment (and trigger audio processing)
   */
  const unlockSegment = useCallback(async (song: Song, segment: SongSegment) => {
    // Step 1: Unlock segment (spend 1 credit)
    const success = await creditsHook.unlockSegment(song, segment)
    if (!success) {
      throw new Error('Failed to unlock segment')
    }

    // Reload credits
    await authHook.reloadCredits()

    // Step 2: Trigger audio processing (for ALL segments)
    if (song.soundcloudPermalink && song.segments && song.songDuration) {
      console.log('[PostFlow] Triggering audio processing after unlock...')
      const jobId = await karaokeHook.processAudio(
        song,
        segment,
        song.segments,
        song.soundcloudPermalink,
        song.songDuration
      )

      if (jobId) {
        console.log('[PostFlow] Audio processing started, job ID:', jobId)
        // TODO: Store jobId and poll for completion
      } else {
        console.warn('[PostFlow] Audio processing failed to start')
      }
    } else {
      console.warn('[PostFlow] Missing data for audio processing:', {
        hasPermalink: !!song.soundcloudPermalink,
        hasSegments: !!song.segments,
        hasDuration: !!song.songDuration
      })
    }

    // Proceed to recording (audio will process in background)
    goToRecording(song, segment)
  }, [creditsHook, authHook, karaokeHook, goToRecording])

  /**
   * Action: Grade Performance
   */
  const gradePerformance = useCallback(async (
    videoBlob: Blob,
    segment: SongSegment
  ): Promise<PerformanceGrade> => {
    const grade = await karaokeHook.gradePerformance(videoBlob, segment)
    if (!grade) {
      throw new Error('Failed to grade performance')
    }

    return grade
  }, [karaokeHook])

  /**
   * Action: Create Post (upload to Lens)
   */
  const createPost = useCallback(async (
    videoUrl: string,
    grade: PerformanceGrade
  ): Promise<string> => {
    // TODO: Implement Lens post creation
    // This would:
    // 1. Upload video to Lens storage
    // 2. Create Lens post with metadata
    // 3. Return post URL

    console.log('[PostFlow] Creating post with grade:', grade.grade)

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000))

    const mockPostUrl = `https://lens.xyz/post/${Date.now()}`
    return mockPostUrl
  }, [])

  // Build context
  const context: PostFlowContext = {
    state,
    data,
    auth: authHook.auth,

    // Navigation
    goToSongSelect,
    goToSegmentPicker,
    goToGenerateKaraoke,
    goToPurchaseCredits,
    goToRecording,
    goToGrading,
    goToPosting,
    complete,
    cancel,

    // Actions
    generateKaraoke,
    purchaseCredits,
    unlockSegment,
    gradePerformance,
    createPost,

    // Data management
    updateData,
  }

  return {
    ...context,
    isGenerating: karaokeHook.isGenerating,
    isProcessing: karaokeHook.isProcessing,
    isGrading: karaokeHook.isGrading,
    isPurchasing: creditsHook.isPurchasing,
    isUnlocking: creditsHook.isUnlocking,
    currentJobId: karaokeHook.currentJobId,
    error: authHook.auth.error || creditsHook.error || karaokeHook.error,
  }
}
