import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount, usePosts, evmAddress } from '@lens-protocol/react'
import { useAuth } from '@/contexts/AuthContext'
import { ProfilePageView } from './ProfilePageView'
import type { Video } from './VideoGrid'
import type { ArtistSong } from './ProfilePageView'
import { APP_ADDRESS } from '@/lens/config'
import { useArtistData } from '@/hooks/useArtistData'
import { lensToGroveUrl } from '@/lib/lens/utils'

/**
 * ProfilePage - Container component for profile page
 * Fetches Lens account and posts, maps to ProfilePageView
 */
export function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { isPKPReady, pkpAddress, logout, pkpAuthContext } = useAuth()

  // Fetch Lens account by username
  const {
    data: account,
    loading: accountLoading,
    error: accountError
  } = useAccount({
    username: username ? {
      localName: username.replace('@', '')
    } : undefined
  })

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

  // Follow state (placeholder for now)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  // Show loading if account is loading, OR if we have posts but they're for a different account
  const isLoading = accountLoading || postsLoading || (account && !postsData)

  // Map Lens account to profile format
  const profile = account ? {
    username: account.username?.localName || username || 'user',
    displayName: account.metadata?.name || account.username?.localName || 'User',
    avatarUrl: lensToGroveUrl(account.metadata?.picture) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    bio: account.metadata?.bio || '',
    following: 0, // TODO: Add following count from graph
    followers: 0, // TODO: Add followers count from graph
    isVerified: false,
    isOwnProfile: pkpAddress ? account.address === pkpAddress : false,
    geniusArtistId,
  } : {
    username: username || 'user',
    displayName: 'User',
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
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
    setFollowLoading(true)
    // TODO: Replace with actual Lens follow logic
    // await toggleFollow()
    setIsFollowing(!isFollowing)
    setTimeout(() => setFollowLoading(false), 1000)
  }

  const handleStudyClick = () => {
    // Navigate to artist study page when geniusArtistId exists
    if (geniusArtistId) {
      navigate(`/artist/${geniusArtistId}`)
    }
  }

  const handleShareProfile = async () => {
    const shareUrl = `${window.location.origin}/profile/${username}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.displayName} on Lens`,
          text: profile.bio || 'Check out this profile',
          url: shareUrl,
        })
      } catch (err) {
        console.log('Share cancelled')
      }
    } else {
      navigator.clipboard.writeText(shareUrl)
      console.log('Link copied to clipboard')
    }
  }

  const handleVideoClick = (video: Video) => {
    navigate(`/u/${username}/video/${video.id}`)
  }

  // Error state
  if (accountError) {
    return (
      <div className="h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground text-xl mb-2">Profile not found</p>
          <p className="text-muted-foreground">{accountError.message}</p>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-foreground">Loading profile...</div>
      </div>
    )
  }

  return (
    <ProfilePageView
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
      onStudyClick={handleStudyClick}
      onMessageClick={() => console.log('Message')}
      onShareProfile={handleShareProfile}
      onVideoClick={handleVideoClick}
      onNavigateHome={() => navigate('/')}
    />
  )
}
