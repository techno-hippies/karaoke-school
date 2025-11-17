/**
 * Video Detail Page
 * TikTok-style video detail view with engagement UI
 * Mobile: Full-screen VideoPost, Desktop: Split layout with sidebar
 */

import { useMemo, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { usePost, useAccount } from '@lens-protocol/react'
import { VideoDetail } from '@/components/feed/VideoDetail'
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext'
import { convertGroveUri, parseVideoMetadata } from '@/lib/lens/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useAccountPosts } from '@/lib/lens/hooks/useAccountPosts'
import { useSongVideos } from '@/hooks/useSongVideos'
import { useFollow } from '@/hooks/useFollow'
import { useLike } from '@/hooks/useLike'

export function VideoDetailPage() {
  const { lenshandle, postId } = useParams<{ lenshandle: string; postId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { hasLensAccount } = useAuth()

  // Keep track of previous post data to prevent flash
  const prevPostRef = useRef<any>(null)

  // Detect context from query params
  const fromContext = searchParams.get('from')
  const songIdParam = searchParams.get('songId')
  const songId = songIdParam ? parseInt(songIdParam) : undefined

  // Fetch the account to get the address
  const { data: account } = useAccount({ username: { localName: lenshandle! } })

  // Fetch videos based on context
  // If from song page: fetch song videos, otherwise fetch all creator videos
  const { posts: allPosts } = useAccountPosts(account?.address)
  const { data: songVideos } = useSongVideos(fromContext === 'song' ? songId : undefined)

  // Use appropriate video list based on context
  const videoList = fromContext === 'song' && songVideos ? songVideos : allPosts

  // Fetch current post from Lens
  const { data: post, loading, error } = usePost({ post: postId! })

  // Fetch follow state
  const authorAddress = post?.author?.address || prevPostRef.current?.author?.address
  const { isFollowing, canFollow, follow: handleFollowAction, isLoading: isFollowLoading } = useFollow({
    targetAccountAddress: authorAddress || '',
  })

  // Fetch like state
  const { isLiked, canLike, like, unlike } = useLike({
    postId: postId || '',
  })

  // Store current post as previous when it changes
  useEffect(() => {
    if (post) {
      prevPostRef.current = post
    }
  }, [post])

  // Use current post if available, otherwise use previous post to prevent flash
  const displayPost = post || prevPostRef.current

  // Calculate current video index and total
  const { currentVideoIndex, totalVideos } = useMemo(() => {
    if (!videoList.length) return { currentVideoIndex: 0, totalVideos: 0 }

    const index = videoList.findIndex(v => v.id === postId)
    return {
      currentVideoIndex: index >= 0 ? index : 0,
      totalVideos: videoList.length,
    }
  }, [videoList, postId])

  // Navigation handlers - memoized to prevent unnecessary re-renders
  const handleNavigatePrevious = useCallback(() => {
    if (currentVideoIndex > 0) {
      const prevVideo = videoList[currentVideoIndex - 1]
      // Preserve query params when navigating
      const queryString = fromContext === 'song' ? `?from=song&songId=${songId}` : ''
      navigate(`/u/${lenshandle}/video/${prevVideo.id}${queryString}`)
    }
  }, [currentVideoIndex, videoList, fromContext, songId, lenshandle, navigate])

  const handleNavigateNext = useCallback(() => {
    if (currentVideoIndex < videoList.length - 1) {
      const nextVideo = videoList[currentVideoIndex + 1]
      // Preserve query params when navigating
      const queryString = fromContext === 'song' ? `?from=song&songId=${songId}` : ''
      navigate(`/u/${lenshandle}/video/${nextVideo.id}${queryString}`)
    }
  }, [currentVideoIndex, videoList, fromContext, songId, lenshandle, navigate])

  // Skip loading spinner - show content immediately with thumbnail
  // The VideoPlayer will handle loading state with thumbnail

  // Only show error if not loading - otherwise wait for data
  if (!loading && (error || !displayPost)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-4 px-4">
        <h1 className="text-xl font-bold">Video not found</h1>
        <p className="text-gray-400">This video may have been removed or doesn't exist</p>
        <button
          onClick={() => navigate(`/u/${lenshandle}`)}
          className="text-purple-500 hover:text-purple-400"
        >
          Back to profile
        </button>
      </div>
    )
  }

  // Still loading and no data - show nothing (will render when data arrives)
  if (loading && !displayPost) {
    return null
  }

  // Parse video metadata
  const isVideo = displayPost.metadata?.__typename === 'VideoMetadata'
  if (!isVideo) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-4">
        <h1 className="text-xl font-bold">Invalid post type</h1>
        <p className="text-gray-400">This post is not a video</p>
        <button
          onClick={() => navigate(`/u/${lenshandle}`)}
          className="text-purple-500 hover:text-purple-400"
        >
          Back to profile
        </button>
      </div>
    )
  }

  const videoMetadata = displayPost.metadata as any
  const videoUri = videoMetadata.video?.item
  const coverUri = videoMetadata.video?.cover
  const title = videoMetadata.title || 'Untitled'
  const rawContent = videoMetadata.content || ''

  // Parse custom attributes first (need for translations)
  const attributes = videoMetadata.attributes || []
  const metadata = parseVideoMetadata(attributes)

  // Get browser language for translations
  const browserLang = navigator.language.toLowerCase()
  const langMap: Record<string, string> = {
    'en': 'en',
    'en-us': 'en',
    'zh-cn': 'zh',
    'zh': 'zh',
    'vi': 'vi',
    'vi-vn': 'vi'
  }
  const userLang = langMap[browserLang] || 'zh' // Default to Mandarin

  // Get translated description if available
  let translatedContent = rawContent
  if (metadata.description_translations) {
    try {
      const translations = JSON.parse(metadata.description_translations)
      translatedContent = translations[userLang] || rawContent
    } catch (err) {
      console.warn('[VideoDetailPage] Failed to parse description translations:', err)
    }
  }

  // Clean up content: Remove copyright lines and duplicate song info
  const content = translatedContent
    .split('\n')
    .filter((line: string) => {
      const trimmed = line.trim()
      // Remove copyright lines
      if (trimmed.startsWith('📄 Copyright:')) return false
      // Remove duplicate song title lines (already shown in music section)
      if (trimmed.startsWith('🎵')) return false
      return true
    })
    .join('\n')
    .trim()

  const songName = metadata.song_name || 'Unknown Song'
  const artistName = metadata.artist_name || 'Unknown Artist'
  const geniusId = metadata.genius_id
  const grade = metadata.grade

  const videoUrl = videoUri ? convertGroveUri(videoUri) : ''
  const thumbnailUrl = coverUri ? convertGroveUri(coverUri) : ''

  // Extract karaoke lines from transcriptions attribute
  let karaokeLines
  const transcriptionsJson = metadata.transcriptions

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

        karaokeLines = englishData.segments.map((segment: any, index: number) => {
          const translation = translationData?.segments?.[index]?.text

          // If browser is not English and we have a translation, swap primary and translation
          // Show native language as primary, English as translation
          const shouldSwap = translationLang !== 'en' && translation

          return {
            text: shouldSwap ? translation : segment.text,
            translation: shouldSwap ? segment.text : translation,
            start: segment.start,
            end: segment.end,
            words: segment.words?.map((word: any) => ({
              text: word.word || word.text,
              start: word.start,
              end: word.end,
            })),
          }
        })
      }
    } catch (err) {
      console.warn('[VideoDetailPage] Failed to parse transcriptions:', err)
    }
  }

  // Get author info
  const author = displayPost.author
  const username = author?.handle?.localName || lenshandle || 'unknown'

  // Extract avatar URI - handle both ImageSet and direct URI
  let userAvatar: string | undefined
  const picture = author?.metadata?.picture
  if (picture) {
    if (typeof picture === 'string') {
      userAvatar = convertGroveUri(picture)
    } else if (picture.__typename === 'ImageSet') {
      const uri = picture.optimized?.uri || picture.raw?.uri
      userAvatar = uri ? convertGroveUri(uri) : undefined
    }
  }

  // Fallback to dicebear if no avatar
  if (!userAvatar && author?.address) {
    userAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${author.address}`
  }

  // Get stats
  const stats = displayPost.stats
  const likes = stats?.upvotes || 0
  const comments = stats?.comments || 0
  const shares = stats?.mirrors || 0

  // Format created date
  const createdAt = displayPost.createdAt ? new Date(displayPost.createdAt).toLocaleDateString() : undefined

  return (
    <VideoPlaybackProvider>
      <VideoDetail
        // Use displayPost?.id as key to delay remount until new data is ready
        // This keeps old video playing during load, preventing thumbnail flash
        key={displayPost?.id ?? postId}
        id={postId!}
        videoUrl={videoUrl}
        thumbnailUrl={thumbnailUrl}
        username={username}
        userHandle={author?.metadata?.displayName}
        userAvatar={userAvatar}
        authorAddress={author?.address}
        grade={grade}
        description={content || title}
        musicTitle={songName}
        musicAuthor={artistName}
        geniusId={geniusId ? Number(geniusId) : undefined}
        createdAt={createdAt}
        likes={likes}
        comments={comments}
        shares={shares}
        karaokeLines={karaokeLines}
        isLiked={isLiked}
        isFollowing={isFollowing}
        isFollowLoading={isFollowLoading}
        canInteract={hasLensAccount}
        commentsData={[]} // TODO: Fetch comments from Lens
        // Navigation
        currentVideoIndex={currentVideoIndex}
        totalVideos={totalVideos}
        onNavigatePrevious={handleNavigatePrevious}
        onNavigateNext={handleNavigateNext}
        // Handlers
        onClose={() => navigate(`/u/${lenshandle}`)}
        onLikeClick={async () => {
          if (canLike) {
            try {
              if (isLiked) {
                await unlike()
              } else {
                await like()
              }
            } catch (error) {
              console.error('[VideoDetailPage] Like action failed:', error)
            }
          }
        }}
        onCommentClick={() => {
          console.log('[VideoDetailPage] Comment clicked')
        }}
        onShareClick={() => {
          console.log('[VideoDetailPage] Share clicked')
          // TODO: Implement Lens mirror
        }}
        onFollowClick={async () => {
          if (canFollow) {
            try {
              await handleFollowAction()
            } catch (error) {
              console.error('[VideoDetailPage] Follow action failed:', error)
            }
          }
        }}
        onProfileClick={() => navigate(`/u/${username}`)}
        onAudioClick={geniusId ? () => navigate(`/song/${geniusId}`) : undefined}
        onSubmitComment={async (commentContent: string) => {
          console.log('[VideoDetailPage] Submit comment:', commentContent)
          // TODO: Implement Lens comment
          return true
        }}
        onLikeComment={(commentId: string) => {
          console.log('[VideoDetailPage] Like comment:', commentId)
          // TODO: Implement Lens comment reaction
        }}
      />
    </VideoPlaybackProvider>
  )
}
