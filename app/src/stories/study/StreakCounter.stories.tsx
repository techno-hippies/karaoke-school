import type { Meta, StoryObj } from '@storybook/react-vite'
import { StreakCounter } from '@/components/study/StreakCounter'

const meta: Meta<typeof StreakCounter> = {
  title: 'Study/StreakCounter',
  component: StreakCounter,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'oklch(0.145 0 0)' },
        { name: 'light', value: 'oklch(1 0 0)' },
      ],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    streak: {
      control: { type: 'number', min: 0, max: 365 },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    streak: 5,
  },
}

export const ZeroStreak: Story = {
  args: {
    streak: 0,
  },
}

export const LongStreak: Story = {
  args: {
    streak: 42,
  },
}

export const MaxMultiplier: Story = {
  name: '10+ Days (2x Multiplier)',
  args: {
    streak: 10,
  },
}
