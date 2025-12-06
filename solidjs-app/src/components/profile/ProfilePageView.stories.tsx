import type { Meta, StoryObj } from 'storybook-solidjs'
import { ProfilePageView, type Achievement } from './ProfilePageView'
import type { TokenBalance } from '@/hooks/usePKPBalances'

const meta: Meta<typeof ProfilePageView> = {
  title: 'Profile/ProfilePageView',
  component: ProfilePageView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof ProfilePageView>

// Mock token data
const mockTokens: TokenBalance[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '0.0523',
    network: 'Base',
    usdValue: '156.90',
    currencyIcon: 'ethereum-logo.png',
    chainIcon: 'base-chain.svg',
    isLoading: false,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '125.50',
    network: 'Base',
    usdValue: '125.50',
    currencyIcon: 'usdc-logo.png',
    chainIcon: 'base-chain.svg',
    isLoading: false,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '0.0012',
    network: 'Ethereum',
    usdValue: '3.60',
    currencyIcon: 'ethereum-logo.png',
    chainIcon: 'ethereum-chain.svg',
    isLoading: false,
  },
]

// Mock achievements
const mockAchievements: Achievement[] = [
  {
    id: '1',
    title: 'First Steps',
    description: 'Complete your first karaoke session',
    isLocked: false,
  },
  {
    id: '2',
    title: 'Perfect Score',
    description: 'Get a perfect score on any song',
    isLocked: false,
  },
  {
    id: '3',
    title: 'Song Master',
    description: 'Complete 50 karaoke sessions',
    isLocked: true,
  },
  {
    id: '4',
    title: 'Polyglot',
    description: 'Study songs in 3 different languages',
    isLocked: true,
  },
]

// Mock videos
const mockVideos = [
  {
    id: '1',
    thumbnailUrl: 'https://picsum.photos/seed/v1/200/356',
    username: 'scarlett',
  },
  {
    id: '2',
    thumbnailUrl: 'https://picsum.photos/seed/v2/200/356',
    username: 'scarlett',
  },
  {
    id: '3',
    thumbnailUrl: 'https://picsum.photos/seed/v3/200/356',
    username: 'scarlett',
  },
]

// Own profile (wallet view)
export const OwnProfile: Story = {
  args: {
    username: 'scarlett-ks',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=scarlett',
    bio: 'Learning languages through music! K-pop and J-pop fan.',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    tokens: mockTokens,
    isLoadingTokens: false,
    isOwnProfile: true,
    videos: mockVideos,
    isLoadingVideos: false,
    onCopyAddress: () => console.log('Copy address'),
    onDisconnect: () => console.log('Disconnect'),
  },
}

// Own profile with loading tokens
export const OwnProfileLoading: Story = {
  args: {
    username: 'scarlett-ks',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=scarlett',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    tokens: [],
    isLoadingTokens: true,
    isOwnProfile: true,
    videos: [],
    isLoadingVideos: false,
    onCopyAddress: () => console.log('Copy address'),
    onDisconnect: () => console.log('Disconnect'),
  },
}

// Other user's profile (not following)
export const OtherUserProfile: Story = {
  args: {
    username: 'musiclover42',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=musiclover',
    bio: 'Just here to sing and have fun!',
    walletAddress: '0x8f97C17e599bb823e42d936309706628A93B33B8',
    following: 42,
    followers: 128,
    totalPoints: 2450,
    isOwnProfile: false,
    isFollowing: false,
    isFollowLoading: false,
    videos: mockVideos,
    isLoadingVideos: false,
    achievements: mockAchievements,
    onFollow: () => console.log('Follow'),
    onMessage: () => console.log('Message'),
    onBack: () => console.log('Back'),
  },
}

// Other user's profile (following)
export const OtherUserFollowing: Story = {
  args: {
    username: 'kpopfan99',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kpopfan',
    bio: 'BTS and BLACKPINK forever!',
    walletAddress: '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832',
    following: 156,
    followers: 892,
    totalPoints: 8750,
    isOwnProfile: false,
    isFollowing: true,
    isFollowLoading: false,
    isVerified: true,
    videos: mockVideos,
    isLoadingVideos: false,
    achievements: mockAchievements.map((a, i) => ({ ...a, isLocked: i > 1 })),
    onFollow: () => console.log('Unfollow'),
    onBack: () => console.log('Back'),
  },
}

// Profile with no videos
export const NoVideos: Story = {
  args: {
    username: 'newuser',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=newuser',
    walletAddress: '0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6',
    following: 5,
    followers: 2,
    isOwnProfile: false,
    videos: [],
    isLoadingVideos: false,
    achievements: [],
    onFollow: () => console.log('Follow'),
    onBack: () => console.log('Back'),
  },
}

// Loading videos
export const LoadingVideos: Story = {
  args: {
    username: 'musiclover42',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=musiclover',
    walletAddress: '0x3709f41cdc9E7852140bc23A21adCe600434d4E8',
    following: 42,
    followers: 128,
    isOwnProfile: false,
    videos: [],
    isLoadingVideos: true,
    onFollow: () => console.log('Follow'),
    onBack: () => console.log('Back'),
  },
}

// No avatar (fallback)
export const NoAvatar: Story = {
  args: {
    username: 'anonymous-user',
    walletAddress: '0x6Cf6bC01D51aF736Cd34bC3a682B7b081eA77B07',
    following: 10,
    followers: 5,
    isOwnProfile: false,
    videos: mockVideos,
    isLoadingVideos: false,
    onFollow: () => console.log('Follow'),
    onBack: () => console.log('Back'),
  },
}

// Verified user with high stats
export const VerifiedUser: Story = {
  args: {
    username: 'scarlett-ks',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=scarlettofficial',
    bio: 'Official Karaoke School instructor. Let\'s learn through music!',
    walletAddress: '0x8d5C708E4e91d17De2A320238Ca1Ce12FcdFf545',
    following: 150,
    followers: 12500,
    totalPoints: 125000,
    isOwnProfile: false,
    isVerified: true,
    videos: mockVideos,
    isLoadingVideos: false,
    achievements: mockAchievements.map(a => ({ ...a, isLocked: false })),
    onFollow: () => console.log('Follow'),
    onMessage: () => console.log('Message'),
    onBack: () => console.log('Back'),
  },
}

// Mobile-optimized view
export const MobileView: Story = {
  args: {
    username: 'scarlett-ks',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=scarlett',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    tokens: mockTokens,
    isLoadingTokens: false,
    isOwnProfile: true,
    videos: mockVideos,
    isLoadingVideos: false,
    onCopyAddress: () => console.log('Copy address'),
    onDisconnect: () => console.log('Disconnect'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
