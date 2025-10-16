// Shared types for VideoPost components

import type { EncryptionMetadata, HLSMetadata } from '@/lib/lit/decrypt-video'
import type { PKPInfo, AuthData } from '@/lib/lit-webauthn/types'

export interface KaraokeLine {
  text: string
  translation?: string
  start: number
  end: number
  words?: KaraokeWord[]
}

export interface KaraokeWord {
  text: string
  start: number
  end: number
  isSung?: boolean // For highlighting
}

export interface VideoPostData {
  id: string
  videoUrl?: string // For HLS, this is the playlist URI
  thumbnailUrl?: string
  username: string
  userHandle?: string // Display name (e.g., "Professional Vocalist")
  userAvatar?: string
  grade?: string // Performance grade (A, B+, C, etc)
  description?: string // Post description/caption
  musicTitle?: string
  musicAuthor?: string
  musicImageUrl?: string
  createdAt?: string // Post date/time
  // Engagement metrics
  likes: number
  comments: number
  shares: number
  // Karaoke data
  karaokeLines?: KaraokeLine[]
  // User interaction state
  isLiked?: boolean
  isFollowing?: boolean
  canInteract?: boolean // Can like/comment/follow
  // Premium content
  isPremium?: boolean // Requires subscription to play
  userIsSubscribed?: boolean // User has active subscription
  isSubscribing?: boolean // Subscription purchase in progress
  // HLS encrypted video support
  encryption?: EncryptionMetadata // Encryption metadata for decrypting segments
  hlsMetadata?: HLSMetadata // HLS segment URIs and metadata
  pkpInfo?: PKPInfo // PKP information for decryption
  authData?: AuthData // WebAuthn auth data for decryption
}

export interface VideoPlayerProps {
  videoUrl?: string
  thumbnailUrl?: string
  isPlaying: boolean
  isMuted: boolean
  onTogglePlay: () => void
  onPlayFailed?: () => void // Called when autoplay fails
  forceShowThumbnail?: boolean // Keep thumbnail visible even when playing (for locked videos)
  className?: string
}

export interface KaraokeOverlayProps {
  lines?: KaraokeLine[]
  currentTime: number
  className?: string
  /** Show next line below current line (for karaoke recording) */
  showNextLine?: boolean
}

export interface AudioSourceButtonProps {
  musicTitle?: string
  musicAuthor?: string
  musicImageUrl?: string
  onClick?: () => void
  className?: string
}

export interface VideoActionsProps {
  // Profile
  userAvatar: string
  username: string
  isFollowing: boolean
  canFollow: boolean
  onFollowClick: () => void
  onProfileClick: () => void
  // Engagement actions
  likes: number
  comments: number
  shares: number
  isLiked: boolean
  canLike: boolean
  onLikeClick: () => void
  onCommentClick: () => void
  onShareClick: () => void
  // Audio
  musicTitle?: string
  musicAuthor?: string
  musicImageUrl?: string
  onAudioClick?: () => void
  // Video controls
  isMuted: boolean
  onToggleMute: () => void
  description?: string
  className?: string
}

export interface VideoInfoProps {
  username: string
  musicTitle?: string
  musicAuthor?: string
  onUsernameClick?: () => void
  onMusicClick?: () => void
  className?: string
}
