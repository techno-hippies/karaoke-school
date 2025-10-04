// Shared types for VideoPost components

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
  videoUrl?: string
  thumbnailUrl?: string
  username: string
  userHandle?: string
  userAvatar?: string
  description: string
  musicTitle?: string
  musicAuthor?: string
  musicImageUrl?: string
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
}

export interface VideoPlayerProps {
  videoUrl?: string
  thumbnailUrl?: string
  isPlaying: boolean
  isMuted: boolean
  onTogglePlay: () => void
  onToggleMute: () => void
  className?: string
}

export interface KaraokeOverlayProps {
  lines?: KaraokeLine[]
  currentTime: number
  className?: string
}

export interface AudioSourceButtonProps {
  musicTitle: string
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
  musicTitle: string
  musicAuthor?: string
  musicImageUrl?: string
  onAudioClick?: () => void
  className?: string
}

export interface VideoInfoProps {
  username: string
  description?: string
  musicTitle?: string
  musicAuthor?: string
  onUsernameClick?: () => void
  onMusicClick?: () => void
  className?: string
}
