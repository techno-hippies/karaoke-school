import { usePosts, evmAddress } from '@lens-protocol/react'
import { APP_ADDRESS } from '@/lens/config'
import { lensToGroveUrl } from '@/lib/lens/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { VideoPostData } from './types'
import type { Post, VideoMetadata } from '@lens-protocol/client'

export interface ForYouFeedProps {
  children: (posts: VideoPostData[], isLoading: boolean) => React.ReactNode
}

/**
 * ForYouFeed - Fetches copyright-free karaoke posts for the global feed
 * Uses tag-based filtering for efficient server-side filtering
 */
export function ForYouFeed({ children }: ForYouFeedProps) {
  const { lensSession } = useAuth()
  const isAuthenticated = !!lensSession

  const { data: postsData, loading } = usePosts({
    filter: {
      apps: [evmAddress(APP_ADDRESS)],
      feeds: [{ globalFeed: true }],
      metadata: {
        tags: { all: ['copyright-free'] } // Only copyright-free content in For You feed
      }
    },
  })

  // Transform Lens posts to VideoPostData format
  const videoPosts: VideoPostData[] = (postsData?.items ?? [])
    .filter((post): post is Post & { metadata: VideoMetadata } =>
      post.metadata?.__typename === 'VideoMetadata'
    )
    .map(post => {
      const video = post.metadata as VideoMetadata
      const copyrightType = post.metadata.tags?.includes('copyrighted') ? 'copyrighted' : 'copyright-free'
      const isEncrypted = post.metadata.tags?.includes('encrypted') ?? false

      // Extract metadata from attributes
      const geniusIdAttr = video.attributes?.find(a => a.key === 'genius_id')
      const geniusId = geniusIdAttr?.value ? Number(geniusIdAttr.value) : undefined

      const gradeAttr = video.attributes?.find(a => a.key === 'grade')
      const grade = gradeAttr?.value

      // Extract music info
      const songNameAttr = video.attributes?.find(a => a.key === 'song_name')
      const artistNameAttr = video.attributes?.find(a => a.key === 'artist_name')
      const albumArtAttr = video.attributes?.find(a => a.key === 'album_art')

      // Extract karaoke lines from transcriptions attribute (stored as JSON)
      const transcriptionsAttr = video.attributes?.find(a => a.key === 'transcriptions')
      let karaokeLines

      if (transcriptionsAttr?.value) {
        try {
          const transcriptionsData = JSON.parse(transcriptionsAttr.value)

          // Always use English for main text (word-level highlighting)
          const englishData = transcriptionsData.languages?.en

          if (englishData?.segments) {
            // Get browser language for translation
            const browserLang = navigator.language.toLowerCase()
            const langMap: Record<string, string> = {
              'en': 'en',
              'en-us': 'en',
              'zh-cn': 'zh',
              'zh': 'zh',
              'vi': 'vi',
              'vi-vn': 'vi'
            }
            const translationLang = langMap[browserLang] || 'en'
            const translationData = translationLang !== 'en'
              ? transcriptionsData.languages?.[translationLang]
              : null

            karaokeLines = englishData.segments.map((segment: any, index: number) => ({
              text: segment.text,
              translation: translationData?.segments?.[index]?.text || undefined,
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
          console.warn('[ForYouFeed] Failed to parse transcriptions:', err)
        }
      }

      // Extract video URL - check both old and new Lens metadata structures
      const rawVideoUrl = video.video?.item || video.video?.optimized?.uri || video.video?.raw?.uri
      const rawThumbnailUrl = video.video?.cover

      // Convert lens:// URIs to Grove storage URLs
      const videoUrl = lensToGroveUrl(rawVideoUrl)
      const thumbnailUrl = lensToGroveUrl(rawThumbnailUrl) || `https://picsum.photos/400/711?random=${post.id}`

      // Extract avatar - handle both object and string formats
      const rawAvatar = post.author.metadata?.picture
      const avatarUri = typeof rawAvatar === 'string'
        ? rawAvatar
        : rawAvatar?.optimized?.uri || rawAvatar?.raw?.uri
      const userAvatar = lensToGroveUrl(avatarUri) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author.address}`

      // Check follow status
      const isFollowedByMe = post.author.operations?.isFollowedByMe ?? false

      return {
        id: post.id,
        videoUrl,
        thumbnailUrl,
        username: post.author.username?.localName || post.author.address,
        userAvatar,
        authorAddress: post.author.address, // Store author address for follow operations
        grade,
        description: video.content,
        musicTitle: songNameAttr?.value,
        musicAuthor: artistNameAttr?.value,
        musicImageUrl: albumArtAttr?.value,
        geniusId,
        createdAt: post.createdAt,
        likes: post.stats?.reactions ?? 0,
        comments: post.stats?.comments ?? 0,
        shares: post.stats?.reposts ?? 0,
        karaokeLines,
        isLiked: false, // TODO: Check if current user has liked
        isFollowing: isFollowedByMe, // Check follow status from operations field
        canInteract: isAuthenticated, // Enable interactions when user is signed in
        isPremium: copyrightType === 'copyrighted',
        userIsSubscribed: false, // Always false for copyright-free feed
        isSubscribing: false,
        isSubscriptionLoading: false,
        // Encrypted video data (not needed for copyright-free feed)
        encryption: undefined,
        hlsMetadata: undefined,
        pkpInfo: undefined,
        authData: undefined,
      }
    })

  return <>{children(videoPosts, loading)}</>
}
