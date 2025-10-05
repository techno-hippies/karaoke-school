import type { Meta, StoryObj } from '@storybook/react'
import { PageLayout, ModalPageLayout, SettingsPageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof PageLayout> = {
  title: 'Layout/PageLayout',
  component: PageLayout,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    onBack: { action: 'back clicked' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: (
      <div className="p-6">
        <p className="text-muted-foreground">Page content goes here</p>
      </div>
    )
  }
}

export const WithTitle: Story = {
  args: {
    title: 'Page Title',
    children: (
      <div className="p-6 space-y-4">
        <p className="text-foreground">This is a page with a title.</p>
        <p className="text-muted-foreground">Content can scroll independently.</p>
      </div>
    )
  }
}

export const WithTitleAndSubtitle: Story = {
  args: {
    title: 'Study Session',
    subtitle: '5 cards remaining',
    children: (
      <div className="p-6">
        <div className="bg-card rounded-lg p-6">
          <p className="text-foreground">Exercise content</p>
        </div>
      </div>
    )
  }
}

export const WithBackButton: Story = {
  args: {
    title: 'Song Details',
    showBackButton: true,
    children: (
      <div className="p-6 space-y-4">
        <div className="bg-card rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Heat of the Night</h2>
          <p className="text-muted-foreground">Scarlett X</p>
        </div>
      </div>
    )
  }
}

export const WithHeaderAction: Story = {
  args: {
    title: 'Settings',
    showBackButton: true,
    headerAction: (
      <Button size="sm">Save</Button>
    ),
    children: (
      <div className="p-6">
        <p className="text-muted-foreground">Settings content</p>
      </div>
    )
  }
}

export const WithFooter: Story = {
  args: {
    title: 'Exercise',
    showBackButton: true,
    footer: (
      <div className="p-4 flex gap-2">
        <Button variant="outline" className="flex-1">Skip</Button>
        <Button className="flex-1">Submit</Button>
      </div>
    ),
    children: (
      <div className="p-6">
        <div className="bg-card rounded-lg p-6">
          <p className="text-foreground">Exercise question here</p>
        </div>
      </div>
    )
  }
}

export const ScrollingContent: Story = {
  args: {
    title: 'Long Content',
    showBackButton: true,
    children: (
      <div className="p-6 space-y-4">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="bg-card rounded-lg p-6">
            <p className="text-foreground">Content block {i + 1}</p>
          </div>
        ))}
      </div>
    )
  }
}

export const ModalStyle: Story = {
  render: () => (
    <ModalPageLayout
      title="Choose Username"
      children={
        <div className="p-6">
          <p className="text-muted-foreground mb-4">Your username must be at least 7 characters.</p>
          <input
            type="text"
            placeholder="Enter username..."
            className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground"
          />
        </div>
      }
      footer={
        <div className="p-4">
          <Button className="w-full">Continue</Button>
        </div>
      }
    />
  )
}

export const SettingsStyle: Story = {
  render: () => (
    <SettingsPageLayout
      title="Account Settings"
      showBackButton={true}
      children={
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <input
              type="text"
              defaultValue="karaokeschool"
              className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              defaultValue="user@example.com"
              className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground"
            />
          </div>
        </div>
      }
      footer={
        <div className="p-4">
          <Button className="w-full">Save Changes</Button>
        </div>
      }
    />
  )
}

export const MobileView: Story = {
  args: {
    title: 'Mobile Page',
    showBackButton: true,
    children: (
      <div className="p-4">
        <p className="text-muted-foreground">Content optimized for mobile</p>
      </div>
    )
  },
  parameters: {
    viewport: {
      defaultViewport: 'iphone14'
    }
  }
}
