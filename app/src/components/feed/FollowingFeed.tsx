import { evmAddress } from '@lens-protocol/react'
import { useEffect, useState } from 'react'
import { fetchTimeline } from '@lens-protocol/client/actions'
import { APP_ADDRESS } from '@/lens/config'
import { lensToGroveUrl } from '@/lib/lens/utils'
import { useAuth } from '@/contexts/AuthContext'
import { batchCheckLikedPosts } from '@/lib/lens/reactions'
import type { VideoPostData } from './types'
import type { Post, VideoMetadata } from '@lens-protocol/client'

export interface FollowingFeedProps {
  children: (posts: VideoPostData[], isLoading: boolean, error: string | null) => React.ReactNode
}

/**
 * FollowingFeed - Fetches posts from accounts the user follows using Lens timeline
 * Uses timeline API for personalized feed based on social graph
 *
 * Requirements:
 * - User must be authenticated
 * - Returns posts from followed accounts only
 * - Includes both copyright-free and copyrighted content
 */
export function FollowingFeed({ children }: FollowingFeedProps) {
  const { lensSession, lensAccount } = useAuth()
  const [videoPosts, setVideoPosts] = useState<VideoPostData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [likedPostsMap, setLikedPostsMap] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    async function loadTimeline() {
      // Require authentication
      if (!lensSession || !lensAccount?.address) {
        setError('Please sign in to see your Following feed')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        console.log('[FollowingFeed] Fetching timeline for account:', lensAccount.address)

        // Fetch timeline using authenticated session client
        const result = await fetchTimeline(lensSession, {
          account: evmAddress(lensAccount.address),
          filter: {
            feeds: [{ globalFeed: true }],
            apps: [evmAddress(APP_ADDRESS)],
            metadata: {
              tags: { all: ['karaoke'] } // Include all karaoke content
            }
          }
        })

        if (result.isErr()) {
          console.error('[FollowingFeed] Timeline fetch error:', result.error)
          setError('Failed to load your Following feed')
          setLoading(false)
          return
        }

        const { items } = result.value

        console.log('[FollowingFeed] Timeline items:', items.length)

        // Extract posts from timeline items
        const timelinePosts = items
          .map(item => item.primary)
          .filter((post): post is Post => post.metadata?.__typename === 'VideoMetadata')

        // Batch check which posts are liked by the current user
        let likedMap = new Map<string, boolean>()
        if (lensAccount?.address) {
          try {
            likedMap = await batchCheckLikedPosts(lensSession, timelinePosts, lensAccount.address)
            setLikedPostsMap(likedMap)
          } catch (error) {
            console.error('[FollowingFeed] Error checking liked posts:', error)
          }
        }

        // Transform timeline items to VideoPostData
        // Timeline items have structure: { id, primary: Post, comments: Post[], reposts: Repost[] }
        const posts: VideoPostData[] = items
          .map(item => item.primary) // Extract the primary post
          .filter((post): post is Post & { metadata: VideoMetadata } =>
            post.metadata?.__typename === 'VideoMetadata'
          )
          .map(post => {
            const video = post.metadata as VideoMetadata

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
                console.warn('[FollowingFeed] Failed to parse transcriptions:', err)
              }
            }

            // Extract video URL
            const rawVideoUrl = video.video?.item || video.video?.optimized?.uri || video.video?.raw?.uri
            const rawThumbnailUrl = video.video?.cover

            // Convert lens:// URIs to Grove storage URLs
            const videoUrl = lensToGroveUrl(rawVideoUrl)
            const thumbnailUrl = lensToGroveUrl(rawThumbnailUrl) || `https://picsum.photos/400/711?random=${post.id}`

            // Extract avatar
            const rawAvatar = post.author.metadata?.picture
            const avatarUri = typeof rawAvatar === 'string'
              ? rawAvatar
              : rawAvatar?.optimized?.uri || rawAvatar?.raw?.uri
            const userAvatar = lensToGroveUrl(avatarUri) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author.address}`

            // Check follow status
            const isFollowedByMe = post.author.operations?.isFollowedByMe ?? true // Default to true for Following feed

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
              isLiked: likedMap.get(post.id) ?? false, // Check from reaction status
              isFollowing: isFollowedByMe, // Check from operations field
              canInteract: true, // User is authenticated
            }
          })

        console.log('[FollowingFeed] Transformed posts:', posts.length)
        setVideoPosts(posts)
        setLoading(false)

      } catch (err) {
        console.error('[FollowingFeed] Error loading timeline:', err)
        setError('Something went wrong loading your feed')
        setLoading(false)
      }
    }

    loadTimeline()
  }, [lensSession, lensAccount?.address])

  return <>{children(videoPosts, loading, error)}</>
}
