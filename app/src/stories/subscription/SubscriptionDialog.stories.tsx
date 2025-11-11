import type { Meta, StoryObj } from '@storybook/react-vite'
import { SubscriptionDialog } from '@/components/subscription/SubscriptionDialog'

const meta: Meta<typeof SubscriptionDialog> = {
  title: 'Subscription/SubscriptionDialog',
  component: SubscriptionDialog,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Idle - Show price and Subscribe button
 */
export const Idle: Story = {
  args: {
    open: true,
    displayName: 'Grimes',
    currentStep: 'idle',
    isProcessing: false,
    statusMessage: '',
    errorMessage: '',
    onOpenChange: () => {},
    onSubscribe: () => console.log('Subscribe clicked'),
    onRetry: () => {},
  },
}

/**
 * Approving - Wallet signature request
 */
export const Approving: Story = {
  args: {
    open: true,
    displayName: 'Grimes',
    currentStep: 'approving',
    isProcessing: true,
    statusMessage: 'Approve transaction in your wallet...',
    errorMessage: '',
    onOpenChange: () => {},
    onSubscribe: () => {},
    onRetry: () => {},
  },
}

/**
 * Purchasing - Processing transaction
 */
export const Purchasing: Story = {
  args: {
    open: true,
    displayName: 'Grimes',
    currentStep: 'purchasing',
    isProcessing: true,
    statusMessage: 'Processing subscription...',
    errorMessage: '',
    onOpenChange: () => {},
    onSubscribe: () => {},
    onRetry: () => {},
  },
}

/**
 * Complete - Success checkmark
 */
export const Complete: Story = {
  args: {
    open: true,
    displayName: 'Grimes',
    currentStep: 'complete',
    isProcessing: false,
    statusMessage: 'Subscription successful!',
    errorMessage: '',
    onOpenChange: () => {},
    onSubscribe: () => {},
    onRetry: () => {},
  },
}

/**
 * Error - Transaction failed
 */
export const Error: Story = {
  args: {
    open: true,
    displayName: 'Grimes',
    currentStep: 'error',
    isProcessing: false,
    statusMessage: '',
    errorMessage: 'Transaction failed. Insufficient funds.',
    onOpenChange: () => {},
    onSubscribe: () => {},
    onRetry: () => console.log('Retry clicked'),
  },
}

/**
 * Error - User rejected
 */
export const ErrorUserRejected: Story = {
  args: {
    open: true,
    displayName: 'Grimes',
    currentStep: 'error',
    isProcessing: false,
    statusMessage: '',
    errorMessage: 'User rejected the transaction.',
    onOpenChange: () => {},
    onSubscribe: () => {},
    onRetry: () => console.log('Retry clicked'),
  },
}
