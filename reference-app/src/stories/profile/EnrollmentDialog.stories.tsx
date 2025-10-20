import type { Meta, StoryObj } from '@storybook/react-vite'
import { EnrollmentDialog } from '@/components/profile/EnrollmentDialog'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Profile/EnrollmentDialog',
  component: EnrollmentDialog,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EnrollmentDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default enrollment dialog
 */
export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => console.log('Dialog state changed'),
    username: 'singer_star',
    onEnroll: () => console.log('Enroll clicked'),
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
    onEnroll: () => console.log('Enroll clicked'),
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
    onEnroll: () => console.log('Enroll clicked'),
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
          Enroll - $1.99/month
        </Button>
        <EnrollmentDialog
          open={open}
          onOpenChange={setOpen}
          username="interactive_creator"
          userAvatar="https://api.dicebear.com/7.x/avataaars/svg?seed=interactive"
          onEnroll={() => {
            console.log('Enroll clicked')
            setOpen(false)
          }}
        />
      </>
    )
  },
}
