import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '@/components/ui/badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
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
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'gradient', 'success', 'fire', 'gold', 'purple', 'glow-primary', 'glow-success']
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
    <Badge variant="fire">
      🔥 Trending
    </Badge>
  )
}

/**
 * Gradient badges - vibrant, eye-catching status indicators
 */
export const GradientVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="gradient">Primary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="fire">Hot</Badge>
      <Badge variant="gold">Premium</Badge>
      <Badge variant="purple">New</Badge>
    </div>
  )
}

/**
 * Glowing badges - for extra emphasis
 */
export const GlowingBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Badge variant="glow-primary">Live</Badge>
      <Badge variant="glow-success">Perfect!</Badge>
    </div>
  )
}

/**
 * Karaoke-themed badges
 */
export const KaraokeBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="fire">🔥 5 Streak</Badge>
      <Badge variant="gold">⭐ Top 10%</Badge>
      <Badge variant="success">✓ Mastered</Badge>
      <Badge variant="gradient">🎤 Recording</Badge>
      <Badge variant="purple">✨ New Song</Badge>
    </div>
  )
}

/**
 * All variants comparison
 */
export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="gradient">Gradient</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="fire">Fire</Badge>
      <Badge variant="gold">Gold</Badge>
      <Badge variant="purple">Purple</Badge>
      <Badge variant="glow-primary">Glow</Badge>
      <Badge variant="glow-success">Glow Success</Badge>
    </div>
  )
}
