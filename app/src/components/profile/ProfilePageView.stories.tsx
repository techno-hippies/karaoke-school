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
    onCopyAddress: () => console.log('Copy address'),
    onDisconnect: () => console.log('Disconnect'),
  },
}

// Other user's profile
export const OtherUserProfile: Story = {
  args: {
    username: 'musiclover42',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=musiclover',
    bio: 'Just here to sing and have fun!',
    totalPoints: 2450,
    isOwnProfile: false,
    achievements: mockAchievements,
    onBack: () => console.log('Back'),
  },
}

// Verified other user
export const VerifiedOtherUser: Story = {
  args: {
    username: 'kpopfan99',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kpopfan',
    bio: 'BTS and BLACKPINK forever!',
    totalPoints: 8750,
    isOwnProfile: false,
    isVerified: true,
    achievements: mockAchievements.map((a, i) => ({ ...a, isLocked: i > 1 })),
    onBack: () => console.log('Back'),
  },
}

// New user with no achievements
export const NewUser: Story = {
  args: {
    username: 'newuser',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=newuser',
    isOwnProfile: false,
    achievements: [],
    onBack: () => console.log('Back'),
  },
}

// No avatar (fallback)
export const NoAvatar: Story = {
  args: {
    username: 'anonymous-user',
    isOwnProfile: false,
    onBack: () => console.log('Back'),
  },
}

// Verified instructor with high stats
export const VerifiedInstructor: Story = {
  args: {
    username: 'scarlett-ks',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=scarlettofficial',
    bio: 'Official Karaoke School instructor. Let\'s learn through music!',
    totalPoints: 125000,
    isOwnProfile: false,
    isVerified: true,
    achievements: mockAchievements.map(a => ({ ...a, isLocked: false })),
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
    onCopyAddress: () => console.log('Copy address'),
    onDisconnect: () => console.log('Disconnect'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
