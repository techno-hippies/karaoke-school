import type { Meta, StoryObj } from '@storybook/react'
import { AuthDialog } from '@/components/layout/AuthDialog'
import { fn } from 'storybook/test'

const meta: Meta<typeof AuthDialog> = {
  title: 'Layout/AuthDialog',
  component: AuthDialog,
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
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: fn(),
    onConnectWallet: fn(),
    onLoginLens: fn(),
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Initial state - wallet not connected
 */
export const NeedsWallet: Story = {
  args: {
    isWalletConnected: false,
    hasLensAccount: false,
    isLitReady: false,
  }
}

/**
 * Wallet connected, needs Lens login
 */
export const NeedsLens: Story = {
  args: {
    isWalletConnected: true,
    hasLensAccount: false,
    isLitReady: false,
  }
}

/**
 * Lens logged in, Lit initializing automatically
 */
export const InitializingLit: Story = {
  args: {
    isWalletConnected: true,
    hasLensAccount: true,
    isLitReady: false,
  }
}

/**
 * All authentication complete
 */
export const AllReady: Story = {
  args: {
    isWalletConnected: true,
    hasLensAccount: true,
    isLitReady: true,
  }
}

/**
 * Currently authenticating (loading state)
 */
export const Authenticating: Story = {
  args: {
    isWalletConnected: false,
    hasLensAccount: false,
    isLitReady: false,
    isAuthenticating: true,
  }
}
