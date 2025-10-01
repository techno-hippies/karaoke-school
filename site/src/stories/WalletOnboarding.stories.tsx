import type { Meta, StoryObj } from '@storybook/react-vite'
import { WalletOnboardingModal } from '@/components/onboarding/WalletOnboardingModal'
import { useState } from 'react'

const meta = {
  title: 'Onboarding/WalletOnboardingModal',
  component: WalletOnboardingModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof WalletOnboardingModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(true)
    
    return (
      <WalletOnboardingModal
        open={open}
        onOpenChange={setOpen}
        onConnectWithJoyID={() => {
          console.log('Connect with JoyID clicked')
          setOpen(false)
        }}
        onShowOtherOptions={() => {
          console.log('Other options clicked')
          setOpen(false)
        }}
      />
    )
  },
}

export const WithTrigger: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          Connect Wallet
        </button>
        <WalletOnboardingModal
          open={open}
          onOpenChange={setOpen}
          onConnectWithJoyID={() => {
            console.log('Connect with JoyID clicked')
            setOpen(false)
          }}
          onShowOtherOptions={() => {
            console.log('Other options clicked')
            setOpen(false)
          }}
        />
      </>
    )
  },
}