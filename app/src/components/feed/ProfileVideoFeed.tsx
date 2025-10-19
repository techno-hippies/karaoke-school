import { useState, useEffect } from 'react'
import { usePosts, evmAddress } from '@lens-protocol/react'
import { APP_ADDRESS } from '@/lens/config'
import { lensToGroveUrl } from '@/lib/lens/utils'
import type { VideoPostData } from './types'
import type { Post, VideoMetadata } from '@lens-protocol/client'

export interface ProfileVideoFeedProps {
  accountAddress: string
  children: (posts: VideoPostData[], isLoading: boolean, hasMore: boolean, loadMore: () => void) => React.ReactNode
}

/**
 * ProfileVideoFeed - Fetches paginated posts for a specific account
 * Used for mobile video detail view with infinite scroll
 */
export function ProfileVideoFeed({ accountAddress, children }: ProfileVideoFeedProps) {
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allPosts, setAllPosts] = useState<VideoPostData[]>([])

  // Fetch posts with pagination
  const { data: postsData, loading } = usePosts({
    filter: {
      authors: [evmAddress(accountAddress)],
      apps: [evmAddress(APP_ADDRESS)]
    },
    cursor,
  })

  // Transform and append posts when data changes
  useEffect(() => {
    if (postsData?.items) {
      // Transform Lens posts to VideoPostData format
      const videoPosts: VideoPostData[] = postsData.items
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
              console.warn('[ProfileVideoFeed] Failed to parse transcriptions:', err)
            }
          }

          // Extract video URL
          const rawVideoUrl = video.video?.item || video.video?.optimized?.uri || video.video?.raw?.uri
          const rawThumbnailUrl = video.video?.cover

          // Convert lens:// URIs to Grove storage URLs
          const videoUrl = lensToGroveUrl(rawVideoUrl)
          const thumbnailUrl = lensToGroveUrl(rawThumbnailUrl) || `https://picsum.photos/400/711?random=${post.id}`

          console.log('[ProfileVideoFeed] Post:', {
            id: post.id,
            username: post.author.username?.localName,
            videoUrl,
            thumbnailUrl,
            copyrightType,
            isEncrypted
          })

          return {
            id: post.id,
            videoUrl,
            thumbnailUrl,
            username: post.author.username?.localName || post.author.address,
            userAvatar: post.author.metadata?.picture?.optimized?.uri,
            authorAddress: post.author.address,
            grade,
            description: video.content,
            musicTitle: songNameAttr?.value,
            musicAuthor: artistNameAttr?.value,
            musicImageUrl: albumArtAttr?.value,
            geniusId,
            createdAt: post.createdAt,
            likes: post.stats?.upvotes ?? 0,
            comments: post.stats?.comments ?? 0,
            shares: post.stats?.reposts ?? 0,
            karaokeLines,
            isLiked: false,
            isFollowing: false,
            canInteract: false,
          }
        })

      // Append to existing posts (or replace if no cursor = initial load)
      setAllPosts(prev => cursor ? [...prev, ...videoPosts] : videoPosts)

      console.log('[ProfileVideoFeed] Loaded posts:', {
        newCount: videoPosts.length,
        totalCount: cursor ? allPosts.length + videoPosts.length : videoPosts.length,
        hasMore: !!postsData.pageInfo?.next
      })
    }
  }, [postsData?.items, cursor])

  // Load more function
  const loadMore = () => {
    if (postsData?.pageInfo?.next && !loading) {
      console.log('[ProfileVideoFeed] Loading more with cursor:', postsData.pageInfo.next)
      setCursor(postsData.pageInfo.next)
    }
  }

  const hasMore = !!postsData?.pageInfo?.next

  return <>{children(allPosts, loading, hasMore, loadMore)}</>
}
