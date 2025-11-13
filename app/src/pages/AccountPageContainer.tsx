/**
 * Account Page Container
 * Fetches and displays any account's Lens profile (students, creators, artists)
 * with videos, songs (if artist), and stats
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AccountPage, type ArtistSong } from '@/components/profile/AccountPage'
import type { VideoPost } from '@/components/video/VideoGrid'
import { useLensCreator, isVideoPost } from '@/hooks/useLensCreator'
import type { Post } from '@/hooks/useLensCreator'
import { useArtistSongsByLensHandle } from '@/hooks/useArtistSongsByLensHandle'
import { useCreatorSubscriptionLock } from '@/hooks/useCreatorSubscriptionLock'
import { useFollow } from '@/hooks/useFollow'
import { useFollowers } from '@/hooks/useFollowers'
import { useFollowing } from '@/hooks/useFollowing'
import { useUnlockSubscription } from '@/hooks/useUnlockSubscription'
import { Spinner } from '@/components/ui/spinner'
import { SubscriptionDialog } from '@/components/subscription/SubscriptionDialog'
import { useAuth } from '@/contexts/AuthContext'
import {
  convertGroveUri,
  convertLensImage,
  parseVideoMetadata,
} from '@/lib/lens/utils'

export function AccountPageContainer() {
  const { lenshandle } = useParams<{ lenshandle: string }>()
  const navigate = useNavigate()
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false)
  const { pkpAddress, pkpWalletClient } = useAuth()

  // Fetch account and posts from Lens (using global lens/* namespace)
  const {
    account,
    posts,
    isLoadingAccount,
    isLoadingPosts,
    accountError,
    postsError,
  } = useLensCreator(lenshandle)

  // Note: Grove metadata integration removed - using Lens metadata directly

  // Fetch songs from subgraph by Lens handle
  const {
    data: artistSongs,
    isLoading: isLoadingSongs,
  } = useArtistSongsByLensHandle(lenshandle)

  // Extract Spotify track IDs from artist songs
  const spotifyTrackIds = artistSongs?.map(song => song.spotifyTrackId).filter(Boolean) as string[] | undefined

  // Fetch subscription lock address for creator from subgraph
  const {
    data: subscriptionLockData,
    isLoading: isLoadingLock,
  } = useCreatorSubscriptionLock(spotifyTrackIds)

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

  // Unlock Protocol subscription - uses lock address from subgraph
  const {
    subscribe,
    status: subscriptionStatus,
    statusMessage: subscriptionStatusMessage,
    errorMessage: subscriptionErrorMessage,
    reset: resetSubscription,
  } = useUnlockSubscription(
    pkpAddress ?? undefined,
    subscriptionLockData?.unlockLockAddress,
    { walletClient: pkpWalletClient }
  )

  const isSubscriptionProcessing =
    subscriptionStatus === 'approving' || subscriptionStatus === 'purchasing'

  // Handle subscription flow
  const handleSubscribe = () => {
    if (!pkpAddress || !pkpWalletClient) {
      alert('Please sign in to subscribe to this creator.')
      return
    }
    setIsSubscriptionDialogOpen(true)
  }

  const handleSubscriptionConfirm = async () => {
    if (!pkpAddress || !pkpWalletClient) {
      alert('Please sign in to subscribe to this creator.')
      return
    }
    await subscribe()
  }

  const handleSubscriptionRetry = async () => {
    if (!pkpAddress || !pkpWalletClient) {
      alert('Please sign in to subscribe to this creator.')
      return
    }
    resetSubscription()
    await subscribe()
  }

  const handleSubscriptionDialogClose = (open: boolean) => {
    setIsSubscriptionDialogOpen(open)
    if (!open && subscriptionStatus === 'complete') {
      resetSubscription()
    }
  }

  // Loading state
  if (isLoadingAccount || isLoadingSongs || isLoadingLock) {
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
  console.log('[CreatorPage] DEBUG - Lens account.metadata:', account.metadata)
  console.log('[CreatorPage] DEBUG - Lens account.metadata.name:', account.metadata?.name)
  console.log('[CreatorPage] DEBUG - Lens account.metadata.picture:', account.metadata?.picture)
  console.log('[CreatorPage] DEBUG - Lens handle (URL param):', lenshandle)
  const displayName = account.metadata?.name || lenshandle || 'Unknown Creator'
  console.log('[CreatorPage] DEBUG - Final displayName:', displayName)
  const avatarUrl = account.metadata?.picture
    ? convertLensImage(account.metadata.picture)
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.address}`
  console.log('[CreatorPage] DEBUG - Final avatarUrl:', avatarUrl)

  // TODO: Check verification status from Lens or custom attributes
  const verified = false

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

  // Only show subscribe button if creator has songs AND a valid lock address
  const hasSubscription = !!subscriptionLockData?.unlockLockAddress && songs.length > 0

  console.log('[CreatorPage] 🔒 Subscription check:', {
    songsCount: songs.length,
    spotifyTrackIds,
    subscriptionLockData,
    hasSubscription,
  })

  return (
    <>
      <AccountPage
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
        onSubscribe={hasSubscription ? handleSubscribe : undefined}
      />

      <SubscriptionDialog
        open={isSubscriptionDialogOpen}
        onOpenChange={handleSubscriptionDialogClose}
        displayName={displayName}
        currentStep={subscriptionStatus}
        isProcessing={isSubscriptionProcessing}
        statusMessage={subscriptionStatusMessage}
        errorMessage={subscriptionErrorMessage}
        onSubscribe={handleSubscriptionConfirm}
        onRetry={handleSubscriptionRetry}
      />
    </>
  )
}
