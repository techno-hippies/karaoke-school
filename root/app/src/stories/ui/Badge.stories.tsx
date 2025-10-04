import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from '@/components/ui/badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
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
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline']
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Badge'
  }
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary'
  }
}

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive'
  }
}

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline'
  }
}

export const StatusBadges: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge>New</Badge>
      <Badge variant="secondary">Learning</Badge>
      <Badge variant="outline">Due</Badge>
    </div>
  )
}

export const TrendingBadge: Story = {
  render: () => (
    <Badge className="bg-brand-red hover:bg-brand-red/90">
      🔥 Trending
    </Badge>
  )
}
