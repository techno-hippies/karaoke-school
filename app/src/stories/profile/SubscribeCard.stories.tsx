import type { Meta, StoryObj } from '@storybook/react-vite'
import { SubscribeCard } from '@/components/profile/SubscribeCard'

const meta = {
  title: 'Profile/SubscribeCard',
  component: SubscribeCard,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SubscribeCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default subscribe card
 */
export const Default: Story = {
  args: {
    username: 'singer_star',
    onSubscribe: () => console.log('Subscribe clicked'),
  },
}

/**
 * With custom avatar
 */
export const WithAvatar: Story = {
  args: {
    username: 'viral_sensation',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=viral_sensation',
    onSubscribe: () => console.log('Subscribe clicked'),
  },
}

/**
 * Different pricing
 */
export const DifferentPrice: Story = {
  args: {
    username: 'premium_artist',
    price: '$9.99/month',
    onSubscribe: () => console.log('Subscribe clicked'),
  },
}

/**
 * Long username
 */
export const LongUsername: Story = {
  args: {
    username: 'super_long_username_that_might_wrap_around',
    onSubscribe: () => console.log('Subscribe clicked'),
  },
}

/**
 * As it appears in video overlay (with dark background)
 */
export const InVideoOverlay: Story = {
  args: {
    username: 'billboard_artist',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=billboard_artist',
    onSubscribe: () => console.log('Subscribe clicked'),
  },
  decorators: [
    (Story) => (
      <div className="relative w-[400px] h-[600px] bg-gradient-to-br from-purple-900 to-pink-900 rounded-lg overflow-hidden">
        {/* Simulated video thumbnail */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center">
          <Story />
        </div>
      </div>
    ),
  ],
}
