/**
 * Shared transformers for converting Lens API data to app formats
 */

import type { Post, VideoMetadata } from '@lens-protocol/client'
import type { VideoPostData } from '@/components/feed/types'
import { convertGroveUri } from './utils'

const shouldLogTransformers = () => {
  if (!import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false
  const debugNamespaces = window.localStorage?.getItem('debug') || ''
  return debugNamespaces.split(',').map(ns => ns.trim()).includes('transformer')
}

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

  // Primary: slug-based routing (clean URLs like /eminem/lose-yourself)
  const artistSlug = getAttribute('artist_slug')
  const songSlug = getAttribute('song_slug')

  // Legacy identifiers (for backwards compatibility)
  const spotifyTrackId = getAttribute('spotify_track_id')
  const grc20WorkId = getAttribute('grc20_work_id')
  const tiktokVideoId = getAttribute('tiktok_video_id')

  // Extract karaoke lines from transcriptions attribute (stored as JSON)
  let karaokeLines
  const transcriptionsJson = getAttribute('transcriptions')

  if (transcriptionsJson) {
    try {
      const transcriptionsData = JSON.parse(transcriptionsJson)
      const englishData = transcriptionsData.languages?.en

      if (shouldLogTransformers()) {
        console.log('[Transformer] Transcriptions data for post:', {
          postId: post.id,
          tiktokVideoId,
          hasEnglish: !!englishData,
          segmentCount: englishData?.segments?.length || 0,
          firstSegment: englishData?.segments?.[0] ? {
            text: englishData.segments[0].text?.substring(0, 50),
            start: englishData.segments[0].start,
            end: englishData.segments[0].end
          } : null
        })
      }

      if (englishData?.segments) {
        // Get browser language for translation
        // Map browser language to supported translation languages
        const browserLang = navigator.language.toLowerCase()
        const langMap: Record<string, string> = {
          'zh-cn': 'zh',
          'zh': 'zh',
          'zh-tw': 'zh',
          'vi': 'vi',
          'vi-vn': 'vi',
          'id': 'id',
          'id-id': 'id'
        }

        // Get translation language (default to Mandarin for all unsupported languages including English)
        const translationLang = langMap[browserLang] || 'zh'
        const translationData = transcriptionsData.languages?.[translationLang]

        // Sort both English and translation segments by start time for proper alignment
        const sortedEnglishSegments = englishData.segments.sort((a: any, b: any) => a.start - b.start)
        const sortedTranslationSegments = (translationData?.segments || []).sort((a: any, b: any) => a.start - b.start)

        karaokeLines = sortedEnglishSegments.map((segment: any) => {
          // Remove audio event descriptions in parentheses (e.g., "(cheerful country music)")
          const cleanText = segment.text.replace(/\([^)]*\)\s*/g, '').trim()
          
          // Find the translation segment with the closest timing overlap
          const matchingTranslation = sortedTranslationSegments.find((tSeg: any) => {
            const overlap = Math.min(segment.end, tSeg.end) - Math.max(segment.start, tSeg.start)
            return overlap > 0 // At least some timing overlap
          })
          
          const cleanTranslation = matchingTranslation?.text?.replace(/[（(][^)）]*[)）]\s*/g, '').trim()

          return {
            text: cleanText,
            translation: cleanTranslation,
            start: segment.start,
            end: segment.end,
            words: segment.words?.map((word: any) => ({
              text: word.word || word.text,
              start: word.start,
              end: word.end,
            })),
          }
        })

        // Filter out empty lines (where parentheses removal left nothing)
        karaokeLines = karaokeLines.filter(line => line.text.length > 0)
      }
    } catch (err) {
      console.error('[Transformer] Failed to parse transcriptions:', err)
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

  // Get song/artist from attributes, with fallback to parsing title for legacy posts
  // Legacy format: "Song Name - Karaoke" or "Song Name"
  let musicTitle = getAttribute('song_name')
  let musicAuthor = getAttribute('artist_name')

  // Fallback: extract from title for legacy posts without attributes
  if (!musicTitle && video.title) {
    const titleMatch = video.title.match(/^(.+?)\s*-\s*Karaoke$/i)
    if (titleMatch) {
      musicTitle = titleMatch[1].trim()
    }
  }

  // Known song -> artist mapping for legacy posts without artist info
  // This ensures old posts can still link to song pages
  const KNOWN_SONGS: Record<string, string> = {
    'Lose Yourself': 'Eminem',
    'Naughty Girl': 'Beyoncé',
  }
  if (musicTitle && !musicAuthor && KNOWN_SONGS[musicTitle]) {
    musicAuthor = KNOWN_SONGS[musicTitle]
  }

  const result = {
    id: post.id,
    tiktokVideoId,
    videoUrl,
    thumbnailUrl,
    username: post.author.username?.localName || post.author.address,
    userAvatar,
    authorAddress: post.author.address,
    grade: getAttribute('grade'),
    description: video.content,
    musicTitle,
    musicAuthor,
    musicImageUrl,
    // Primary: slug-based routing
    artistSlug,
    songSlug,
    // Legacy identifiers
    geniusId,
    spotifyTrackId,
    grc20WorkId,
    createdAt: (post as any).createdAt,
    likes: post.stats?.upvotes ?? 0,
    comments: post.stats?.comments ?? 0,
    shares: post.stats?.reposts ?? 0,
    karaokeLines,
    isLiked,
    isFollowing: post.author.operations?.isFollowedByMe ?? false,
    canInteract: isAuthenticated,
  }

  return result
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
