import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfilePageView, type Video } from '@/components/profile/ProfilePageView'
import type { LeaderboardEntry } from '@/components/class/Leaderboard'

const meta = {
  title: 'Profile/ProfilePageView',
  component: ProfilePageView,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProfilePageView>

export default meta
type Story = StoryObj<typeof meta>

const mockVideos: Video[] = Array.from({ length: 18 }, (_, i) => ({
  id: `video-${i}`,
  thumbnailUrl: `https://picsum.photos/400/711?random=${i}`,
  playCount: Math.floor(Math.random() * 5000000),
  // Mix of free and premium videos - every 3rd video is premium
  isPremium: i % 3 === 0,
}))

const mockFavoriteArtists: LeaderboardEntry[] = [
  {
    rank: 1,
    username: 'Taylor Swift',
    score: 12847,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=taylorswift',
    onProfileClick: () => console.log('Navigate to Taylor Swift'),
  },
  {
    rank: 2,
    username: 'The Weeknd',
    score: 9234,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=theweeknd',
    onProfileClick: () => console.log('Navigate to The Weeknd'),
  },
  {
    rank: 3,
    username: 'Billie Eilish',
    score: 7891,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=billieeilish',
    onProfileClick: () => console.log('Navigate to Billie Eilish'),
  },
]

/**
 * Own profile - authenticated user viewing their own profile
 */
export const OwnProfile: Story = {
  args: {
    profile: {
      username: 'alice.lens',
      displayName: 'Alice Johnson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
      following: 892,
      followers: 1250,
      isVerified: true,
      isOwnProfile: true,
    },
    videos: mockVideos,
    videosLoading: false,
    favoriteArtists: mockFavoriteArtists,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Other profile - not following
 */
export const OtherProfileNotFollowing: Story = {
  args: {
    profile: {
      username: 'bob.lens',
      displayName: 'Bob Smith',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
      following: 234,
      followers: 5670,
      isVerified: false,
      isOwnProfile: false,
    },
    videos: mockVideos,
    videosLoading: false,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Other profile - already following
 */
export const OtherProfileFollowing: Story = {
  args: {
    profile: {
      username: 'charlie.lens',
      displayName: 'Charlie Davis',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
      following: 1500,
      followers: 125000,
      isVerified: true,
      isOwnProfile: false,
    },
    videos: mockVideos,
    videosLoading: false,
    favoriteArtists: mockFavoriteArtists,
    followState: {
      isFollowing: true,
      isLoading: false,
    },
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Unfollow'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Loading videos
 */
export const LoadingVideos: Story = {
  args: {
    profile: {
      username: 'diana.lens',
      displayName: 'Diana Lee',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana',
      following: 456,
      followers: 789,
      isVerified: false,
      isOwnProfile: false,
    },
    videos: [],
    videosLoading: true,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * No videos - empty state
 */
export const NoVideos: Story = {
  args: {
    profile: {
      username: 'newuser.lens',
      displayName: 'New User',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=newuser',
      following: 0,
      followers: 0,
      isVerified: false,
      isOwnProfile: true,
    },
    videos: [],
    videosLoading: false,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Follow loading state
 */
export const FollowLoading: Story = {
  args: {
    profile: {
      username: 'emma.lens',
      displayName: 'Emma Wilson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma',
      following: 678,
      followers: 2340,
      isVerified: false,
      isOwnProfile: false,
    },
    videos: mockVideos,
    videosLoading: false,
    followState: {
      isFollowing: false,
      isLoading: true,
    },
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Not connected - viewing other profile
 */
export const NotConnected: Story = {
  args: {
    profile: {
      username: 'frank.lens',
      displayName: 'Frank Miller',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=frank',
      following: 345,
      followers: 12000,
      isVerified: true,
      isOwnProfile: false,
    },
    videos: mockVideos,
    videosLoading: false,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: false,
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * No favorite artists - empty state
 */
export const NoFavoriteArtists: Story = {
  args: {
    profile: {
      username: 'grace.lens',
      displayName: 'Grace Kim',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=grace',
      following: 23,
      followers: 45,
      isVerified: false,
      isOwnProfile: true,
    },
    videos: mockVideos,
    videosLoading: false,
    favoriteArtists: [],
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}
