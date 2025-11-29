import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ProfilePage, type Achievement } from '@/components/profile/ProfilePage'
import { ProfilePageSkeleton } from '@/components/profile/ProfilePageSkeleton'
import type { VideoPost } from '@/components/video/VideoGrid'
import { useAuth } from '@/contexts/AuthContext'
import { useAccountStats } from '@/lib/lens/hooks/useAccountStats'
import { useAccountPosts } from '@/lib/lens/hooks/useAccountPosts'
import { Button } from '@/components/ui/button'

/**
 * ProfilePageContainer - Container for the user's own profile
 * Shows Edit Profile button instead of Follow/Message buttons
 */
export function ProfilePageContainer({ onConnectWallet }: { onConnectWallet?: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // ✅ Real auth data from context
  const { lensAccount, isPKPReady } = useAuth()

  // Wait for account to load before fetching related data
  const { following, followers, isLoading: statsLoading } = useAccountStats(lensAccount?.address)
  const { posts, isLoading: postsLoading } = useAccountPosts(lensAccount?.address)

  // Show sign up CTA for unauthenticated users
  if (!isPKPReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h2 className="text-2xl font-bold text-center">{t('study.signUp')}</h2>
        <p className="text-muted-foreground text-center">{t('study.signUpDescription')}</p>
        <Button onClick={onConnectWallet}>
          {t('study.signUp')}
        </Button>
      </div>
    )
  }

  // Show loading state while account or related data is loading
  const isLoading = !lensAccount || statsLoading || postsLoading

  if (isLoading) {
    return <ProfilePageSkeleton />
  }

  // Extract real profile data (only after loading is complete)
  // Prefer metadata.name (set during registration) over username.localName (may be auto-generated global namespace)
  const username = lensAccount.metadata?.name || lensAccount.username?.localName || 'user'
  const displayName = lensAccount.metadata?.name || lensAccount.username?.localName || 'User'
  const avatarUrl = lensAccount.metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`

  // Convert Lens posts to VideoPost format
  const videos: VideoPost[] = posts.map(post => ({
    id: post.id,
    thumbnailUrl: (post.metadata as any)?.asset?.video?.cover || '',
    duration: '0:00', // TODO: Extract from metadata
    views: 0, // TODO: Extract from stats
    likes: 0, // TODO: Extract from stats
    username: username,
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
