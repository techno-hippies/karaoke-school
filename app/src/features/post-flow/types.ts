/**
 * Post Flow Types
 * Centralized type definitions for the karaoke post flow
 */

import type { SongSegment } from '@/components/karaoke/SegmentPickerDrawer'
import type { KaraokeLine } from '@/components/feed/types'

/**
 * Post Flow State Machine States
 */
export type PostFlowState =
  | 'SONG_SELECT'
  | 'SEGMENT_PICKER'
  | 'GENERATE_KARAOKE'
  | 'PURCHASE_CREDITS'
  | 'RECORDING'
  | 'GRADING'
  | 'POSTING'
  | 'COMPLETE'

/**
 * Song with karaoke metadata
 */
export interface Song {
  id: string
  geniusId: number
  title: string
  artist: string
  artworkUrl?: string
  isFree?: boolean
  isProcessed?: boolean
  segments?: SongSegment[]
  soundcloudPermalink?: string
}

/**
 * Performance Grade from Lit Action
 */
export interface PerformanceGrade {
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
  score: number // 0-100
  feedback: string
  strengths: string[]
  improvements: string[]
}

/**
 * Post Flow Data
 * All data accumulated through the flow
 */
export interface PostFlowData {
  selectedSong: Song | null
  selectedSegment: SongSegment | null
  karaokeLines: KaraokeLine[] | null
  recordedVideoBlob: Blob | null
  recordedVideoUrl: string | null
  grade: PerformanceGrade | null
  postUrl: string | null
}

/**
 * Auth Requirements Status
 */
export interface PostFlowAuthStatus {
  isWalletConnected: boolean
  hasLensAccount: boolean
  isLitReady: boolean
  hasCredits: boolean
  credits: number
  isReady: boolean
  error: string | null
}

/**
 * Post Flow Context
 */
export interface PostFlowContext {
  state: PostFlowState
  data: PostFlowData
  auth: PostFlowAuthStatus

  // Navigation
  goToSongSelect: () => void
  goToSegmentPicker: (song: Song) => void
  goToGenerateKaraoke: (song: Song) => void
  goToPurchaseCredits: () => void
  goToRecording: (song: Song, segment: SongSegment) => void
  goToGrading: (videoBlob: Blob) => void
  goToPosting: (videoUrl: string, grade: PerformanceGrade) => void
  complete: () => void
  cancel: () => void

  // Actions
  generateKaraoke: (song: Song) => Promise<void>
  purchaseCredits: (packageId: number) => Promise<void>
  unlockSegment: (song: Song, segment: SongSegment) => Promise<void>
  gradePerformance: (videoBlob: Blob, segment: SongSegment) => Promise<PerformanceGrade>
  createPost: (videoUrl: string, grade: PerformanceGrade) => Promise<string>
}

/**
 * Credit Packages
 */
export interface CreditPackage {
  id: number
  credits: number
  price: string // ETH amount
  priceUsd: string
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 0, credits: 1, price: '0.0002', priceUsd: '$0.50' },
  { id: 1, credits: 5, price: '0.001', priceUsd: '$2.50' },
  { id: 2, credits: 20, price: '0.004', priceUsd: '$10' },
]
