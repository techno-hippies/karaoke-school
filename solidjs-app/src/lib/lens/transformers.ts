/**
 * Shared transformers for converting Lens API data to app formats
 */

import type { VideoPostData } from '../../components/feed/types'
import { convertGroveUri } from './utils'

/**
 * Transform a Lens Post with VideoMetadata to VideoPostData format
 * Used by feed components to normalize Lens API responses
 */
export function transformLensPostToVideoData(
  post: any,
  options: {
    isLiked?: boolean
    isAuthenticated?: boolean
  } = {}
): VideoPostData {
  const { isLiked = false, isAuthenticated = false } = options
  const video = post.metadata

  // Extract metadata from attributes
  const getAttribute = (key: string) =>
    video?.attributes?.find((a: any) => a.key === key)?.value

  // Primary: slug-based routing (clean URLs like /eminem/lose-yourself)
  const artistSlug = getAttribute('artist_slug')
  const spotifyTrackId = getAttribute('spotify_track_id')

  // Get song slug - fallback to generating from song_name if not set
  let songSlug = getAttribute('song_slug')
  if (!songSlug) {
    const songName = getAttribute('song_name')
    if (songName) {
      // Generate slug from song name: "Toxic" -> "toxic", "Lose Yourself" -> "lose-yourself"
      songSlug = songName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }
  }

  // Extract video URLs - check both old and new Lens metadata structures
  const rawVideoUrl = video?.video?.item
  const rawThumbnailUrl = video?.video?.cover

  // Convert lens:// URIs to Grove storage URLs
  const videoUrl = convertGroveUri(rawVideoUrl)
  const thumbnailUrl = convertGroveUri(rawThumbnailUrl) ||
    `https://picsum.photos/400/711?random=${post.id}`

  // Extract avatar - handle both object and string formats
  const rawAvatar = post.author?.metadata?.picture
  const avatarUri = typeof rawAvatar === 'string'
    ? rawAvatar
    : rawAvatar?.optimized?.uri || rawAvatar?.raw?.uri
  const userAvatar = convertGroveUri(avatarUri) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author?.address}`

  const albumArt = getAttribute('album_art')
  const musicImageUrl = albumArt ? convertGroveUri(albumArt) : undefined

  // Get song/artist from attributes, with fallback to parsing title for legacy posts
  let musicTitle = getAttribute('song_name')
  let musicAuthor = getAttribute('artist_name')

  // Fallback: extract from title for legacy posts without attributes
  if (!musicTitle && video?.title) {
    const titleMatch = video.title.match(/^(.+?)\s*-\s*Karaoke$/i)
    if (titleMatch) {
      musicTitle = titleMatch[1].trim()
    }
  }

  return {
    id: post.id,
    videoUrl,
    thumbnailUrl,
    username: post.author?.username?.localName || post.author?.address || 'unknown',
    userAvatar,
    authorAddress: post.author?.address,
    grade: getAttribute('grade'),
    description: video?.content,
    musicTitle,
    musicAuthor,
    musicImageUrl,
    artistSlug,
    songSlug,
    spotifyTrackId,
    createdAt: post.createdAt,
    likes: post.stats?.upvotes ?? 0,
    shares: post.stats?.reposts ?? 0,
    isLiked,
    isFollowing: post.author?.operations?.isFollowedByMe ?? false,
    canInteract: isAuthenticated,
  }
}

/**
 * Batch transform multiple Lens posts
 */
export function transformLensPostsToVideoData(
  posts: any[],
  likedPostsMap: Map<string, boolean>,
  isAuthenticated: boolean
): VideoPostData[] {
  return posts
    .filter((post) => post.metadata?.__typename === 'VideoMetadata')
    .map(post => transformLensPostToVideoData(post, {
      isLiked: likedPostsMap.get(post.id) ?? false,
      isAuthenticated,
    }))
}
