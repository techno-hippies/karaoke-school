import type { Meta, StoryObj } from '@storybook/react-vite'
import { LitAuthModalView } from '@/components/auth/LitAuthModalView'
import { useState } from 'react'

const meta = {
  title: 'Auth/LitAuthModal',
  component: LitAuthModalView,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Controls whether the modal is open',
    },
    mode: {
      control: 'select',
      options: ['signup', 'login'],
      description: 'Auth mode',
    },
    isLoading: {
      control: 'boolean',
      description: 'Loading state',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
  },
} satisfies Meta<typeof LitAuthModalView>

export default meta
type Story = StoryObj<typeof meta>

export const SignUp: Story = {
  args: {
    isOpen: true,
    mode: 'signup',
    onClose: () => console.log('Modal closed'),
    onSignUpWithDevice: () => console.log('Sign up with device'),
    onConnectWallet: () => console.log('Connect wallet'),
    onSwitchMode: () => console.log('Switch mode'),
  },
}

export const Login: Story = {
  args: {
    isOpen: true,
    mode: 'login',
    onClose: () => console.log('Modal closed'),
    onSignInWithDevice: () => console.log('Sign in with device'),
    onConnectWallet: () => console.log('Connect wallet'),
    onSwitchMode: () => console.log('Switch mode'),
  },
}

export const Loading: Story = {
  args: {
    isOpen: true,
    mode: 'signup',
    isLoading: true,
    onClose: () => console.log('Modal closed'),
  },
}

export const WithError: Story = {
  args: {
    isOpen: true,
    mode: 'login',
    error: 'Authentication failed. Please try again.',
    onClose: () => console.log('Modal closed'),
  },
}

export const Interactive: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    const [mode, setMode] = useState<'signup' | 'login'>('signup')
    const [isLoading, setIsLoading] = useState(false)
    
    const handleAuth = () => {
      setIsLoading(true)
      setTimeout(() => {
        setIsLoading(false)
        setIsOpen(false)
        alert(mode === 'signup' ? 'Signed up successfully!' : 'Logged in successfully!')
      }, 2000)
    }
    
    return (
      <div>
        <button 
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-white text-black rounded-lg hover:bg-neutral-200"
        >
          Open Auth Modal
        </button>
        <LitAuthModalView 
          isOpen={isOpen} 
          onClose={() => setIsOpen(false)}
          mode={mode}
          isLoading={isLoading}
          onSignUpWithDevice={handleAuth}
          onSignInWithDevice={handleAuth}
          onConnectWallet={handleAuth}
          onSwitchMode={() => setMode(mode === 'signup' ? 'login' : 'signup')}
        />
      </div>
    )
  },
}