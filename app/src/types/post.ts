/**
 * Lens post/video types
 */

export interface Post {
  id: string
  author: {
    address: string
    username: string
    displayName?: string
    avatarUrl?: string
  }
  content: {
    text?: string
    videoUrl?: string
    thumbnailUrl?: string
    aspectRatio?: number
  }
  metadata: {
    geniusId?: number
    geniusArtistId?: number
    songId?: string
    segmentId?: string
    language?: string
  }
  stats: {
    likes: number
    comments: number
    shares: number
  }
  createdAt: string
  isLiked?: boolean
}

export interface VideoPost extends Post {
  content: Post['content'] & {
    videoUrl: string
  }
}
