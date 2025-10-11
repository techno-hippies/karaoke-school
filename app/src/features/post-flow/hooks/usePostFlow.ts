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
   */
  const goToSegmentPicker = useCallback((song: Song) => {
    updateData({ selectedSong: song })
    setState('SEGMENT_PICKER')
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
   * Action: Generate Karaoke
   */
  const generateKaraoke = useCallback(async (song: Song) => {
    if (!song) return

    const segments = await karaokeHook.generateKaraoke(song)
    if (!segments) {
      throw new Error('Failed to generate karaoke segments')
    }

    // Update song with segments
    const updatedSong: Song = {
      ...song,
      isProcessed: true,
      segments,
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
   * Action: Unlock Segment
   */
  const unlockSegment = useCallback(async (song: Song, segment: SongSegment) => {
    const success = await creditsHook.unlockSegment(song, segment)
    if (!success) {
      throw new Error('Failed to unlock segment')
    }

    // Reload credits
    await authHook.reloadCredits()

    // Proceed to recording
    goToRecording(song, segment)
  }, [creditsHook, authHook, goToRecording])

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
  }

  return {
    ...context,
    isGenerating: karaokeHook.isGenerating,
    isGrading: karaokeHook.isGrading,
    isPurchasing: creditsHook.isPurchasing,
    isUnlocking: creditsHook.isUnlocking,
    error: authHook.auth.error || creditsHook.error || karaokeHook.error,
  }
}
