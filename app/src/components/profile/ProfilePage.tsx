import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount, usePosts, evmAddress } from '@lens-protocol/react'
import { fetchAccount } from '@lens-protocol/client/actions'
import type { Account } from '@lens-protocol/client'
import { useAuth } from '@/contexts/AuthContext'
import { ProfilePageView } from './ProfilePageView'
import type { Video } from './VideoGrid'
import type { ArtistSong } from './ProfilePageView'
import { APP_ADDRESS } from '@/lens/config'
import { useArtistData } from '@/hooks/useArtistData'
import { lensToGroveUrl } from '@/lib/lens/utils'
import { followAccount, unfollowAccount, isFollowingAccount } from '@/lib/lens/follow'
import { getGeniusIdByUsername } from '@/lib/genius/artist-lookup'
import { toast } from 'sonner'

/**
 * ProfilePage - Container component for profile page
 * Fetches Lens account and posts, maps to ProfilePageView
 */
export function ProfilePage() {
  const { username, address } = useParams<{ username?: string; address?: string }>()
  const navigate = useNavigate()
  const { isPKPReady, pkpAddress, logout, pkpAuthContext, lensSession, lensAccount, pkpWalletClient } = useAuth()

  // Determine if viewing own profile (no username/address in URL)
  const isOwnProfileRoute = !username && !address

  // Fetch Lens account by username or address
  // Note: We need lensSession to get the operations field (isFollowedByMe, canFollow, etc.)
  const accountResult = useAccount({
    username: username ? {
      localName: username.replace('@', '')
    } : undefined,
    address: address ? evmAddress(address) : undefined,
    // If viewing own profile route, use the logged-in account
    ...(isOwnProfileRoute && lensAccount ? { address: evmAddress(lensAccount.address) } : {})
  })

  const baseAccount = accountResult.data
  const accountLoading = accountResult.loading
  const accountError = accountResult.error

  // State to hold account with operations field (fetched when session is available)
  const [accountWithOperations, setAccountWithOperations] = useState<Account | null>(null)

  // Contract fallback state (check if artist registered but Lens not synced yet)
  const [contractGeniusId, setContractGeniusId] = useState<number | null>(null)
  const [isCheckingContract, setIsCheckingContract] = useState(false)

  // Use the authenticated account if available, otherwise use the base account
  const account = accountWithOperations || baseAccount

  // Clear accountWithOperations when baseAccount changes (e.g., navigating to different profile)
  useEffect(() => {
    setAccountWithOperations(null)
  }, [baseAccount?.address])

  // Fetch account with session to get operations field
  useEffect(() => {
    if (lensSession && baseAccount && !baseAccount.operations && !accountWithOperations) {
      console.log('[ProfilePage] Fetching account with session to get operations field...')

      fetchAccount(lensSession, {
        address: evmAddress(baseAccount.address)
      }).then(result => {
        if (result.isOk() && result.value) {
          console.log('[ProfilePage] ✅ Account with operations fetched:', result.value.operations)
          setAccountWithOperations(result.value)
        } else {
          console.warn('[ProfilePage] Failed to fetch account with operations:', result.isErr() ? result.error : 'No account')
        }
      }).catch(error => {
        console.error('[ProfilePage] Error fetching account with operations:', error)
      })
    }
  }, [lensSession, baseAccount, accountWithOperations])

  // Check contract when Lens account not found (maybe registered but not synced yet)
  useEffect(() => {
    if (!accountLoading && !account && username && !isCheckingContract) {
      console.log('[ProfilePage] Account not found in Lens, checking ArtistRegistry contract...')
      setIsCheckingContract(true)

      getGeniusIdByUsername(username.replace('@', '')).then(geniusId => {
        setContractGeniusId(geniusId)
        if (geniusId > 0) {
          console.log('[ProfilePage] ✅ Found in contract! Artist may be registered but Lens not synced. Retrying...')
          // Artist registered but Lens not synced - retry after delay
          setTimeout(() => {
            console.log('[ProfilePage] Retrying Lens account fetch...')
            accountResult.refetch?.()
            setIsCheckingContract(false)
          }, 2000)
        } else {
          console.log('[ProfilePage] Not found in contract - artist truly does not exist')
          setIsCheckingContract(false)
        }
      }).catch(err => {
        console.error('[ProfilePage] Contract check error:', err)
        setIsCheckingContract(false)
      })
    }
  }, [accountLoading, account, username, isCheckingContract, accountResult])

  // Fetch posts by author (filtered to your app)
  // Only fetch posts after account is loaded
  const {
    data: postsData,
    loading: postsLoading
  } = usePosts({
    filter: {
      authors: account ? [evmAddress(account.address)] : undefined,
      apps: [evmAddress(APP_ADDRESS)]
    },
    // Disable query until we have an account
    suspense: false,
  })

  // Extract Genius artist ID from account metadata
  const geniusArtistId = account?.metadata?.attributes?.find(
    attr => attr.key === 'genius_artist_id'
  )?.value ? parseInt(account.metadata.attributes.find(
    attr => attr.key === 'genius_artist_id'
  )!.value) : undefined

  // Fetch artist data if this is an artist profile
  const {
    artist,
    topSongs,
    isLoading: artistLoading,
    error: artistError
  } = useArtistData({
    artistId: geniusArtistId,
    pkpAuthContext,
    includeTopSongs: true
  })

  // Debug: Log when account or username changes
  useEffect(() => {
    console.log('===== ProfilePage Update =====')
    console.log('URL username:', username)
    console.log('Account username:', account?.username?.localName)
    console.log('Account address:', account?.address)
    console.log('Genius Artist ID:', geniusArtistId)
    console.log('Artist:', artist?.name)
    console.log('Top songs:', topSongs?.length)
    console.log('Posts count:', postsData?.items.length)
    console.log('Posts loading:', postsLoading)
    console.log('Account loading:', accountLoading)
    console.log('Artist loading:', artistLoading)
    if (postsData?.items.length) {
      console.log('First post ID:', postsData.items[0].id)
    }
    console.log('==============================')
  }, [username, account?.address, account?.username?.localName, geniusArtistId, artist?.name, topSongs?.length, postsData?.items.length, postsLoading, accountLoading, artistLoading])

  // Follow state - track both server state and optimistic updates
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  // Update follow state when account data changes
  useEffect(() => {
    if (account) {
      console.log('[ProfilePage] Checking follow state for account:', account.address)
      console.log('[ProfilePage] account.operations:', account.operations)
      console.log('[ProfilePage] account.operations.isFollowedByMe:', account.operations?.isFollowedByMe)
      const serverFollowState = isFollowingAccount(account)
      console.log('[ProfilePage] isFollowingAccount result:', serverFollowState)
      setIsFollowing(serverFollowState)
      console.log('[ProfilePage] Set isFollowing state to:', serverFollowState)
    }
  }, [account])

  // Show loading if account is loading, OR if we have posts but they're for a different account
  const isLoading = accountLoading || postsLoading || (account && !postsData)

  // Map Lens account to profile format
  const profile = account ? {
    username: account.username?.localName || username || account.address.slice(0, 8),
    displayName: account.metadata?.name || account.username?.localName || 'User',
    avatarUrl: lensToGroveUrl(account.metadata?.picture) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.address}`,
    bio: account.metadata?.bio || '',
    following: 0, // TODO: Add enrollments count from graph
    followers: 0, // TODO: Add students count from graph
    isVerified: false,
    isOwnProfile: pkpAddress ? account.owner === pkpAddress : false,
    geniusArtistId,
  } : {
    username: username || address?.slice(0, 8) || 'user',
    displayName: 'User',
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || address}`,
    bio: '',
    following: 0,
    followers: 0,
    isVerified: false,
    isOwnProfile: false,
    geniusArtistId: undefined,
  }

  // Map Lens posts to videos format (deduplicate just in case)
  // IMPORTANT: Only show posts if we have a valid account AND posts are for that account
  const videos: Video[] = account && postsData?.items ? Array.from(
    new Map(
      postsData.items.map(post => {
        const isVideo = post.metadata?.__typename === 'VideoMetadata'
        const videoMetadata = isVideo ? post.metadata : null

        // Extract copyright type to determine if encrypted
        const copyrightType = videoMetadata?.attributes?.find(a => a.key === 'copyright_type')?.value || 'copyright-free'
        const isPremium = copyrightType === 'copyrighted'

        return [
          post.id,
          {
            id: post.id,
            thumbnailUrl: videoMetadata?.video?.cover || `https://picsum.photos/400/711?random=${post.id}`,
            playCount: 0, // TODO: Add view count from post stats
            isPremium,
          }
        ]
      })
    ).values()
  ) : []

  // Map artist top songs to ArtistSong format
  const songs: ArtistSong[] = topSongs ? topSongs.map(song => ({
    id: song.id.toString(),
    title: song.title,
    artist: song.artist_names,
    artworkUrl: song.song_art_image_thumbnail_url,
    onSongClick: () => navigate(`/song/${song.id}`),
    showPlayButton: false,
  })) : []

  // Handlers
  const handleEditProfile = () => {
    navigate('/edit-profile')
  }

  const handleFollowClick = async () => {
    console.log('[ProfilePage] handleFollowClick called')
    console.log('[ProfilePage] Current isFollowing state:', isFollowing)
    console.log('[ProfilePage] lensSession:', !!lensSession)
    console.log('[ProfilePage] pkpWalletClient:', !!pkpWalletClient)
    console.log('[ProfilePage] account:', account?.address)
    console.log('[ProfilePage] pkpAddress:', pkpAddress)

    // Check if user is authenticated
    if (!lensSession || !pkpWalletClient) {
      console.log('[ProfilePage] Not authenticated, showing toast')
      toast.error('Please sign in to follow accounts')
      return
    }

    // Check if viewing own profile
    if (account?.address === pkpAddress) {
      console.log('[ProfilePage] Cannot follow own profile')
      toast.error('You cannot follow yourself')
      return
    }

    // Check if account exists
    if (!account) {
      console.log('[ProfilePage] Account not found')
      toast.error('Account not found')
      return
    }

    console.log('[ProfilePage] Starting follow/unfollow operation...')
    setFollowLoading(true)

    try {
      // Optimistically update UI
      const previousState = isFollowing
      setIsFollowing(!isFollowing)

      let result
      if (previousState) {
        // Unfollow
        result = await unfollowAccount(lensSession, pkpWalletClient, account.address)
        if (result.success) {
          toast.success('Unfollowed successfully')
          // Refetch account to get updated follow state
          const refetchResult = await fetchAccount(lensSession, {
            address: evmAddress(account.address)
          })
          if (refetchResult.isOk() && refetchResult.value) {
            setAccountWithOperations(refetchResult.value)
          }
        } else {
          // Revert on error
          setIsFollowing(previousState)
          toast.error(result.error || 'Failed to unfollow')
        }
      } else {
        // Follow
        result = await followAccount(lensSession, pkpWalletClient, account.address)
        if (result.success) {
          toast.success('Followed successfully')
          // Refetch account to get updated follow state
          const refetchResult = await fetchAccount(lensSession, {
            address: evmAddress(account.address)
          })
          if (refetchResult.isOk() && refetchResult.value) {
            setAccountWithOperations(refetchResult.value)
          }
        } else {
          // Revert on error
          setIsFollowing(previousState)
          toast.error(result.error || 'Failed to follow')
        }
      }
    } catch (error) {
      console.error('[ProfilePage] Follow error:', error)
      toast.error('An unexpected error occurred')
      // Revert optimistic update on error
      setIsFollowing(!isFollowing)
    } finally {
      setFollowLoading(false)
    }
  }

  const handleShareProfile = async () => {
    // Use username if available, otherwise use address
    const profilePath = account?.username?.localName
      ? `/u/${account.username.localName}`
      : account?.address
      ? `/profile/${account.address}`
      : '/profile'
    const shareUrl = `${window.location.origin}${profilePath}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.displayName} on K-School`,
          text: profile.bio || 'Check out this profile',
          url: shareUrl,
        })
      } catch (err) {
        console.log('Share cancelled')
      }
    } else {
      navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard')
    }
  }

  const handleVideoClick = (video: Video) => {
    navigate(`/u/${username}/video/${video.id}`, {
      state: {
        thumbnailUrl: video.thumbnailUrl,
        videoIds: videos.map(v => v.id),
        currentIndex: videos.findIndex(v => v.id === video.id)
      }
    })
  }

  // Error state - enhanced with contract fallback
  if (accountError && !isCheckingContract) {
    return (
      <div className="h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <p className="text-foreground text-xl mb-2">
            {contractGeniusId === 0
              ? "Artist profile not available"
              : contractGeniusId !== null
              ? "Profile loading..."
              : "Profile not found"
            }
          </p>
          {contractGeniusId === 0 && (
            <p className="text-muted-foreground mb-4">
              This artist hasn't been added to K-School yet.
            </p>
          )}
          {contractGeniusId === null && (
            <p className="text-muted-foreground">{accountError.message}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <ProfilePageView
      isLoading={isLoading}
      profile={profile}
      videos={videos}
      videosLoading={isLoading}
      songs={songs}
      songsLoading={artistLoading}
      followState={{
        isFollowing,
        isLoading: followLoading,
      }}
      isConnected={isPKPReady && !!pkpAddress}
      onDisconnect={logout}
      onEditProfile={handleEditProfile}
      onFollowClick={handleFollowClick}
      onMessageClick={() => console.log('Message')}
      onShareProfile={handleShareProfile}
      onVideoClick={handleVideoClick}
      onNavigateHome={() => navigate('/')}
    />
  )
}
