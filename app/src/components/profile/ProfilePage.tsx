import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ProfilePageView } from './ProfilePageView'
import type { Video } from './VideoGrid'

// TODO: Replace with actual Lens hooks when available
// import { useLensProfile } from '@/hooks/lens/useLensProfile'
// import { useLensFollow } from '@/hooks/lens/useLensFollow'

/**
 * ProfilePage - Container component for profile page
 * Handles Lens data fetching and state management
 * Presentation logic delegated to ProfilePageView
 */
export function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { isPKPReady, pkpAddress, logout } = useAuth()

  // TODO: Replace with actual Lens hooks
  // const { profile, videos, isLoading } = useLensProfile(username)
  // const { isFollowing, isLoading: followLoading, toggleFollow } = useLensFollow(profile?.address)

  // Placeholder data for now - replace with real Lens data
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  const profile = {
    username: username || 'user.lens',
    displayName: 'User Name',
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    bio: 'Bio goes here',
    following: 892,
    followers: 1250,
    isVerified: false,
    isOwnProfile: false, // TODO: Compare with currentUser
  }

  const videos: Video[] = Array.from({ length: 18 }, (_, i) => ({
    id: `video-${i}`,
    thumbnailUrl: `https://picsum.photos/400/711?random=${i}`,
    playCount: Math.floor(Math.random() * 5000000),
  }))

  const isLoading = false

  // Navigation state
  const [activeTab] = useState<'home' | 'study' | 'post' | 'inbox' | 'profile'>('profile')
  const [mobileTab] = useState<'home' | 'study' | 'post' | 'inbox' | 'profile'>('profile')

  // Handlers
  const handleDesktopTabChange = (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => {
    const routes = {
      home: '/',
      study: '/class',
      post: '/karaoke',
      wallet: '/wallet',
      profile: '/profile'
    }

    if (tab === 'profile' && !profile.isOwnProfile) {
      // Navigate to current user's profile if clicking from another user's profile
      // TODO: Use currentUser from Lens auth
      navigate(`/profile/currentuser.lens`)
    } else {
      navigate(routes[tab])
    }
  }

  const handleMobileTabChange = (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => {
    const routes = {
      home: '/',
      study: '/class',
      post: '/karaoke',
      wallet: '/wallet',
      profile: '/profile'
    }
    navigate(routes[tab])
  }

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
    navigate(`/profile/${username}/video/${video.id}`)
  }

  // Loading state - could be a separate component
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
      followState={{
        isFollowing,
        isLoading: followLoading,
      }}
      activeTab={activeTab}
      mobileTab={mobileTab}
      onDesktopTabChange={handleDesktopTabChange}
      onMobileTabChange={handleMobileTabChange}
      isConnected={isPKPReady && !!pkpAddress}
      walletAddress={pkpAddress || undefined}
      onConnectWallet={() => console.log('Connect wallet')}
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
