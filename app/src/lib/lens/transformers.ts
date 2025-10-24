/**
 * Shared transformers for converting Lens API data to app formats
 */

import type { Post, VideoMetadata } from '@lens-protocol/client'
import type { VideoPostData } from '@/components/feed/types'
import { convertGroveUri } from './utils'

/**
 * Transform a Lens Post with VideoMetadata to VideoPostData format
 * Used by feed components to normalize Lens API responses
 */
export function transformLensPostToVideoData(
  post: Post & { metadata: VideoMetadata },
  options: {
    isLiked?: boolean
    isAuthenticated?: boolean
  } = {}
): VideoPostData {
  const { isLiked = false, isAuthenticated = false } = options
  const video = post.metadata

  // Extract metadata from attributes
  const getAttribute = (key: string) =>
    video.attributes?.find(a => a.key === key)?.value

  const geniusId = getAttribute('genius_id')
    ? Number(getAttribute('genius_id'))
    : undefined

  // Extract karaoke lines from transcriptions attribute (stored as JSON)
  let karaokeLines
  const transcriptionsJson = getAttribute('transcriptions')

  if (transcriptionsJson) {
    try {
      const transcriptionsData = JSON.parse(transcriptionsJson)
      const englishData = transcriptionsData.languages?.en

      if (englishData?.segments) {
        // Get browser language for translation
        // Default to Mandarin (zh) for any unsupported language (not English)
        const browserLang = navigator.language.toLowerCase()
        const langMap: Record<string, string> = {
          'en': 'en',
          'en-us': 'en',
          'zh-cn': 'zh',
          'zh': 'zh',
          'vi': 'vi',
          'vi-vn': 'vi'
        }
        const translationLang = langMap[browserLang] || 'zh' // ✨ Default to Mandarin
        const translationData = translationLang !== 'en'
          ? transcriptionsData.languages?.[translationLang]
          : null

        karaokeLines = englishData.segments.map((segment: any, index: number) => ({
          text: segment.text,
          translation: translationData?.segments?.[index]?.text,
          start: segment.start,
          end: segment.end,
          words: segment.words?.map((word: any) => ({
            text: word.word || word.text,
            start: word.start,
            end: word.end,
          })),
        }))
      }
    } catch (err) {
      console.warn('[Transformer] Failed to parse transcriptions:', err)
    }
  }

  // Extract video URLs - check both old and new Lens metadata structures
  const rawVideoUrl = video.video?.item
  const rawThumbnailUrl = video.video?.cover

  // Convert lens:// URIs to Grove storage URLs
  const videoUrl = convertGroveUri(rawVideoUrl)
  const thumbnailUrl = convertGroveUri(rawThumbnailUrl) ||
    `https://picsum.photos/400/711?random=${post.id}`

  // Extract avatar - handle both object and string formats
  const rawAvatar = post.author.metadata?.picture
  const avatarUri = typeof rawAvatar === 'string'
    ? rawAvatar
    : rawAvatar?.optimized?.uri || rawAvatar?.raw?.uri
  const userAvatar = convertGroveUri(avatarUri) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author.address}`

  const albumArt = getAttribute('album_art')
  const musicImageUrl = albumArt ? convertGroveUri(albumArt) : undefined

  return {
    id: post.id,
    videoUrl,
    thumbnailUrl,
    username: post.author.username?.localName || post.author.address,
    userAvatar,
    authorAddress: post.author.address,
    grade: getAttribute('grade'),
    description: video.content,
    musicTitle: getAttribute('song_name'),
    musicAuthor: getAttribute('artist_name'),
    musicImageUrl,
    geniusId,
    createdAt: (post as any).createdAt,
    likes: post.stats?.upvotes ?? 0,
    comments: post.stats?.comments ?? 0,
    shares: post.stats?.reposts ?? 0,
    karaokeLines,
    isLiked,
    isFollowing: post.author.operations?.isFollowedByMe ?? false,
    canInteract: isAuthenticated,
  }
}

/**
 * Batch transform multiple Lens posts
 */
export function transformLensPostsToVideoData(
  posts: Post[],
  likedPostsMap: Map<string, boolean>,
  isAuthenticated: boolean
): VideoPostData[] {
  return posts
    .filter((post): post is Post & { metadata: VideoMetadata } =>
      post.metadata?.__typename === 'VideoMetadata'
    )
    .map(post => transformLensPostToVideoData(post, {
      isLiked: likedPostsMap.get(post.id) ?? false,
      isAuthenticated,
    }))
}
