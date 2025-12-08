/**
 * Shared transformers for converting Lens API data to app formats
 */

import type { VideoPostData } from '../../components/feed/types'
import { buildManifest, getBestUrl } from '../storage'

/**
 * Convert URI to best available URL using storage layer fallback
 * Returns empty string for null/undefined URIs (backwards compatible with convertGroveUri)
 */
function convertUri(uri: string | null | undefined): string {
  if (!uri) return ''
  const manifest = buildManifest(uri)
  return getBestUrl(manifest) ?? ''
}

// Known poster avatars - avoids subgraph calls for common accounts
const KNOWN_AVATARS: Record<string, string> = {
  'scarlett-ks': '/images/scarlett/default.webp',
  'violet-ks': '/images/violet/default.webp',
}

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

  // Convert lens:// URIs to storage URLs with multi-gateway fallback
  const videoUrl = convertUri(rawVideoUrl)
  const thumbnailUrl = convertUri(rawThumbnailUrl) ||
    `https://picsum.photos/400/711?random=${post.id}`

  // Extract avatar - use local assets for known posters, fallback to Lens metadata
  const username = post.author?.username?.localName
  let userAvatar = username ? KNOWN_AVATARS[username] : undefined
  if (!userAvatar) {
    const rawAvatar = post.author?.metadata?.picture
    const avatarUri = typeof rawAvatar === 'string'
      ? rawAvatar
      : rawAvatar?.optimized?.uri || rawAvatar?.raw?.uri
    userAvatar = convertUri(avatarUri) ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author?.address}`
  }

  const albumArt = getAttribute('album_art')
  const musicImageUrl = albumArt ? convertUri(albumArt) : undefined

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
    username: username || post.author?.address || 'unknown',
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
