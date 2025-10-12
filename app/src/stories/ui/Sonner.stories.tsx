import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

const meta = {
  title: 'UI/Sonner',
  component: Toaster,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div>
        <Story />
        <Toaster />
      </div>
    ),
  ],
} satisfies Meta<typeof Toaster>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default toast
 */
export const Default: Story = {
  render: () => (
    <Button onClick={() => toast('Event has been created')}>
      Show Toast
    </Button>
  ),
}

/**
 * Toast with description
 */
export const WithDescription: Story = {
  render: () => (
    <Button
      onClick={() =>
        toast('Event has been created', {
          description: 'Sunday, December 03, 2023 at 9:00 AM',
        })
      }
    >
      Show Toast with Description
    </Button>
  ),
}

/**
 * Toast with action button
 */
export const WithAction: Story = {
  render: () => (
    <Button
      onClick={() =>
        toast('Event has been created', {
          action: {
            label: 'Undo',
            onClick: () => console.log('Undo clicked'),
          },
        })
      }
    >
      Show Toast with Action
    </Button>
  ),
}

/**
 * Success toast
 */
export const Success: Story = {
  render: () => (
    <Button onClick={() => toast.success('Payment completed successfully')}>
      Show Success Toast
    </Button>
  ),
}

/**
 * Error toast
 */
export const Error: Story = {
  render: () => (
    <Button onClick={() => toast.error('Something went wrong')}>
      Show Error Toast
    </Button>
  ),
}

/**
 * Warning toast
 */
export const Warning: Story = {
  render: () => (
    <Button onClick={() => toast.warning('Please review your changes')}>
      Show Warning Toast
    </Button>
  ),
}

/**
 * Info toast
 */
export const Info: Story = {
  render: () => (
    <Button onClick={() => toast.info('A new version is available')}>
      Show Info Toast
    </Button>
  ),
}

/**
 * Loading toast
 */
export const Loading: Story = {
  render: () => (
    <Button onClick={() => toast.loading('Loading your data...')}>
      Show Loading Toast
    </Button>
  ),
}

/**
 * Promise toast - handles async operations
 */
export const Promise: Story = {
  render: () => (
    <Button
      onClick={() => {
        const promise = () =>
          new Promise((resolve) => setTimeout(resolve, 2000))

        toast.promise(promise, {
          loading: 'Loading...',
          success: 'Data has been saved',
          error: 'Failed to save',
        })
      }}
    >
      Show Promise Toast
    </Button>
  ),
}

/**
 * Custom duration
 */
export const CustomDuration: Story = {
  render: () => (
    <Button
      onClick={() =>
        toast('This will stay for 10 seconds', {
          duration: 10000,
        })
      }
    >
      Show Long Toast
    </Button>
  ),
}

/**
 * All toast types
 */
export const AllTypes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Button onClick={() => toast('Default toast')}>
        Default
      </Button>
      <Button onClick={() => toast.success('Success toast')}>
        Success
      </Button>
      <Button onClick={() => toast.error('Error toast')}>
        Error
      </Button>
      <Button onClick={() => toast.warning('Warning toast')}>
        Warning
      </Button>
      <Button onClick={() => toast.info('Info toast')}>
        Info
      </Button>
      <Button onClick={() => toast.loading('Loading toast')}>
        Loading
      </Button>
    </div>
  ),
}
