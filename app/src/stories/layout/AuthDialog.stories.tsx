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
    usernameAvailability: null,
    isPKPReady: false,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => console.log('Show username input'),
    onRegisterWithUsername: () => {},
    onLogin: () => console.log('Start login'),
    onUsernameBack: () => {},
    onUsernameChange: (username: string) => console.log('Username changed:', username),
    onConnectSocial: () => {},
  },
}

/**
 * Username Input - shown after clicking "Create Account"
 */
export const UsernameInput: Story = {
  args: {
    open: true,
    currentStep: 'username',
    isAuthenticating: false,
    authMode: 'register',
    statusMessage: '',
    errorMessage: '',
    usernameAvailability: null,
    isPKPReady: false,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onRegisterWithUsername: (username: string) => console.log('Register with username:', username),
    onLogin: () => {},
    onUsernameBack: () => console.log('Back from username'),
    onUsernameChange: (username: string) => console.log('Username changed:', username),
    onConnectSocial: () => {},
  },
}

/**
 * Username Input - Checking availability
 */
export const UsernameChecking: Story = {
  args: {
    open: true,
    currentStep: 'username',
    isAuthenticating: false,
    authMode: 'register',
    statusMessage: '',
    errorMessage: '',
    usernameAvailability: 'checking',
    isPKPReady: false,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onRegisterWithUsername: () => {},
    onLogin: () => {},
    onUsernameBack: () => {},
    onUsernameChange: (username: string) => console.log('Username changed:', username),
    onConnectSocial: () => {},
  },
}

/**
 * Username Input - Available
 */
export const UsernameAvailable: Story = {
  args: {
    open: true,
    currentStep: 'username',
    isAuthenticating: false,
    authMode: 'register',
    statusMessage: '',
    errorMessage: '',
    usernameAvailability: 'available',
    isPKPReady: false,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onRegisterWithUsername: () => {},
    onLogin: () => {},
    onUsernameBack: () => {},
    onUsernameChange: (username: string) => console.log('Username changed:', username),
    onConnectSocial: () => {},
  },
}

/**
 * Username Input - Not Available
 */
export const UsernameUnavailable: Story = {
  args: {
    open: true,
    currentStep: 'username',
    isAuthenticating: false,
    authMode: 'register',
    statusMessage: '',
    errorMessage: '',
    usernameAvailability: 'unavailable',
    isPKPReady: false,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onRegisterWithUsername: () => {},
    onLogin: () => {},
    onUsernameBack: () => {},
    onUsernameChange: (username: string) => console.log('Username changed:', username),
    onConnectSocial: () => {},
  },
}

/**
 * Username Input - Loading state (after clicking Continue)
 */
export const UsernameInputLoading: Story = {
  args: {
    open: true,
    currentStep: 'username',
    isAuthenticating: true,
    authMode: 'register',
    statusMessage: 'Creating your account...',
    errorMessage: '',
    usernameAvailability: 'available',
    isPKPReady: false,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onRegisterWithUsername: () => {},
    onLogin: () => {},
    onUsernameBack: () => {},
    onUsernameChange: (username: string) => console.log('Username changed:', username),
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
    usernameAvailability: null,
    isPKPReady: false,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onRegisterWithUsername: () => {},
    onLogin: () => {},
    onUsernameBack: () => {},
    onUsernameChange: (username: string) => console.log('Username changed:', username),
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
    usernameAvailability: null,
    isPKPReady: true,
    hasSocialAccount: false,
    onOpenChange: () => {},
    onRegister: () => {},
    onRegisterWithUsername: () => {},
    onLogin: () => {},
    onUsernameBack: () => {},
    onUsernameChange: (username: string) => console.log('Username changed:', username),
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
    usernameAvailability: null,
    isPKPReady: true,
    hasSocialAccount: true,
    onOpenChange: () => {},
    onRegister: () => {},
    onRegisterWithUsername: () => {},
    onLogin: () => {},
    onUsernameBack: () => {},
    onUsernameChange: (username: string) => console.log('Username changed:', username),
    onConnectSocial: () => {},
  },
}
