import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileWalletPage, type TokenBalance, type Achievement } from '@/components/profile/ProfileWalletPage'

const meta = {
  title: 'Profile/ProfileWalletPage',
  component: ProfileWalletPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileWalletPage>

export default meta
type Story = StoryObj<typeof meta>

// Primary tokens (Base ETH, Base USDC) - always shown
const primaryTokens: TokenBalance[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '0.042',
    network: 'Base',
    usdValue: '126.00',
    currencyIcon: 'ethereum-logo.png',
    chainIcon: 'base-chain.svg',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '25.00',
    network: 'Base',
    usdValue: '25.00',
    currencyIcon: 'usdc-logo.png',
    chainIcon: 'base-chain.svg',
  },
]

// Other tokens with balances
const otherTokensWithBalance: TokenBalance[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '0.15',
    network: 'Ethereum',
    usdValue: '450.00',
    currencyIcon: 'ethereum-logo.png',
    chainIcon: 'ethereum-chain.svg',
  },
]

// Zero-balance tokens (shown in accordion)
const zeroBalanceTokens: TokenBalance[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '0',
    network: 'Polygon',
    usdValue: '0',
    currencyIcon: 'ethereum-logo.png',
    chainIcon: 'polygon-chain.svg',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '0',
    network: 'Ethereum',
    usdValue: '0',
    currencyIcon: 'usdc-logo.png',
    chainIcon: 'ethereum-chain.svg',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '0',
    network: 'Polygon',
    usdValue: '0',
    currencyIcon: 'usdc-logo.png',
    chainIcon: 'polygon-chain.svg',
  },
]

const sampleTokens: TokenBalance[] = [
  ...primaryTokens,
  ...otherTokensWithBalance,
  ...zeroBalanceTokens,
]

const sampleAchievements: Achievement[] = [
  {
    id: '1',
    title: 'First Song',
    description: 'Completed your first song',
    unlockedAt: new Date('2024-01-15'),
    isLocked: false,
  },
  {
    id: '2',
    title: '7 Day Streak',
    description: 'Practice for 7 days in a row',
    unlockedAt: new Date('2024-02-01'),
    isLocked: false,
  },
  {
    id: '3',
    title: 'Perfect Score',
    description: 'Get 100% on any song',
    isLocked: true,
  },
  {
    id: '4',
    title: '30 Day Streak',
    description: 'Practice for 30 days in a row',
    isLocked: true,
  },
]

/**
 * Default view - user with some tokens and achievements
 */
export const Default: Story = {
  args: {
    username: 'karaoke_star',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=karaoke',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    tokens: sampleTokens,
    achievements: sampleAchievements,
    onCopyAddress: () => alert('Address copied!'),
  },
}

/**
 * New user - primary tokens shown with zero balance, other zero-balance tokens in accordion
 */
export const NewUser: Story = {
  args: {
    username: 'newbie',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=newbie',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    tokens: [
      // Primary tokens always shown (even with 0 balance)
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '0',
        network: 'Base',
        usdValue: '0',
        currencyIcon: 'ethereum-logo.png',
        chainIcon: 'base-chain.svg',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '0',
        network: 'Base',
        usdValue: '0',
        currencyIcon: 'usdc-logo.png',
        chainIcon: 'base-chain.svg',
      },
      // Other zero-balance tokens (in accordion)
      ...zeroBalanceTokens,
    ],
    achievements: [],
    onCopyAddress: () => alert('Address copied!'),
  },
}

/**
 * User with zero-balance tokens (should show empty state)
 */
export const ZeroBalances: Story = {
  args: {
    username: 'zero_balance',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zero',
    walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', balance: '0.000', network: 'Ethereum' },
      { symbol: 'USDC', name: 'USD Coin', balance: '0.00', network: 'Ethereum' },
    ],
    achievements: sampleAchievements.slice(0, 2),
    onCopyAddress: () => alert('Address copied!'),
  },
}

/**
 * No username yet - just wallet address
 */
export const NoUsername: Story = {
  args: {
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    tokens: sampleTokens,
    achievements: [],
    onCopyAddress: () => alert('Address copied!'),
  },
}

/**
 * Rich user with multiple tokens
 */
export const RichUser: Story = {
  args: {
    username: 'whale',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=whale',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '2.5',
        network: 'Base',
        usdValue: '5,000.00',
        currencyIcon: 'ethereum-logo.png',
        chainIcon: 'base-chain.svg',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '1,500.00',
        network: 'Base',
        usdValue: '1,500.00',
        currencyIcon: 'usdc-logo.png',
        chainIcon: 'base-chain.svg',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '0.8',
        network: 'Ethereum',
        usdValue: '1,600.00',
        currencyIcon: 'ethereum-logo.png',
        chainIcon: 'ethereum-chain.svg',
      },
    ],
    achievements: sampleAchievements,
    onCopyAddress: () => alert('Address copied!'),
  },
}

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    username: 'mobile_user',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mobile',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    tokens: sampleTokens,
    achievements: sampleAchievements,
    onCopyAddress: () => alert('Address copied!'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
