/**
 * Video Detail Page
 * TikTok-style video detail view with engagement UI
 * Mobile: Full-screen VideoPost, Desktop: Split layout with sidebar
 */

import { useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePost, useAccount } from '@lens-protocol/react'
import { Spinner } from '@/components/ui/spinner'
import { VideoDetail } from '@/components/feed/VideoDetail'
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext'
import { convertGroveUri, parseVideoMetadata } from '@/lib/lens/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useAccountPosts } from '@/lib/lens/hooks/useAccountPosts'

export function VideoDetailPage() {
  const { lenshandle, postId } = useParams<{ lenshandle: string; postId: string }>()
  const navigate = useNavigate()
  const { hasLensAccount } = useAuth()

  // Keep track of previous post data to prevent flash
  const prevPostRef = useRef<any>(null)

  // Fetch the account to get the address
  const { data: account } = useAccount({ username: { localName: lenshandle! } })

  // Fetch all posts from this creator for navigation
  const { posts: allPosts } = useAccountPosts(account?.address)

  // Fetch current post from Lens
  const { data: post, loading, error } = usePost({ post: postId! })

  // Store current post as previous when it changes
  useEffect(() => {
    if (post) {
      prevPostRef.current = post
    }
  }, [post])

  // Use current post if available, otherwise use previous post to prevent flash
  const displayPost = post || prevPostRef.current

  console.log('[VideoDetailPage] Post data:', { post, loading, error, displayPost })

  // Calculate current video index and total
  const { currentVideoIndex, totalVideos } = useMemo(() => {
    if (!allPosts.length) return { currentVideoIndex: 0, totalVideos: 0 }

    const index = allPosts.findIndex(p => p.id === postId)
    return {
      currentVideoIndex: index >= 0 ? index : 0,
      totalVideos: allPosts.length,
    }
  }, [allPosts, postId])

  // Navigation handlers
  const handleNavigatePrevious = () => {
    if (currentVideoIndex > 0) {
      const prevPost = allPosts[currentVideoIndex - 1]
      navigate(`/u/${lenshandle}/video/${prevPost.id}`)
    }
  }

  const handleNavigateNext = () => {
    if (currentVideoIndex < allPosts.length - 1) {
      const nextPost = allPosts[currentVideoIndex + 1]
      navigate(`/u/${lenshandle}/video/${nextPost.id}`)
    }
  }

  // Only show loading on initial load, not on navigation
  if (loading && !prevPostRef.current) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <Spinner size="lg" className="text-white" />
      </div>
    )
  }

  if (error || !displayPost) {
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
  const content = videoMetadata.content || ''

  // Parse custom attributes
  const attributes = videoMetadata.attributes || []
  const metadata = parseVideoMetadata(attributes)

  const songName = metadata.songName || 'Unknown Song'
  const artistName = metadata.artistName || 'Unknown Artist'
  const geniusId = metadata.geniusId
  const grade = metadata.grade

  const videoUrl = videoUri ? convertGroveUri(videoUri) : ''
  const thumbnailUrl = coverUri ? convertGroveUri(coverUri) : ''

  // Get author info
  const author = displayPost.author
  const username = author?.handle?.localName || lenshandle || 'unknown'
  const userAvatar = author?.metadata?.picture?.__typename === 'ImageSet'
    ? author.metadata.picture.optimized?.uri
    : undefined

  // Get stats
  const stats = displayPost.stats
  const likes = stats?.reactions || 0
  const comments = stats?.comments || 0
  const shares = stats?.mirrors || 0

  // Format created date
  const createdAt = displayPost.createdAt ? new Date(displayPost.createdAt).toLocaleDateString() : undefined

  console.log('[VideoDetailPage] Rendering with key:', displayPost?.id ?? postId)

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
        isLiked={false} // TODO: Get from Lens reactions
        isFollowing={false} // TODO: Get from Lens following
        canInteract={hasLensAccount}
        commentsData={[]} // TODO: Fetch comments from Lens
        // Navigation
        currentVideoIndex={currentVideoIndex}
        totalVideos={totalVideos}
        onNavigatePrevious={handleNavigatePrevious}
        onNavigateNext={handleNavigateNext}
        // Handlers
        onClose={() => navigate(`/u/${lenshandle}`)}
        onLikeClick={() => {
          console.log('[VideoDetailPage] Like clicked')
          // TODO: Implement Lens reaction
        }}
        onCommentClick={() => {
          console.log('[VideoDetailPage] Comment clicked')
        }}
        onShareClick={() => {
          console.log('[VideoDetailPage] Share clicked')
          // TODO: Implement Lens mirror
        }}
        onFollowClick={() => {
          console.log('[VideoDetailPage] Follow clicked')
          // TODO: Implement Lens follow
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
