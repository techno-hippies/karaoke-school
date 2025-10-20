import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MobileFooter } from '@/components/navigation/MobileFooter'

const meta = {
  title: 'Navigation/MobileFooter',
  component: MobileFooter,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MobileFooter>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Mobile footer with Home tab active
 */
export const HomeActive: Story = {
  args: {
    activeTab: 'home',
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
}

/**
 * Mobile footer with Search tab active
 */
export const SearchActive: Story = {
  args: {
    activeTab: 'search',
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
}

/**
 * Mobile footer with Study tab active
 */
export const StudyActive: Story = {
  args: {
    activeTab: 'study',
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
}

/**
 * Mobile footer with Wallet tab active
 */
export const WalletActive: Story = {
  args: {
    activeTab: 'wallet',
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
}

/**
 * Mobile footer with Profile tab active
 */
export const ProfileActive: Story = {
  args: {
    activeTab: 'profile',
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
}

/**
 * Interactive mobile footer with state management
 */
export const Interactive = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'>('home')

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center text-foreground">
        <p className="text-2xl mb-2">Active Tab: {activeTab}</p>
        <p className="text-muted-foreground">Click tabs in the footer to navigate</p>
      </div>
      <MobileFooter activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
