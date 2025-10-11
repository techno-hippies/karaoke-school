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
 * Authenticating - first signature (WebAuthn + PKP)
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
 * Finalizing - after 2nd signature, before completion
 */
export const Finalizing: Story = {
  args: {
    open: true,
    currentStep: 'social',
    isAuthenticating: true,
    authMode: 'register',
    statusMessage: 'Finalizing...',
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
 * Complete - checkmark and "You're all set!" with Continue button
 */
export const Complete: Story = {
  args: {
    open: true,
    currentStep: 'complete',
    isAuthenticating: false,
    authMode: null,
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
