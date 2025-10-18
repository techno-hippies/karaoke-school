import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileActions } from '@/components/profile/ProfileActions'

const meta = {
  title: 'Profile/ProfileActions',
  component: ProfileActions,
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
} satisfies Meta<typeof ProfileActions>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Own profile - shows Edit button
 */
export const OwnProfile: Story = {
  args: {
    isOwnProfile: true,
    onEditClick: () => console.log('Edit profile'),
  },
}

/**
 * Other profile - not following
 */
export const NotFollowing: Story = {
  args: {
    isOwnProfile: false,
    isFollowing: false,
    onFollowClick: () => console.log('Enroll'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}

/**
 * Other profile - already following
 */
export const Following: Story = {
  args: {
    isOwnProfile: false,
    isFollowing: true,
    onFollowClick: () => console.log('Unfollow'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}

/**
 * Follow loading state
 */
export const FollowLoading: Story = {
  args: {
    isOwnProfile: false,
    isFollowing: false,
    isFollowLoading: true,
    onFollowClick: () => console.log('Enroll'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}

/**
 * Unfollow loading state
 */
export const UnfollowLoading: Story = {
  args: {
    isOwnProfile: false,
    isFollowing: true,
    isFollowLoading: true,
    onFollowClick: () => console.log('Unfollow'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}
