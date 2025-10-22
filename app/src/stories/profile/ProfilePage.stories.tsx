import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfilePage, type Achievement } from '@/components/profile/ProfilePage'
import type { VideoPost } from '@/components/video/VideoGrid'

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

// Sample videos
const sampleVideos: VideoPost[] = [
  {
    id: '1',
    thumbnailUrl: 'https://picsum.photos/400/711?random=1',
    username: 'karaoke_star',
  },
  {
    id: '2',
    thumbnailUrl: 'https://picsum.photos/400/711?random=2',
    username: 'karaoke_star',
  },
  {
    id: '3',
    thumbnailUrl: 'https://picsum.photos/400/711?random=3',
    username: 'karaoke_star',
  },
]

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

/**
 * Student profile with dances and achievements
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
    videos: sampleVideos,
    achievements: sampleAchievements,
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onMessage: () => console.log('Message clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
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
    videos: sampleVideos,
    achievements: sampleAchievements,
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Unfollow clicked'),
    onMessage: () => console.log('Message clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
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
    videos: sampleVideos,
    achievements: sampleAchievements.slice(0, 3),
    onBack: () => console.log('Back clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}

/**
 * New student with minimal achievements and videos
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
    videos: sampleVideos.slice(0, 1),
    achievements: [sampleAchievements[0], ...sampleAchievements.slice(3)],
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onMessage: () => console.log('Message clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}

/**
 * Profile with no achievements or videos yet
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
    videos: [],
    achievements: [],
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onMessage: () => console.log('Message clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}

/**
 * Profile with lots of videos and achievements
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
    videos: [
      ...sampleVideos,
      ...sampleVideos.map((v, i) => ({ ...v, id: `${v.id}-${i}` })),
    ],
    achievements: sampleAchievements,
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onMessage: () => console.log('Message clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}
