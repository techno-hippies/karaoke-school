/**
 * Shared types for feed/video components
 */

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
  isSung?: boolean
}

export interface VideoPostData {
  id: string
  videoUrl?: string
  thumbnailUrl?: string
  username: string
  userHandle?: string
  userAvatar?: string
  authorAddress?: string
  grade?: string
  description?: string
  musicTitle?: string
  musicAuthor?: string
  musicImageUrl?: string
  artistSlug?: string
  songSlug?: string
  spotifyTrackId?: string
  createdAt?: string
  likes: number
  shares: number
  karaokeLines?: KaraokeLine[]
  isLiked?: boolean
  canInteract?: boolean
}

export interface VideoPlayerProps {
  videoUrl?: string
  thumbnailUrl?: string
  isPlaying: boolean
  isMuted: boolean
  onTogglePlay: () => void
  onPlayFailed?: () => void
  onTimeUpdate?: (currentTime: number) => void
  class?: string
  priorityLoad?: boolean
}

export interface KaraokeOverlayProps {
  lines?: KaraokeLine[]
  currentTime: number
  class?: string
  showNextLine?: boolean
}

export interface VideoActionsProps {
  userAvatar?: string
  username: string
  onProfileClick: () => void
  isLiked: boolean
  onLikeClick: () => void
  onShareClick: () => void
  canStudy?: boolean
  onStudyClick?: () => void
  musicTitle?: string
  musicAuthor?: string
  musicImageUrl?: string
  onAudioClick?: () => void
  isMuted: boolean
  onToggleMute: () => void
  class?: string
}

export interface VideoInfoProps {
  username: string
  musicTitle?: string
  musicAuthor?: string
  onUsernameClick?: () => void
  onMusicClick?: () => void
  class?: string
}
