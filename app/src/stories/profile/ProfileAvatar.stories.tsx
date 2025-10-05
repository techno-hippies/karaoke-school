import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileAvatar } from '@/components/profile/ProfileAvatar'

const meta = {
  title: 'Profile/ProfileAvatar',
  component: ProfileAvatar,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileAvatar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default avatar - medium size
 */
export const Default: Story = {
  args: {
    src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=felix',
    alt: 'Felix',
  },
}

/**
 * Small size - used in comments or compact views
 */
export const Small: Story = {
  args: {
    src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=felix',
    alt: 'Felix',
    size: 'sm',
  },
}

/**
 * Large size - used in profile headers
 */
export const Large: Story = {
  args: {
    src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=felix',
    alt: 'Felix',
    size: 'lg',
  },
}

/**
 * Fallback state when image fails to load
 */
export const Fallback: Story = {
  args: {
    src: 'https://invalid-url.com/image.jpg',
    alt: 'Alice',
    size: 'lg',
  },
}

/**
 * Different seeds for variety
 */
export const Variety: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <ProfileAvatar
        src="https://api.dicebear.com/7.x/avataaars/svg?seed=felix"
        alt="Felix"
        size="lg"
      />
      <ProfileAvatar
        src="https://api.dicebear.com/7.x/avataaars/svg?seed=alice"
        alt="Alice"
        size="lg"
      />
      <ProfileAvatar
        src="https://api.dicebear.com/7.x/avataaars/svg?seed=bob"
        alt="Bob"
        size="lg"
      />
    </div>
  ),
}
