/**
 * Creator Profile Page Container
 * Fetches and displays a creator's Lens profile with videos, songs, and stats
 */

import { useParams, useNavigate } from 'react-router-dom'
import { ArtistPage, type ArtistSong } from '@/components/profile/ArtistPage'
import type { VideoPost } from '@/components/video/VideoGrid'
import { useLensCreator, isVideoPost, isVerifiedAccount } from '@/hooks/useLensCreator'
import type { Post } from '@/hooks/useLensCreator'
import { Spinner } from '@/components/ui/spinner'
import {
  convertGroveUri,
  parseVideoMetadata,
} from '@/lib/lens/utils'

export function CreatorPageContainer() {
  const { lenshandle } = useParams<{ lenshandle: string }>()
  const navigate = useNavigate()

  // Fetch account and posts from Lens
  const {
    account,
    posts,
    isLoadingAccount,
    accountError,
    postsError,
  } = useLensCreator(lenshandle)

  // Loading state
  if (isLoadingAccount) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error state: Account fetch failed
  if (accountError) {
    console.error('[CreatorPage] Account fetch error:', accountError)
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl font-bold text-center">Error loading creator</h1>
        <p className="text-muted-foreground text-center">
          Failed to load creator data
        </p>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          Go home
        </button>
      </div>
    )
  }

  // Error state: No account found
  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl font-bold text-center">Creator not found</h1>
        <p className="text-muted-foreground text-center">
          No creator found with handle @{lenshandle}
        </p>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          Go home
        </button>
      </div>
    )
  }

  // Parse account metadata
  const displayName = account.metadata?.name || lenshandle || 'Unknown Creator'
  const avatarUrl = account.metadata?.picture
    ? convertGroveUri(account.metadata.picture)
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.address}`

  // Check verification status using account score
  const verified = isVerifiedAccount(account)

  // Parse posts data
  const postItems = posts?.items || []

  // Transform posts to VideoPost format
  const videos: VideoPost[] = postItems
    .filter((post): post is Post => post.__typename === 'Post' && isVideoPost(post))
    .map((post) => {
      const hasAttributes = post.metadata?.__typename === 'VideoMetadata'
      const metadata = hasAttributes && 'attributes' in post.metadata ? parseVideoMetadata(post.metadata.attributes) : {}

      // Prioritize thumbnail URI from attributes, fallback to placeholder
      const thumbnailUrl = metadata.thumbnailUri
        ? convertGroveUri(metadata.thumbnailUri)
        : 'https://placehold.co/400x711/8b5cf6/ffffff?text=Video'

      return {
        id: post.id,
        thumbnailUrl,
        username: lenshandle || '',
      }
    })

  // Parse unique songs from video metadata
  const songsMap = new Map<string, ArtistSong>()

  postItems
    .filter((post): post is Post => post.__typename === 'Post' && isVideoPost(post))
    .forEach((post) => {
      const hasAttributes = post.metadata?.__typename === 'VideoMetadata'
      const metadata = hasAttributes && 'attributes' in post.metadata ? parseVideoMetadata(post.metadata.attributes) : {}
      const geniusId = metadata.geniusId

      // Skip if no geniusId or already added
      if (!geniusId || songsMap.has(geniusId)) return

      const songTitle = metadata.songTitle || 'Untitled'
      const songArtist = metadata.songArtist || 'Unknown Artist'

      songsMap.set(geniusId, {
        id: geniusId,
        title: songTitle,
        artist: songArtist,
        artworkUrl: undefined, // TODO: Fetch from Genius API or extract from metadata
        onSongClick: () => navigate(`/song/${geniusId}`),
      })
    })

  const songs = Array.from(songsMap.values())

  // Handle video click - navigate to video detail page
  const handleVideoClick = (video: VideoPost) => {
    navigate(`/u/${lenshandle}/video/${video.id}`)
  }

  // Handle follow action
  const handleFollow = () => {
    // TODO: Implement follow using Lens SDK
    // Requires authenticated SessionClient
    console.log('[CreatorPage] Follow clicked for:', account.address)
  }

  // Log errors for posts if any
  if (postsError) {
    console.error('[CreatorPage] Posts fetch error:', postsError)
  }

  return (
    <ArtistPage
      username={lenshandle || ''}
      displayName={displayName}
      avatarUrl={avatarUrl}
      isVerified={verified}
      isOwnProfile={false} // TODO: Check if current user matches creator
      following={0}
      followers={0}
      isFollowing={false} // TODO: Query follow status from Lens
      isFollowLoading={false}
      videos={videos}
      onVideoClick={handleVideoClick}
      songs={songs}
      onBack={() => navigate(-1)}
      onFollow={handleFollow}
    />
  )
}
