import { useParams, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { usePost, postId, useAccount } from '@lens-protocol/react'
import { useAuth } from '@/contexts/AuthContext'
import { VideoDetail } from '@/components/feed/VideoDetail'
import type { VideoPostData } from '@/components/feed/types'

/**
 * Converts lens:// URI to Grove storage URL
 * Handles formats like:
 * - lens://hash
 * - lens://hash:1 (Lens protocol version/ID)
 */
function lensToGroveUrl(lensUri: string): string {
  if (!lensUri) return ''
  const lower = lensUri.toLowerCase()
  if (!lower.startsWith('lens') && !lower.startsWith('glen')) return lensUri

  // Remove lens:// prefix and any trailing :number suffix
  const hash = lensUri
    .replace(/^(lens|glens?):\/\//i, '')
    .replace(/:\d+$/, '') // Strip trailing :1, :2, etc.

  return `https://api.grove.storage/${hash}`
}

/**
 * VideoDetailPage - Container for single video viewing
 *
 * Routes:
 * - /u/:username/video/:postId
 *
 * Features:
 * - Fetches single Lens post by ID
 * - Extracts encryption metadata from post attributes
 * - Checks if user owns Unlock subscription key
 * - Shows lock overlay for encrypted content without subscription
 */
export function VideoDetailPage() {
  const { username, postId: postIdParam } = useParams<{ username: string; postId: string }>()
  const navigate = useNavigate()
  const { isPKPReady, pkpAddress } = useAuth()

  // Fetch the specific post
  const {
    data: post,
    loading: postLoading,
    error: postError
  } = usePost({
    post: postIdParam ? postId(postIdParam) : undefined
  })

  // Fetch the account (for profile info)
  const {
    data: account,
    loading: accountLoading
  } = useAccount({
    username: username ? {
      localName: username.replace('@', '')
    } : undefined
  })

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS

  // Memoize encryption metadata extraction to prevent re-renders
  const { copyrightType, unlockLock, encryption, isPremium } = useMemo(() => {
    if (!post || post.metadata?.__typename !== 'VideoMetadata') {
      return { copyrightType: 'copyright-free', unlockLock: null, encryption: null, isPremium: false }
    }

    // Extract encryption metadata from post attributes
    const extractAttribute = (key: string): string | null => {
      const attr = post.metadata.attributes?.find(a => a.key === key)
      return attr?.value || null
    }

    const copyrightType = extractAttribute('copyright_type') || 'copyright-free'
    const unlockLock = extractAttribute('unlock_lock')
    const encryptionData = extractAttribute('encryption') // JSON string

    console.log('===== VideoDetailPage Debug =====')
    console.log('Post ID:', postIdParam)
    console.log('Copyright Type:', copyrightType)
    console.log('Has encryption data:', !!encryptionData)
    console.log('Unlock Lock:', unlockLock)

    // Parse encryption metadata if available
    let encryption = null
    if (encryptionData) {
      try {
        encryption = JSON.parse(encryptionData)
        console.log('Encryption metadata:', {
          hasKey: !!encryption.encryptedSymmetricKey,
          hasIV: !!encryption.iv,
          hasAuthTag: !!encryption.authTag,
          hasConditions: !!encryption.unifiedAccessControlConditions,
        })
      } catch (err) {
        console.error('Failed to parse encryption data:', err)
      }
    }

    // Determine if video is premium (encrypted)
    const isPremium = copyrightType === 'copyrighted' && !!encryption

    console.log('isPremium:', isPremium)
    console.log('Video URL:', post.metadata.video?.item || 'N/A')
    console.log('==================================\n')

    return { copyrightType, unlockLock, encryption, isPremium }
  }, [post, postIdParam])

  // Memoize video data to prevent re-renders
  const videoData = useMemo<VideoPostData | null>(() => {
    if (!post || post.metadata?.__typename !== 'VideoMetadata') {
      return null
    }

    const videoMetadata = post.metadata

    // Resolve lens:// URIs to Grove storage URLs
    const rawVideoUrl = videoMetadata.video?.item || ''
    const rawThumbnailUrl = videoMetadata.video?.cover || ''

    const videoUrl = lensToGroveUrl(rawVideoUrl)
    const thumbnailUrl = lensToGroveUrl(rawThumbnailUrl) || `https://picsum.photos/400/711?random=${post.id}`

    console.log('Resolved URLs:')
    console.log('  Raw video:', rawVideoUrl)
    console.log('  Resolved video:', videoUrl)
    console.log('  Raw thumbnail:', rawThumbnailUrl)
    console.log('  Resolved thumbnail:', thumbnailUrl)

    // TODO: Check if user owns Unlock subscription key
    const userIsSubscribed = false

    return {
      id: post.id,
      username: account?.username?.localName || username || 'user',
      userHandle: account?.metadata?.name || account?.username?.localName || 'User',
      userAvatar: account?.metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      description: videoMetadata.content || '',
      videoUrl,
      thumbnailUrl,
      isPremium,
      userIsSubscribed,
      likes: 0, // TODO: Add from post stats
      comments: 0, // TODO: Add from post stats
      shares: 0, // TODO: Add from post stats
      createdAt: post.timestamp,
    }
  }, [post, account, username, isPremium])

  // Memoize karaoke lines extraction
  const karaokeLines = useMemo(() => {
    if (!post || post.metadata?.__typename !== 'VideoMetadata') {
      return undefined
    }

    // Extract karaoke data from transcriptions if available
    const extractAttribute = (key: string): string | null => {
      const attr = post.metadata.attributes?.find(a => a.key === key)
      return attr?.value || null
    }

    const transcriptionsData = extractAttribute('transcriptions')
    if (!transcriptionsData) return undefined

    try {
      const transcriptions = JSON.parse(transcriptionsData)
      // For now, use English transcription
      // TODO: Add language selector
      const segments = transcriptions.languages?.en?.segments || []

      // Convert segments to KaraokeLine format
      return segments.map((segment: any) => ({
        text: segment.text,
        translation: segment.translation,
        start: segment.start,
        end: segment.end,
        words: segment.words?.map((word: any) => ({
          text: word.text,
          start: word.start,
          end: word.end,
        })),
      }))
    } catch (err) {
      console.error('Failed to parse transcriptions:', err)
      return undefined
    }
  }, [post])

  // NOW we can do conditional returns

  const isLoading = postLoading || accountLoading

  // Handle error state
  if (postError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Video not found</h2>
          <p className="text-gray-600 mb-4">
            This video may have been deleted or you don't have permission to view it.
          </p>
          <button
            onClick={() => navigate(`/u/${username}`)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Back to Profile
          </button>
        </div>
      </div>
    )
  }

  // Handle loading state
  if (isLoading || !post || !videoData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    )
  }

  // Check if it's actually a video post
  if (post.metadata?.__typename !== 'VideoMetadata') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Not a video post</h2>
          <p className="text-gray-600 mb-4">
            This post is not a video.
          </p>
          <button
            onClick={() => navigate(`/u/${username}`)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Back to Profile
          </button>
        </div>
      </div>
    )
  }

  return (
    <VideoDetail
      {...videoData}
      karaokeLines={karaokeLines}
      onClose={() => navigate(`/u/${username}`)}
      onFollowClick={() => {
        // TODO: Implement follow
        console.log('Follow user')
      }}
      onLikeClick={() => {
        // TODO: Implement like
        console.log('Like video')
      }}
      onCommentClick={() => {
        // TODO: Implement comment
        console.log('Comment on video')
      }}
      onShareClick={() => {
        // TODO: Implement share
        console.log('Share video')
      }}
      onProfileClick={() => navigate(`/u/${username}`)}
    />
  )
}
