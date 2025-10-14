import type { Meta, StoryObj } from '@storybook/react-vite'
import { WalletPageView } from '@/components/wallet/WalletPageView'

const meta = {
  title: 'Wallet/WalletPageView',
  component: WalletPageView,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof WalletPageView>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default wallet with balance
 */
export const Default: Story = {
  args: {
    creditsBalance: 1250,
    usdcBalance: '12.50',
    walletAddress: '0x1234567890123456789012345678901234567890',
    onCopyAddress: () => console.log('Address copied'),
  },
}

/**
 * Empty wallet
 */
export const Empty: Story = {
  args: {
    creditsBalance: 0,
    usdcBalance: '0.00',
    walletAddress: '0x1234567890123456789012345678901234567890',
    onCopyAddress: () => console.log('Address copied'),
  },
}

/**
 * High balance
 */
export const HighBalance: Story = {
  args: {
    creditsBalance: 15780,
    usdcBalance: '156.78',
    walletAddress: '0x1234567890123456789012345678901234567890',
    onCopyAddress: () => console.log('Address copied'),
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
  },
}
