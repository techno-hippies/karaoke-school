import type { Meta, StoryObj } from '@storybook/react'
import { WalletPageView, type TokenBalance } from '@/components/wallet/WalletPageView'

const meta = {
  title: 'Wallet/WalletPageView',
  component: WalletPageView,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    onCopyAddress: () => {
      console.log('Copy address clicked')
      alert('Address copied to clipboard!')
    },
    onCheckUsernameAvailability: async (username: string) => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))
      // Mock: some usernames are taken
      const takenUsernames = ['alice', 'bob', 'charlie', 'test', 'admin', 'karaoke']
      return !takenUsernames.includes(username.toLowerCase())
    },
    onPurchaseUsername: async (username: string) => {
      console.log('Purchase username:', username)
      await new Promise(resolve => setTimeout(resolve, 1500))
      alert(`Username @${username} purchased successfully!`)
      return true
    },
  },
} satisfies Meta<typeof WalletPageView>

export default meta
type Story = StoryObj<typeof meta>

const defaultTokens: TokenBalance[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '1.234',
    network: 'Base',
    usdValue: '2,468.00',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '0.567',
    network: 'Ethereum',
    usdValue: '1,134.00',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '42.50',
    network: 'Base',
    usdValue: '42.50',
  },
]

/**
 * Default wallet view
 * Shows username upgrade section + token balances
 * User has no username yet
 */
export const Default: Story = {
  args: {
    tokens: defaultTokens,
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    currentUsername: undefined,
  },
}

/**
 * With existing username
 * User already has a username, can upgrade to a new one
 */
export const WithUsername: Story = {
  args: {
    tokens: defaultTokens,
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    currentUsername: 'alice123',
  },
}

/**
 * Zero balances
 * New user with no funds
 */
export const ZeroBalances: Story = {
  args: {
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '0.000',
        network: 'Base',
        usdValue: '0.00',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '0.000',
        network: 'Ethereum',
        usdValue: '0.00',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '0.00',
        network: 'Base',
        usdValue: '0.00',
      },
    ],
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    currentUsername: undefined,
  },
}

/**
 * High balances
 * User with significant funds
 */
export const HighBalances: Story = {
  args: {
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '42.567',
        network: 'Base',
        usdValue: '85,134.00',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '15.234',
        network: 'Ethereum',
        usdValue: '30,468.00',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '125,000.00',
        network: 'Base',
        usdValue: '125,000.00',
      },
    ],
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    currentUsername: undefined,
  },
}

/**
 * Single token
 * User with only one token
 */
export const SingleToken: Story = {
  args: {
    tokens: [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '100.00',
        network: 'Base',
        usdValue: '100.00',
      },
    ],
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    currentUsername: undefined,
  },
}

/**
 * Without USD values
 * Shows tokens without price data
 */
export const WithoutUSDValues: Story = {
  args: {
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '1.234',
        network: 'Base',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '0.567',
        network: 'Ethereum',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '42.50',
        network: 'Base',
      },
    ],
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    currentUsername: undefined,
  },
}

/**
 * Many tokens
 * Tests scrolling with many tokens
 */
export const ManyTokens: Story = {
  args: {
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '1.234',
        network: 'Base',
        usdValue: '2,468.00',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '0.567',
        network: 'Ethereum',
        usdValue: '1,134.00',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '42.50',
        network: 'Base',
        usdValue: '42.50',
      },
      {
        symbol: 'USDT',
        name: 'Tether',
        balance: '100.00',
        network: 'Base',
        usdValue: '100.00',
      },
      {
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        balance: '50.00',
        network: 'Ethereum',
        usdValue: '50.00',
      },
    ],
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    currentUsername: undefined,
  },
}

/**
 * Mobile viewport
 * Tests responsive layout on mobile
 */
export const Mobile: Story = {
  args: {
    tokens: defaultTokens,
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    currentUsername: undefined,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
