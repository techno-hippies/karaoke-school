/**
 * Post Flow Types
 * Centralized type definitions for the karaoke post flow
 */

import type { KaraokeLine } from '@/components/feed/types'

/**
 * Song Segment
 */
export interface SongSegment {
  id: string
  displayName: string
  startTime: number
  endTime: number
  duration: number
  audioUrl?: string
  isOwned?: boolean
  karaokeLines?: KaraokeLine[]
}

/**
 * Post Flow State Machine States
 */
export type PostFlowState =
  | 'SONG_SELECT'
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
  geniusArtistId?: number // Genius artist ID for linking to artist page
  title: string
  artist: string
  artworkUrl?: string
  isFree?: boolean
  isProcessed?: boolean
  isOwned?: boolean // True if user owns this song (has unlocked/purchased access)
  segments?: SongSegment[]
  soundcloudPermalink?: string
  // Listening platform URLs from Genius API
  youtubeUrl?: string
  spotifyUuid?: string
  appleMusicId?: string
  appleMusicPlayerUrl?: string
  songDuration?: number
  metadataUri?: string // Legacy: combined metadata (deprecated, use sectionsUri + alignmentUri)
  alignmentUri?: string // Base alignment URI (word-level timing)
  sectionsUri?: string // Song sections/segments URI
  availableLanguages?: string[] // Translation languages available
  hasBaseAlignment?: boolean // True if base-alignment has been run (metadata contains word-level timing)
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
  searchResults: Song[] // Persist search results
}

/**
 * Auth Capability Tiers
 * Features unlock progressively as user completes auth steps
 */
export interface AuthCapabilities {
  // Tier 1: PKP Only (zero signatures)
  canBrowse: boolean        // View catalog, trending
  canSearch: boolean        // Genius search via Lit Action
  canMatchSegment: boolean  // Match & Segment Lit Action

  // Tier 2: PKP + Credits (paid features)
  canGenerate: boolean      // Audio processor Lit Action
  canUnlock: boolean        // Segment ownership
  canRecord: boolean        // Recording requires unlocked segment

  // Tier 3: PKP + Lens (social features)
  canPost: boolean          // Create Lens posts
  canLike: boolean          // Like posts
  canFollow: boolean        // Follow users
  canComment: boolean       // Comment on posts

  // Meta info
  blockingIssues: string[]  // What's preventing next tier
  capabilities: {
    hasPKP: boolean
    hasLensSession: boolean
    hasLensAccount: boolean
    hasCredits: boolean
    creditBalance: number
  }
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

  // Granular capabilities
  capabilities: AuthCapabilities
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

  // Data management
  updateData: (updates: Partial<PostFlowData>) => void
}

/**
 * Credit Packages
 */
export interface CreditPackage {
  id: number
  credits: number
  priceUSDC: string // USDC amount (with 6 decimals)
  priceDisplay: string
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 0, credits: 1, priceUSDC: '500000', priceDisplay: '$0.50' },      // 0.50 USDC
  { id: 1, credits: 5, priceUSDC: '2500000', priceDisplay: '$2.50' },     // 2.50 USDC
  { id: 2, credits: 20, priceUSDC: '10000000', priceDisplay: '$10.00' },  // 10.00 USDC
]
