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
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Initial state - user needs to choose between Create Account or Sign In
 */
export const Initial: Story = {
  args: {
    open: true,
    currentStep: 'idle',
    isAuthenticating: false,
    authMode: null,
    statusMessage: '',
    errorMessage: '',
    isPKPReady: false,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onLogin: () => {},
    onConnectSocial: () => {},
  },
}

/**
 * Authenticating (loading state)
 */
export const Authenticating: Story = {
  args: {
    open: true,
    currentStep: 'webauthn',
    isAuthenticating: true,
    authMode: 'register',
    statusMessage: 'Please create a passkey using your device...',
    errorMessage: '',
    isPKPReady: false,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onLogin: () => {},
    onConnectSocial: () => {},
  },
}

/**
 * Need to connect social account
 */
export const NeedsSocial: Story = {
  args: {
    open: true,
    currentStep: 'complete',
    isAuthenticating: false,
    authMode: 'register',
    statusMessage: '',
    errorMessage: '',
    isPKPReady: true,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onLogin: () => {},
    onConnectSocial: () => {},
  },
}

/**
 * All authentication complete
 */
export const AllReady: Story = {
  args: {
    open: true,
    currentStep: 'complete',
    isAuthenticating: false,
    authMode: 'register',
    statusMessage: '',
    errorMessage: '',
    isPKPReady: true,
    hasSocialAccount: true,
    onOpenChange: () => {},
    onRegister: () => {},
    onLogin: () => {},
    onConnectSocial: () => {},
  },
}
