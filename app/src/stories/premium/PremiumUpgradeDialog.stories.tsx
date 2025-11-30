import type { Meta, StoryObj } from '@storybook/react-vite'
import { PremiumUpgradeDialog } from '@/components/premium/PremiumUpgradeDialog'

const meta: Meta<typeof PremiumUpgradeDialog> = {
  title: 'Premium/PremiumUpgradeDialog',
  component: PremiumUpgradeDialog,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.145 0 0)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Idle - Show features and Upgrade button
 */
export const Idle: Story = {
  args: {
    open: true,
    currentStep: 'idle',
    isProcessing: false,
    statusMessage: '',
    errorMessage: '',
    onOpenChange: () => {},
    onUpgrade: () => console.log('Upgrade clicked'),
    onRetry: () => {},
  },
}

/**
 * Approving - Signing transaction
 */
export const Approving: Story = {
  args: {
    open: true,
    currentStep: 'approving',
    isProcessing: true,
    statusMessage: 'Signing transaction...',
    errorMessage: '',
    onOpenChange: () => {},
    onUpgrade: () => {},
    onRetry: () => {},
  },
}

/**
 * Purchasing - Processing transaction
 */
export const Purchasing: Story = {
  args: {
    open: true,
    currentStep: 'purchasing',
    isProcessing: true,
    statusMessage: 'Processing upgrade...',
    errorMessage: '',
    onOpenChange: () => {},
    onUpgrade: () => {},
    onRetry: () => {},
  },
}

/**
 * Complete - Success checkmark
 */
export const Complete: Story = {
  args: {
    open: true,
    currentStep: 'complete',
    isProcessing: false,
    statusMessage: 'Upgrade successful!',
    errorMessage: '',
    onOpenChange: () => {},
    onUpgrade: () => {},
    onRetry: () => {},
  },
}

/**
 * Error - Transaction failed
 */
export const Error: Story = {
  args: {
    open: true,
    currentStep: 'error',
    isProcessing: false,
    statusMessage: '',
    errorMessage: 'Transaction failed. Insufficient funds.',
    onOpenChange: () => {},
    onUpgrade: () => {},
    onRetry: () => console.log('Retry clicked'),
  },
}

/**
 * Error - User rejected
 */
export const ErrorUserRejected: Story = {
  args: {
    open: true,
    currentStep: 'error',
    isProcessing: false,
    statusMessage: '',
    errorMessage: 'User rejected the transaction.',
    onOpenChange: () => {},
    onUpgrade: () => {},
    onRetry: () => console.log('Retry clicked'),
  },
}
