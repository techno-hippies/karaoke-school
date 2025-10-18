import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileStats } from '@/components/profile/ProfileStats'

const meta = {
  title: 'Profile/ProfileStats',
  component: ProfileStats,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileStats>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default stats - moderate numbers
 */
export const Default: Story = {
  args: {
    following: 892,
    followers: 1250,
  },
}

/**
 * New user - low numbers
 */
export const NewUser: Story = {
  args: {
    following: 12,
    followers: 5,
  },
}

/**
 * Popular user - K suffixes
 */
export const Popular: Story = {
  args: {
    following: 1200,
    followers: 125000,
  },
}

/**
 * Very popular - M suffixes
 */
export const VeryPopular: Story = {
  args: {
    following: 5000,
    followers: 2500000,
  },
}

/**
 * Zero students (new account)
 */
export const ZeroStudents: Story = {
  args: {
    following: 0,
    followers: 0,
  },
}

/**
 * Large numbers
 */
export const LargeNumbers: Story = {
  args: {
    following: 9999999,
    followers: 15600000,
  },
}
