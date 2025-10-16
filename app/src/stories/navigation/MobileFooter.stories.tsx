import type { Meta, StoryObj } from '@storybook/react'
import { MobileFooter } from '@/components/navigation/MobileFooter'

const meta: Meta<typeof MobileFooter> = {
  title: 'Navigation/MobileFooter',
  component: MobileFooter,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      }
    },
    viewport: {
      defaultViewport: 'iphone14'
    }
  },
  tags: ['autodocs'],
  argTypes: {
    activeTab: {
      control: 'select',
      options: ['home', 'study', 'search', 'wallet', 'profile']
    },
    onTabChange: { action: 'tab changed' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Home: Story = {
  args: {
    activeTab: 'home'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Feed content here</p>
        </div>
        <Story />
      </div>
    )
  ]
}

export const Study: Story = {
  args: {
    activeTab: 'study'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Study page content</p>
        </div>
        <Story />
      </div>
    )
  ]
}

export const Search: Story = {
  args: {
    activeTab: 'search'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Search page</p>
        </div>
        <Story />
      </div>
    )
  ]
}

export const Wallet: Story = {
  args: {
    activeTab: 'wallet'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Wallet page</p>
        </div>
        <Story />
      </div>
    )
  ]
}

export const Profile: Story = {
  args: {
    activeTab: 'profile'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Profile page</p>
        </div>
        <Story />
      </div>
    )
  ]
}

export const WithContent: Story = {
  args: {
    activeTab: 'home'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background overflow-hidden">
        <div className="h-full pb-16 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="h-32 bg-card rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Video Post 1</p>
            </div>
            <div className="h-32 bg-card rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Video Post 2</p>
            </div>
            <div className="h-32 bg-card rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Video Post 3</p>
            </div>
          </div>
        </div>
        <Story />
      </div>
    )
  ]
}
