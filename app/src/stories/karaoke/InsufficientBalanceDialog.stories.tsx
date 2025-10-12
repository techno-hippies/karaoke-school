import type { Meta, StoryObj } from '@storybook/react-vite'
import { InsufficientBalanceDialog } from '@/components/karaoke/InsufficientBalanceDialog'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Karaoke/InsufficientBalanceDialog',
  component: InsufficientBalanceDialog,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof InsufficientBalanceDialog>

export default meta
type Story = StoryObj<typeof meta>

const SAMPLE_WALLET_ADDRESS = '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30'

/**
 * Zero balance
 */
export const Default: Story = {
  args: {
    open: true,
    songTitle: 'Blinding Lights',
    songArtist: 'The Weeknd',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    balance: '0.00',
  },
}

/**
 * Small balance
 */
export const SmallBalance: Story = {
  args: {
    open: true,
    songTitle: 'Blinding Lights',
    songArtist: 'The Weeknd',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    balance: '0.25',
  },
}

/**
 * Interactive
 */
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false)

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Button onClick={() => setOpen(true)}>
          Show Insufficient Balance Dialog
        </Button>
        <InsufficientBalanceDialog
          open={open}
          onOpenChange={setOpen}
          songTitle="Blinding Lights"
          songArtist="The Weeknd"
          walletAddress={SAMPLE_WALLET_ADDRESS}
          balance="0.15"
        />
      </div>
    )
  },
}

/**
 * Mobile view
 */
export const MobileView: Story = {
  args: {
    open: true,
    songTitle: 'Shape of You',
    songArtist: 'Ed Sheeran',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    balance: '0.00',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Desktop view
 */
export const DesktopView: Story = {
  args: {
    open: true,
    songTitle: 'Anti-Hero',
    songArtist: 'Taylor Swift',
    walletAddress: SAMPLE_WALLET_ADDRESS,
    balance: '0.00',
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
}
