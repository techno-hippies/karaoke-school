import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthDialog } from '@/components/layout/AuthDialog'

const meta: Meta<typeof AuthDialog> = {
  title: 'Layout/AuthDialog',
  component: AuthDialog,
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
 * Initial state - user needs to choose between Create Account or Sign In
 */
export const Initial: Story = {
  args: {
    open: true,
    currentStep: 'idle',
    isAuthenticating: false,
    statusMessage: '',
    errorMessage: '',
    usernameAvailability: null,
    onOpenChange: () => {},
    onRegister: () => console.log('Show username input'),
    onRegisterWithUsername: () => {},
    onLogin: () => console.log('Start login'),
    onUsernameBack: () => {},
    onUsernameChange: (username: string) => console.log('Username changed:', username),
    walletConnectors: [],
    isWalletConnected: false,
    onConnectWallet: () => {},
    onWalletDisconnect: () => {},
  },
}

/**
 * Username Input - shown after clicking "Create Account"
 */
export const UsernameInput: Story = {
  args: {
    ...Initial.args,
    currentStep: 'username',
    onRegisterWithUsername: (username: string) => console.log('Register with username:', username),
    onUsernameBack: () => console.log('Back from username'),
  },
}

/**
 * Authenticating - first signature (WebAuthn + PKP)
 */
export const Authenticating: Story = {
  args: {
    ...Initial.args,
    currentStep: 'webauthn', // Internally mapped to processing
    isAuthenticating: true,
    statusMessage: 'Please create a passkey using your device...',
  },
}

/**
 * Complete - checkmark and "You're all set!" with Continue button
 */
export const Complete: Story = {
  args: {
    ...Initial.args,
    currentStep: 'complete',
  },
}

// Stories with wallet state
export const WalletSelection: Story = {
  args: {
    ...Initial.args,
    currentStep: 'idle', // Logic inside component sets view based on internal state, but here we just simulate props.
    // To test internal state transition to wallet-select, we'd need to click buttons in interaction test.
    // However, we can't force internal state 'wallet-select' via props in current implementation 
    // because view state is internal.
    // BUT, we can simulate the flow if we were using Controlled Component pattern for the View.
    // Current AuthDialog has internal state `view`. 
    // Ideally, for Storybook, we should be able to force a view.
  },
}
// NOTE: Since `AuthDialog` manages `view` internally, we can't easily force the "Wallet Selection" screen 
// via props alone without interaction. 
// The stories above represent states driven by `currentStep` prop which affects `view` via useEffect.
// But `wallet-select` is a purely internal UI state not mapped to `currentStep` context.
// Refactoring to lift `view` state or allow override would make it testable, 
// but for now we rely on interaction testing or manual testing.
