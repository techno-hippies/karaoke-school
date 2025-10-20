import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar'

const meta = {
  title: 'Navigation/DesktopSidebar',
  component: DesktopSidebar,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DesktopSidebar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Desktop sidebar with Home tab active - not connected
 */
export const HomeNotConnected: Story = {
  args: {
    activeTab: 'home',
    isConnected: false,
    onTabChange: (tab) => console.log('Tab changed:', tab),
    onConnectWallet: () => console.log('Connect wallet clicked'),
  },
}

/**
 * Desktop sidebar with Home tab active - connected
 */
export const HomeConnected: Story = {
  args: {
    activeTab: 'home',
    isConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    onTabChange: (tab) => console.log('Tab changed:', tab),
    onConnectWallet: () => console.log('Connect wallet clicked'),
  },
}

/**
 * Desktop sidebar with Search tab active
 */
export const SearchActive: Story = {
  args: {
    activeTab: 'search',
    isConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
}

/**
 * Desktop sidebar with Study tab active
 */
export const StudyActive: Story = {
  args: {
    activeTab: 'study',
    isConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
}

/**
 * Desktop sidebar with Wallet tab active
 */
export const WalletActive: Story = {
  args: {
    activeTab: 'wallet',
    isConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
}

/**
 * Desktop sidebar with Profile tab active
 */
export const ProfileActive: Story = {
  args: {
    activeTab: 'profile',
    isConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
}

/**
 * Interactive desktop sidebar with state management
 */
export const Interactive = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'>('home')
  const [isConnected, setIsConnected] = useState(false)

  return (
    <div className="h-screen flex bg-background">
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isConnected={isConnected}
        walletAddress={isConnected ? '0x1234567890abcdef1234567890abcdef12345678' : undefined}
        onConnectWallet={() => setIsConnected(true)}
      />
      <div className="flex-1 flex items-center justify-center ml-80">
        <div className="text-center text-foreground">
          <p className="text-2xl mb-2">Active Tab: {activeTab}</p>
          <p className="text-muted-foreground mb-4">
            Wallet: {isConnected ? 'Connected' : 'Not Connected'}
          </p>
          {isConnected && (
            <button
              onClick={() => setIsConnected(false)}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-full"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
