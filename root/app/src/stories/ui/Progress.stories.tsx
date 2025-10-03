import type { Meta, StoryObj } from '@storybook/react'
import { Progress } from '@/components/ui/progress'

const meta: Meta<typeof Progress> = {
  title: 'UI/Progress',
  component: Progress,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'oklch(0.145 0 0)' },
        { name: 'light', value: 'oklch(1 0 0)' }
      ]
    }
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 }
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
