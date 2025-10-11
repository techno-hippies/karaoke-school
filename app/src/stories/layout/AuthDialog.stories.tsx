import type { Meta, StoryObj } from '@storybook/react'
import { AuthDialog } from '@/components/layout/AuthDialog'

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
    onOpenChange: () => {},
    onRegister: () => {},
    onSignIn: () => {},
    onLoginLens: () => {},
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Initial state - needs passkey authentication
 * Shows two-button flow: Register or Sign In
 */
export const NeedsPasskey: Story = {
  args: {
    isPKPReady: false,
    hasLensAccount: false,
  }
}

/**
 * PKP authenticated, needs Lens account
 */
export const NeedsLens: Story = {
  args: {
    isPKPReady: true,
    hasLensAccount: false,
  }
}

/**
 * All authentication complete
 */
export const AllReady: Story = {
  args: {
    isPKPReady: true,
    hasLensAccount: true,
  }
}

/**
 * Registering new account (loading state)
 */
export const Registering: Story = {
  args: {
    isPKPReady: false,
    hasLensAccount: false,
    isAuthenticating: true,
  }
}

/**
 * Signing in (loading state)
 */
export const SigningIn: Story = {
  args: {
    isPKPReady: false,
    hasLensAccount: false,
    isAuthenticating: true,
  }
}

/**
 * Connecting to Lens (loading state)
 */
export const ConnectingLens: Story = {
  args: {
    isPKPReady: true,
    hasLensAccount: false,
    isAuthenticating: true,
  }
}
