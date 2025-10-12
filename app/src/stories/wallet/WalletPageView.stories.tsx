import type { Meta, StoryObj } from '@storybook/react-vite'
import { WalletPageView, type Transaction } from '@/components/wallet/WalletPageView'

const meta = {
  title: 'Wallet/WalletPageView',
  component: WalletPageView,
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
} satisfies Meta<typeof WalletPageView>

export default meta
type Story = StoryObj<typeof meta>

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    description: 'Purchased 500 credits',
    date: 'Jan 15, 2025',
    amount: 500,
    price: '$4.99',
  },
  {
    id: 'tx-2',
    description: 'Karaoke generation',
    date: 'Jan 14, 2025',
    amount: -50,
  },
  {
    id: 'tx-3',
    description: 'Purchased 1000 credits',
    date: 'Jan 12, 2025',
    amount: 1000,
    price: '$9.99',
  },
  {
    id: 'tx-4',
    description: 'Study session reward',
    date: 'Jan 10, 2025',
    amount: 25,
  },
  {
    id: 'tx-5',
    description: 'Karaoke generation',
    date: 'Jan 9, 2025',
    amount: -50,
  },
]

/**
 * Connected wallet with balance and transactions
 */
export const Connected: Story = {
  args: {
    creditsBalance: 1250,
    usdcBalance: '12.50',
    walletAddress: '0x1234567890123456789012345678901234567890',
    onCopyAddress: () => console.log('Address copied'),
    transactions: mockTransactions,
    transactionsLoading: false,
    activeTab: 'wallet',
    mobileTab: 'wallet',
    isConnected: true,
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
  },
}

/**
 * Empty wallet - no transactions yet
 */
export const Empty: Story = {
  args: {
    creditsBalance: 0,
    usdcBalance: '0.00',
    walletAddress: '0x1234567890123456789012345678901234567890',
    onCopyAddress: () => console.log('Address copied'),
    transactions: [],
    transactionsLoading: false,
    activeTab: 'wallet',
    mobileTab: 'wallet',
    isConnected: true,
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
  },
}

/**
 * Loading transactions
 */
export const Loading: Story = {
  args: {
    creditsBalance: 1250,
    usdcBalance: '12.50',
    walletAddress: '0x1234567890123456789012345678901234567890',
    onCopyAddress: () => console.log('Address copied'),
    transactions: [],
    transactionsLoading: true,
    activeTab: 'wallet',
    mobileTab: 'wallet',
    isConnected: true,
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
  },
}

/**
 * High balance with many transactions
 */
export const HighBalance: Story = {
  args: {
    creditsBalance: 15780,
    usdcBalance: '156.78',
    walletAddress: '0x1234567890123456789012345678901234567890',
    onCopyAddress: () => console.log('Address copied'),
    transactions: mockTransactions,
    transactionsLoading: false,
    activeTab: 'wallet',
    mobileTab: 'wallet',
    isConnected: true,
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
  },
}

/**
 * Low balance
 */
export const LowBalance: Story = {
  args: {
    creditsBalance: 15,
    usdcBalance: '0.25',
    walletAddress: '0x1234567890123456789012345678901234567890',
    onCopyAddress: () => console.log('Address copied'),
    transactions: [
      {
        id: 'tx-1',
        description: 'Karaoke generation',
        date: 'Jan 15, 2025',
        amount: -50,
      },
      {
        id: 'tx-2',
        description: 'Study session reward',
        date: 'Jan 14, 2025',
        amount: 25,
      },
    ],
    transactionsLoading: false,
    activeTab: 'wallet',
    mobileTab: 'wallet',
    isConnected: true,
    onDesktopTabChange: (tab) => console.log('Desktop tab:', tab),
    onMobileTabChange: (tab) => console.log('Mobile tab:', tab),
    onConnectWallet: () => console.log('Connect wallet'),
    onDisconnect: () => console.log('Disconnect'),
  },
}
