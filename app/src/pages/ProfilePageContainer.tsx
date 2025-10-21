import { useNavigate } from 'react-router-dom'
import { ProfilePage, type Achievement, type ActivityItem } from '@/components/profile/ProfilePage'

/**
 * ProfilePageContainer - Container for the user's own profile
 * Shows Edit Profile button instead of Follow/Message buttons
 *
 * TODO: Connect to real auth context and profile data
 * For now uses mock data
 */
export function ProfilePageContainer() {
  const navigate = useNavigate()

  // TODO: Replace with real hooks
  // const { username, displayName, avatarUrl, pkpAddress } = useAuth()
  // const { following, followers } = useProfileStats(pkpAddress)
  // const { achievements } = useAchievements(pkpAddress)
  // const { activities } = useActivities(pkpAddress)

  // Mock data for now
  const mockUsername = 'student123'
  const mockDisplayName = 'Student User'
  const mockAvatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=student123'
  const mockFollowing = 0
  const mockFollowers = 0

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

  const mockActivities: ActivityItem[] = [
    {
      id: '1',
      type: 'practice',
      timestamp: new Date(Date.now() - 3600000 * 2),
      title: 'Practiced a song',
      song: {
        title: 'Anti-Hero',
        artist: 'Taylor Swift',
        artworkUrl: 'https://images.genius.com/f406b461b1e69871b2ceb0320d322fd4.1000x1000x1.jpg',
      },
    },
    {
      id: '2',
      type: 'achievement',
      timestamp: new Date(Date.now() - 86400000 * 1),
      title: 'Unlocked achievement',
      description: '7 Day Streak',
    },
    {
      id: '3',
      type: 'performance',
      timestamp: new Date(Date.now() - 86400000 * 2),
      title: 'Completed karaoke session',
      score: 850,
      song: {
        title: 'Shake It Off',
        artist: 'Taylor Swift',
      },
    },
  ]

  const handleEditProfile = () => {
    // TODO: Navigate to profile edit page or open edit modal
    console.log('Edit profile clicked')
  }

  const handleActivitySongClick = (activity: ActivityItem) => {
    // TODO: Navigate to song page
    console.log('Activity song clicked:', activity)
  }

  return (
    <ProfilePage
      username={mockUsername}
      displayName={mockDisplayName}
      avatarUrl={mockAvatarUrl}
      following={mockFollowing}
      followers={mockFollowers}
      isVerified={false}
      isOwnProfile={true}
      achievements={mockAchievements}
      activities={mockActivities}
      onBack={() => navigate(-1)}
      onEditProfile={handleEditProfile}
      onActivitySongClick={handleActivitySongClick}
    />
  )
}
