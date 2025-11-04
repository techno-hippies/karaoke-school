/**
 * Creator Profile Page Container
 * Fetches and displays a creator's Lens profile with videos, songs, and stats
 */

import { useParams, useNavigate } from 'react-router-dom'
import { ArtistPage, type ArtistSong } from '@/components/profile/ArtistPage'
import type { VideoPost } from '@/components/video/VideoGrid'
import { useLensCreator, isVideoPost } from '@/hooks/useLensCreator'
import type { Post } from '@/hooks/useLensCreator'
import { useGroveAccountMetadata } from '@/hooks/useGroveAccountMetadata'
import { useArtistSongsByLensHandle } from '@/hooks/useArtistSongsByLensHandle'
import { useFollow } from '@/hooks/useFollow'
import { useFollowers } from '@/hooks/useFollowers'
import { useFollowing } from '@/hooks/useFollowing'
import { Spinner } from '@/components/ui/spinner'
import {
  convertGroveUri,
  parseVideoMetadata,
} from '@/lib/lens/utils'

export function CreatorPageContainer() {
  const { lenshandle } = useParams<{ lenshandle: string }>()
  const navigate = useNavigate()

  // Fetch account and posts from Lens (using global lens/* namespace)
  const {
    account,
    posts,
    isLoadingAccount,
    isLoadingPosts,
    accountError,
    postsError,
  } = useLensCreator(lenshandle)

  // Fetch Grove metadata for custom fields (ISNI, verification, geniusArtistId)
  const attributes = (account?.metadata as any)?.attributes as Array<{ key: string; value: string }> | undefined

  // Extract Grove metadata URI from attributes
  const groveMetadataUriAttr = attributes?.find(attr => attr.key === 'groveMetadataUri')
  const metadataUri = groveMetadataUriAttr?.value

  const {
    data: groveMetadata,
    isLoading: isLoadingGroveMetadata,
  } = useGroveAccountMetadata(metadataUri)

  // Fetch songs from subgraph by Lens handle
  const {
    data: artistSongs,
    isLoading: isLoadingSongs,
  } = useArtistSongsByLensHandle(lenshandle)

  // Fetch follow state and follower counts
  const { isFollowing, canFollow, follow: handleFollowAction, isLoading: isFollowLoading } = useFollow({
    targetAccountAddress: account?.address || '',
  })

  const { count: followersCount } = useFollowers({
    accountAddress: account?.address,
    enabled: !!account,
  })

  const { count: followingCount } = useFollowing({
    accountAddress: account?.address,
    enabled: !!account,
  })

  // Loading state
  if (isLoadingAccount || isLoadingGroveMetadata || isLoadingSongs) {
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
  console.log('[CreatorPage] DEBUG - Grove metadata:', groveMetadata)
  console.log('[CreatorPage] DEBUG - Lens account.metadata:', account.metadata)
  console.log('[CreatorPage] DEBUG - Lens account.metadata.name:', account.metadata?.name)
  console.log('[CreatorPage] DEBUG - Lens handle (URL param):', lenshandle)
  const displayName = groveMetadata?.displayName || account.metadata?.name || lenshandle || 'Unknown Creator'
  console.log('[CreatorPage] DEBUG - Final displayName:', displayName)
  const avatarUrl = groveMetadata?.avatarUri
    ? convertGroveUri(groveMetadata.avatarUri)
    : account.metadata?.picture
    ? convertGroveUri(account.metadata.picture)
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.address}`

  // Check verification status from Grove metadata
  const verified = groveMetadata?.verification?.verified ?? false

  // Parse posts data
  const postItems = posts?.items || []

  // Transform posts to VideoPost format
  const videos: VideoPost[] = postItems
    .filter((post): post is Post => {
      return post.__typename === 'Post' && isVideoPost(post)
    })
    .map((post) => {
      const hasAttributes = post.metadata?.__typename === 'VideoMetadata'
      const metadata = hasAttributes && 'attributes' in post.metadata ? parseVideoMetadata(post.metadata.attributes) : {}

      console.log('[CreatorPage] Post ID:', post.id)
      console.log('[CreatorPage] Metadata:', post.metadata)
      console.log('[CreatorPage] Attributes:', metadata)

      // Extract thumbnail from video.cover field or attributes
      let thumbnailUrl = 'https://placehold.co/400x711/8b5cf6/ffffff?text=Video'

      if (metadata.thumbnailUri) {
        // Check attributes first
        console.log('[CreatorPage] Using thumbnail from attributes:', metadata.thumbnailUri)
        thumbnailUrl = convertGroveUri(metadata.thumbnailUri)
      } else if (post.metadata?.__typename === 'VideoMetadata' && 'video' in post.metadata) {
        // Check video.cover field from Lens metadata
        const videoMetadata = post.metadata as any
        const coverUri = videoMetadata.video?.cover
        console.log('[CreatorPage] Cover URI from Lens:', coverUri)
        if (coverUri) {
          thumbnailUrl = convertGroveUri(coverUri)
        }
      }

      console.log('[CreatorPage] Final thumbnail URL:', thumbnailUrl)

      return {
        id: post.id,
        thumbnailUrl,
        username: lenshandle || '',
      }
    })

  // Parse songs from artistSongs
  const songs: ArtistSong[] = artistSongs
    ? artistSongs.map((song) => ({
        id: song.grc20WorkId,
        title: song.title,
        artist: song.artist,
        artworkUrl: song.coverUri,
        onSongClick: () => navigate(`/song/${song.grc20WorkId}`),
      }))
    : []

  // Handle video click - navigate to video detail page
  const handleVideoClick = (video: VideoPost) => {
    navigate(`/u/${lenshandle}/video/${video.id}`)
  }

  // Handle follow/unfollow action (toggle)
  const handleFollow = async () => {
    // Check if user is logged in
    if (!canFollow && !isFollowing) {
      // TODO: Show login modal or redirect to login
      console.log('[CreatorPage] User must log in to follow')
      alert('Please log in to follow this creator')
      return
    }

    try {
      await handleFollowAction()
    } catch (error) {
      console.error('[CreatorPage] Follow action failed:', error)
    }
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
      following={followingCount}
      followers={followersCount}
      isFollowing={isFollowing}
      isFollowLoading={isFollowLoading}
      videos={videos}
      onVideoClick={handleVideoClick}
      isLoadingVideos={isLoadingPosts}
      songs={songs}
      onBack={() => navigate(-1)}
      onFollow={handleFollow}
    />
  )
}
