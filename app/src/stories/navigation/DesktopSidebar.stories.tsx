import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar'

const meta: Meta<typeof DesktopSidebar> = {
  title: 'Navigation/DesktopSidebar',
  component: DesktopSidebar,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      }
    },
    viewport: {
      defaultViewport: 'desktop'
    }
  },
  tags: ['autodocs'],
  argTypes: {
    activeTab: {
      control: 'select',
      options: ['home', 'study', 'search', 'wallet', 'profile']
    },
    onTabChange: { action: 'tab changed' },
    onDisconnect: { action: 'disconnect clicked' },
    onConnectWallet: { action: 'connect wallet clicked' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const HomeTab: Story = {
  args: {
    activeTab: 'home',
    isConnected: false
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background flex">
        <Story />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Main content area (Feed)</p>
        </div>
      </div>
    )
  ]
}

export const StudyTab: Story = {
  args: {
    activeTab: 'study',
    isConnected: false
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background flex">
        <Story />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Study page content</p>
        </div>
      </div>
    )
  ]
}

export const WalletTab: Story = {
  args: {
    activeTab: 'wallet',
    isConnected: false
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background flex">
        <Story />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Wallet page content</p>
        </div>
      </div>
    )
  ]
}

export const ProfileTab: Story = {
  args: {
    activeTab: 'profile',
    isConnected: false
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background flex">
        <Story />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Profile page</p>
        </div>
      </div>
    )
  ]
}

export const Connected: Story = {
  args: {
    activeTab: 'home',
    isConnected: true,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background flex">
        <Story />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Main content area</p>
        </div>
      </div>
    )
  ]
}

export const Disconnected: Story = {
  args: {
    activeTab: 'home',
    isConnected: false
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background flex">
        <Story />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Main content area</p>
        </div>
      </div>
    )
  ]
}

export const WithContent: Story = {
  args: {
    activeTab: 'home',
    isConnected: true,
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background flex">
        <Story />
        <div className="flex-1 ml-64 overflow-y-auto">
          <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold text-foreground">For You</h1>
            <div className="grid gap-4">
              <div className="h-48 bg-card rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Video Post 1</p>
              </div>
              <div className="h-48 bg-card rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Video Post 2</p>
              </div>
              <div className="h-48 bg-card rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Video Post 3</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  ]
}

export const AllTabs: Story = {
  render: () => {
    const [activeTab, setActiveTab] = React.useState<'home' | 'study' | 'search' | 'wallet' | 'profile'>('home')

    return (
      <div className="h-screen bg-background flex">
        <DesktopSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isConnected={true}
          walletAddress="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground mb-2">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</p>
            <p className="text-muted-foreground">Click tabs to navigate</p>
          </div>
        </div>
      </div>
    )
  }
}
