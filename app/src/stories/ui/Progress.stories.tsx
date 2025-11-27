import type { Meta, StoryObj } from '@storybook/react-vite'
import { Progress } from '@/components/ui/progress'

const meta: Meta<typeof Progress> = {
  title: 'UI/Progress',
  component: Progress,
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
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 }
    },
    variant: {
      control: 'select',
      options: ['default', 'gradient', 'success', 'fire', 'gold']
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg']
    },
    animated: {
      control: 'boolean'
    }
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    )
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 0
  }
}

export const Quarter: Story = {
  args: {
    value: 25
  }
}

export const Half: Story = {
  args: {
    value: 50
  }
}

export const ThreeQuarters: Story = {
  args: {
    value: 75
  }
}

export const Complete: Story = {
  args: {
    value: 100
  }
}

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="text-foreground">66%</span>
      </div>
      <Progress value={66} />
    </div>
  )
}

export const ExerciseProgress: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Exercise 3 of 10</span>
          <span className="text-foreground">30%</span>
        </div>
        <Progress value={30} />
      </div>
    </div>
  )
}

/**
 * Gradient variants - vibrant fills for different contexts
 */
export const GradientVariants: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Default</span>
        <Progress value={60} />
      </div>
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Gradient (Primary)</span>
        <Progress value={60} variant="gradient" />
      </div>
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Success</span>
        <Progress value={60} variant="success" />
      </div>
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Fire (Recording)</span>
        <Progress value={60} variant="fire" />
      </div>
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Gold (Premium)</span>
        <Progress value={60} variant="gold" />
      </div>
    </div>
  )
}

/**
 * Size variants
 */
export const Sizes: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Small</span>
        <Progress value={50} size="sm" variant="gradient" />
      </div>
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Default</span>
        <Progress value={50} variant="gradient" />
      </div>
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Large</span>
        <Progress value={50} size="lg" variant="gradient" />
      </div>
    </div>
  )
}

/**
 * Animated shimmer effect - great for active/recording states
 */
export const AnimatedShimmer: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Recording in progress...</span>
        <Progress value={45} variant="fire" animated />
      </div>
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Processing...</span>
        <Progress value={70} variant="gradient" animated />
      </div>
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Almost there!</span>
        <Progress value={90} variant="success" animated size="lg" />
      </div>
    </div>
  )
}

/**
 * Karaoke session progress - real-world usage
 */
export const KaraokeSession: Story = {
  render: () => (
    <div className="space-y-6 p-4 rounded-2xl bg-card">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Line 4 of 7</span>
          <span className="text-foreground font-medium">57%</span>
        </div>
        <Progress value={57} variant="gradient" size="sm" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-white font-medium">🎤 Recording...</span>
          <span className="text-orange-400 font-medium">Live</span>
        </div>
        <Progress value={35} variant="fire" animated />
      </div>
    </div>
  )
}
