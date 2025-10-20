import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfilePage, type Achievement, type ActivityItem } from '@/components/profile/ProfilePage'

const meta = {
  title: 'Profile/ProfilePage',
  component: ProfilePage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProfilePage>

export default meta
type Story = StoryObj<typeof meta>

// Sample achievements
const sampleAchievements: Achievement[] = [
  {
    id: '1',
    title: 'First Song',
    description: 'Completed your first song',
    iconUrl: '',
    unlockedAt: new Date('2024-01-15'),
    isLocked: false,
  },
  {
    id: '2',
    title: '7 Day Streak',
    description: 'Practice for 7 days in a row',
    iconUrl: '',
    unlockedAt: new Date('2024-02-01'),
    isLocked: false,
  },
  {
    id: '3',
    title: 'Perfect Score',
    description: 'Get 100% on any song',
    iconUrl: '',
    unlockedAt: new Date('2024-02-10'),
    isLocked: false,
  },
  {
    id: '4',
    title: '10 Songs',
    description: 'Complete 10 different songs',
    iconUrl: '',
    isLocked: true,
  },
  {
    id: '5',
    title: '30 Day Streak',
    description: 'Practice for 30 days in a row',
    iconUrl: '',
    isLocked: true,
  },
  {
    id: '6',
    title: 'Top 10',
    description: 'Reach top 10 on any song',
    iconUrl: '',
    isLocked: true,
  },
]

// Sample activities
const sampleActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'performance',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    title: 'Completed Karaoke Performance',
    description: 'Great job on your performance!',
    song: {
      title: 'Heat of the Night',
      artist: 'Scarlett X',
      artworkUrl: 'https://placebear.com/200/200',
    },
    score: 8750,
  },
  {
    id: '2',
    type: 'streak',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    title: '7 Day Streak!',
    description: "You've practiced for 7 days in a row",
  },
  {
    id: '3',
    type: 'practice',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    title: 'Study Session Completed',
    description: 'Practiced 50 lines',
    song: {
      title: 'Neon Lights',
      artist: 'Luna Ray',
      artworkUrl: 'https://placebear.com/201/201',
    },
  },
  {
    id: '4',
    type: 'achievement',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    title: 'Achievement Unlocked!',
    description: 'Earned "Perfect Score" achievement',
  },
  {
    id: '5',
    type: 'performance',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    title: 'Completed Karaoke Performance',
    song: {
      title: 'Midnight Dreams',
      artist: 'Echo Black',
      artworkUrl: 'https://placebear.com/202/202',
    },
    score: 7230,
  },
]

/**
 * Student profile with achievements and activity
 */
export const Default: Story = {
  args: {
    username: 'karaoke_star',
    displayName: 'Karaoke Star',
    avatarUrl: 'https://placebear.com/300/300',
    following: 145,
    followers: 892,
    isVerified: false,
    isOwnProfile: false,
    isFollowing: false,
    achievements: sampleAchievements,
    activities: sampleActivities,
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onMessage: () => console.log('Message clicked'),
    onActivitySongClick: (activity) => console.log('Activity song clicked:', activity),
  },
}

/**
 * Verified student profile
 */
export const Verified: Story = {
  args: {
    username: 'vocal_legend',
    displayName: 'Vocal Legend',
    avatarUrl: 'https://placebear.com/301/301',
    following: 523,
    followers: 12400,
    isVerified: true,
    isOwnProfile: false,
    isFollowing: true,
    achievements: sampleAchievements,
    activities: sampleActivities,
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Unfollow clicked'),
    onMessage: () => console.log('Message clicked'),
  },
}

/**
 * Own profile view (no follow button)
 */
export const OwnProfile: Story = {
  args: {
    username: 'you',
    displayName: 'Your Name',
    avatarUrl: 'https://placebear.com/302/302',
    following: 89,
    followers: 234,
    isVerified: false,
    isOwnProfile: true,
    achievements: sampleAchievements.slice(0, 3),
    activities: sampleActivities,
    onBack: () => console.log('Back clicked'),
  },
}

/**
 * New student with minimal achievements and activity
 */
export const NewStudent: Story = {
  args: {
    username: 'newbie_singer',
    avatarUrl: 'https://placebear.com/303/303',
    following: 5,
    followers: 2,
    isVerified: false,
    isOwnProfile: false,
    isFollowing: false,
    achievements: [sampleAchievements[0], ...sampleAchievements.slice(3)],
    activities: [sampleActivities[2]],
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onMessage: () => console.log('Message clicked'),
  },
}

/**
 * Profile with no achievements or activity yet
 */
export const EmptyState: Story = {
  args: {
    username: 'just_started',
    avatarUrl: 'https://placebear.com/304/304',
    following: 0,
    followers: 0,
    isVerified: false,
    isOwnProfile: false,
    isFollowing: false,
    achievements: [],
    activities: [],
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onMessage: () => console.log('Message clicked'),
  },
}

/**
 * Profile with lots of activity
 */
export const ActiveUser: Story = {
  args: {
    username: 'practice_king',
    displayName: 'Practice King',
    avatarUrl: 'https://placebear.com/305/305',
    following: 234,
    followers: 1890,
    isVerified: true,
    isOwnProfile: false,
    isFollowing: false,
    achievements: sampleAchievements,
    activities: [
      ...sampleActivities,
      ...sampleActivities.map((a, i) => ({
        ...a,
        id: `${a.id}-${i}`,
        timestamp: new Date(a.timestamp.getTime() - 7 * 24 * 60 * 60 * 1000),
      })),
    ],
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onMessage: () => console.log('Message clicked'),
    onActivitySongClick: (activity) => console.log('Activity song clicked:', activity),
  },
}
