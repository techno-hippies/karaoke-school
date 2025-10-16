import type { Meta, StoryObj } from '@storybook/react-vite'
import { SubscriptionDialog } from '@/components/profile/SubscriptionDialog'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Profile/SubscriptionDialog',
  component: SubscriptionDialog,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SubscriptionDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default subscription dialog
 */
export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => console.log('Dialog state changed'),
    username: 'singer_star',
    onSubscribe: () => console.log('Subscribe clicked'),
  },
}

/**
 * With custom avatar
 */
export const WithAvatar: Story = {
  args: {
    open: true,
    onOpenChange: () => console.log('Dialog state changed'),
    username: 'viral_sensation',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=viral_sensation',
    onSubscribe: () => console.log('Subscribe clicked'),
  },
}

/**
 * Different pricing
 */
export const DifferentPrice: Story = {
  args: {
    open: true,
    onOpenChange: () => console.log('Dialog state changed'),
    username: 'premium_artist',
    price: '$9.99/month',
    onSubscribe: () => console.log('Subscribe clicked'),
  },
}

/**
 * Interactive - click to open
 */
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false)

    return (
      <>
        <Button onClick={() => setOpen(true)}>
          Subscribe - $1.99/month
        </Button>
        <SubscriptionDialog
          open={open}
          onOpenChange={setOpen}
          username="interactive_creator"
          userAvatar="https://api.dicebear.com/7.x/avataaars/svg?seed=interactive"
          onSubscribe={() => {
            console.log('Subscribe clicked')
            setOpen(false)
          }}
        />
      </>
    )
  },
}
