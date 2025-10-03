import type { Meta, StoryObj } from '@storybook/react'
import { MobileFooter } from '@/components/navigation/MobileFooter'

const meta: Meta<typeof MobileFooter> = {
  title: 'Navigation/MobileFooter',
  component: MobileFooter,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: 'oklch(0.05 0 0)' }]
    },
    viewport: {
      defaultViewport: 'iphone14'
    }
  },
  tags: ['autodocs'],
  argTypes: {
    activeTab: {
      control: 'select',
      options: ['home', 'study', 'post', 'inbox', 'profile']
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

export const Post: Story = {
  args: {
    activeTab: 'post'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Create post page</p>
        </div>
        <Story />
      </div>
    )
  ]
}

export const Inbox: Story = {
  args: {
    activeTab: 'inbox'
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Inbox page</p>
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
