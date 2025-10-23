import { useNavigate } from 'react-router-dom'
import { ProfilePage, type Achievement } from '@/components/profile/ProfilePage'
import { ProfilePageSkeleton } from '@/components/profile/ProfilePageSkeleton'
import type { VideoPost } from '@/components/video/VideoGrid'
import { useAuth } from '@/contexts/AuthContext'
import { useAccountStats } from '@/lib/lens/hooks/useAccountStats'
import { useAccountPosts } from '@/lib/lens/hooks/useAccountPosts'

/**
 * ProfilePageContainer - Container for the user's own profile
 * Shows Edit Profile button instead of Follow/Message buttons
 */
export function ProfilePageContainer() {
  const navigate = useNavigate()

  // ✅ Real auth data from context
  const { lensAccount, pkpAddress } = useAuth()

  // Wait for account to load before fetching related data
  const { following, followers, isLoading: statsLoading } = useAccountStats(lensAccount?.address)
  const { posts, isLoading: postsLoading } = useAccountPosts(lensAccount?.address)

  // Show loading state while account or related data is loading
  const isLoading = !lensAccount || statsLoading || postsLoading

  if (isLoading) {
    return <ProfilePageSkeleton />
  }

  // Extract real profile data (only after loading is complete)
  const username = lensAccount.username?.localName || 'user' // Handle without @
  const displayName = lensAccount.metadata?.name || lensAccount.username?.localName || 'User'
  const avatarUrl = lensAccount.metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`

  // Convert Lens posts to VideoPost format
  const videos: VideoPost[] = posts.map(post => ({
    id: post.id,
    thumbnailUrl: post.metadata?.asset?.video?.cover || '',
    duration: '0:00', // TODO: Extract from metadata
    views: 0, // TODO: Extract from stats
    likes: 0, // TODO: Extract from stats
  }))

  // TODO: Achievements from app-specific contract/database
  const mockAchievements: Achievement[] = [
    {
      id: '1',
      title: 'First Steps',
      description: 'Complete your first practice session',
      isLocked: false,
      unlockedAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      id: '2',
      title: '7 Day Streak',
      description: 'Practice 7 days in a row',
      isLocked: false,
      unlockedAt: new Date(Date.now() - 86400000 * 1),
    },
    {
      id: '3',
      title: 'Perfect Score',
      description: 'Get 100% on any song',
      isLocked: true,
    },
  ]

  const handleEditProfile = () => {
    // TODO: Navigate to profile edit page or open edit modal
    console.log('Edit profile clicked')
  }

  const handleVideoClick = (video: VideoPost) => {
    // TODO: Navigate to video page
    console.log('Video clicked:', video)
  }

  return (
    <ProfilePage
      username={username}
      displayName={displayName}
      avatarUrl={avatarUrl}
      following={following}
      followers={followers}
      isVerified={false}
      isOwnProfile={true}
      videos={videos}
      onVideoClick={handleVideoClick}
      achievements={mockAchievements}
      onBack={() => navigate(-1)}
      onEditProfile={handleEditProfile}
    />
  )
}
