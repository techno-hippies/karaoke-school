import type { Meta, StoryObj } from '@storybook/react-vite'
import { CreditFlowDialog } from '@/components/karaoke/CreditFlowDialog'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Karaoke/CreditFlowDialog',
  component: CreditFlowDialog,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CreditFlowDialog>

export default meta
type Story = StoryObj<typeof meta>

const SAMPLE_WALLET_ADDRESS = '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30'

/**
 * View 1: Fund Wallet (No USDC)
 * User needs to fund their wallet with USDC
 */
export const FundWallet_ZeroBalance: Story = {
  args: {
    open: true,
    songTitle: 'Blinding Lights',
    songArtist: 'The Weeknd',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    usdcBalance: '0.00',
    creditsBalance: 0,
    onPurchaseCredits: (packageId: number) => {
      console.log('Purchase package:', packageId)
    },
  },
}

/**
 * View 1: Fund Wallet (Insufficient USDC)
 * User has some USDC but not enough for cheapest package
 */
export const FundWallet_InsufficientBalance: Story = {
  args: {
    open: true,
    songTitle: 'Shape of You',
    songArtist: 'Ed Sheeran',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    usdcBalance: '0.25',
    creditsBalance: 0,
    onPurchaseCredits: (packageId: number) => {
      console.log('Purchase package:', packageId)
    },
  },
}

/**
 * View 2: Purchase Credits (Has USDC)
 * User has enough USDC to buy credits
 */
export const PurchaseCredits_EnoughForOne: Story = {
  args: {
    open: true,
    songTitle: 'Anti-Hero',
    songArtist: 'Taylor Swift',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    usdcBalance: '0.75',
    creditsBalance: 5,
    onPurchaseCredits: (packageId: number) => {
      console.log('Purchase package:', packageId)
    },
  },
}

/**
 * View 2: Purchase Credits (Has USDC for mid-tier)
 * User can afford 1 and 5 credit packages
 */
export const PurchaseCredits_EnoughForFive: Story = {
  args: {
    open: true,
    songTitle: 'Heat Waves',
    songArtist: 'Glass Animals',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    usdcBalance: '3.50',
    creditsBalance: 5,
    onPurchaseCredits: (packageId: number) => {
      console.log('Purchase package:', packageId)
    },
  },
}

/**
 * View 2: Purchase Credits (Has USDC for all packages)
 * User can afford all packages
 */
export const PurchaseCredits_EnoughForAll: Story = {
  args: {
    open: true,
    songTitle: 'Bohemian Rhapsody',
    songArtist: 'Queen',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    usdcBalance: '15.00',
    creditsBalance: 5,
    onPurchaseCredits: (packageId: number) => {
      console.log('Purchase package:', packageId)
    },
  },
}

/**
 * Interactive: Simulates balance increasing
 * Watch the dialog automatically switch from Fund → Purchase view
 */
export const Interactive_BalanceIncrease: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [balance, setBalance] = useState('0.00')

    const addFunds = () => {
      setBalance((prev) => {
        const current = parseFloat(prev)
        return (current + 0.50).toFixed(2)
      })
    }

    const resetBalance = () => {
      setBalance('0.00')
    }

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}>Open Dialog</Button>
          <Button onClick={addFunds} variant="secondary">
            Add $0.50 USDC
          </Button>
          <Button onClick={resetBalance} variant="outline">
            Reset Balance
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Current balance: ${balance} USDC
        </p>
        <CreditFlowDialog
          open={open}
          onOpenChange={setOpen}
          songTitle="The Less I Know the Better"
          songArtist="Tame Impala"
          walletAddress={SAMPLE_WALLET_ADDRESS}
          usdcBalance={balance}
          creditsBalance={5}
          onPurchaseCredits={(packageId) => {
            console.log('Purchase package:', packageId)
            alert(`Purchasing package ${packageId}`)
          }}
        />
      </div>
    )
  },
}

/**
 * Mobile: Fund Wallet View
 */
export const Mobile_FundWallet: Story = {
  args: {
    open: true,
    songTitle: 'Levitating',
    songArtist: 'Dua Lipa',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    usdcBalance: '0.00',
    creditsBalance: 5,
    onPurchaseCredits: (packageId: number) => {
      console.log('Purchase package:', packageId)
    },
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Mobile: Purchase Credits View
 */
export const Mobile_PurchaseCredits: Story = {
  args: {
    open: true,
    songTitle: 'Levitating',
    songArtist: 'Dua Lipa',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    usdcBalance: '5.00',
    creditsBalance: 5,
    onPurchaseCredits: (packageId: number) => {
      console.log('Purchase package:', packageId)
    },
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Purchasing State (Loading)
 */
export const PurchaseCredits_Loading: Story = {
  args: {
    open: true,
    songTitle: 'Starboy',
    songArtist: 'The Weeknd',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    usdcBalance: '10.00',
    creditsBalance: 5,
    isPurchasing: true,
    onPurchaseCredits: (packageId: number) => {
      console.log('Purchase package:', packageId)
    },
  },
}
