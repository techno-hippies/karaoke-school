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
  tiktokVideoId?: string // TikTok video ID for querying STT transcriptions
  videoUrl?: string
  thumbnailUrl?: string
  username: string
  userHandle?: string // Display name (e.g., "Professional Vocalist")
  userAvatar?: string
  authorAddress?: string // Lens account address for follow operations
  grade?: string // Performance grade (A, B+, C, etc)
  description?: string // Post description/caption
  musicTitle?: string
  musicAuthor?: string
  musicImageUrl?: string
  // Primary: slug-based routing (e.g., /eminem/lose-yourself)
  artistSlug?: string
  songSlug?: string
  // Identifiers
  spotifyTrackId?: string
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
  isFollowLoading?: boolean
  canInteract?: boolean // Can like/comment/follow
}

export interface VideoPlayerProps {
  videoUrl?: string
  thumbnailUrl?: string
  isPlaying: boolean
  isMuted: boolean
  onTogglePlay: () => void
  onPlayFailed?: () => void // Called when autoplay fails
  onTimeUpdate?: (currentTime: number) => void // Called on video timeupdate for karaoke sync
  forceShowThumbnail?: boolean // Keep thumbnail visible even when playing (for locked videos)
  forceAutoplay?: boolean // Hide thumbnail on first render for video navigation (prevents flash)
  captionTracks?: CaptionTrack[] // WebVTT caption tracks
  className?: string
  priorityLoad?: boolean // If true, load immediately without debounce (for first/priority videos)
}

export interface CaptionTrack {
  src: string // WebVTT file URL or data URL
  srclang: string // Language code (e.g., 'en', 'zh', 'vi')
  label: string // Display name (e.g., 'English', '中文', 'Tiếng Việt')
  default?: boolean // Whether this track is default
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
  isFollowLoading?: boolean
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
