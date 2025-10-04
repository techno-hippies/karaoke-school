import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileHeader } from '@/components/profile/ProfileHeader'

const meta = {
  title: 'Profile/ProfileHeader',
  component: ProfileHeader,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileHeader>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Own profile - shows Edit button
 */
export const OwnProfile: Story = {
  args: {
    username: 'alice.lens',
    displayName: 'Alice Johnson',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
    bio: 'Product designer & creative technologist 🎨',
    following: 892,
    followers: 1250,
    isVerified: true,
    isOwnProfile: true,
    onEditClick: () => console.log('Edit profile'),
  },
}

/**
 * Other profile - not following
 */
export const OtherProfileNotFollowing: Story = {
  args: {
    username: 'bob.lens',
    displayName: 'Bob Smith',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
    bio: 'Building cool stuff on Lens Protocol',
    following: 234,
    followers: 5670,
    isVerified: false,
    isOwnProfile: false,
    isFollowing: false,
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}

/**
 * Other profile - already following
 */
export const OtherProfileFollowing: Story = {
  args: {
    username: 'charlie.lens',
    displayName: 'Charlie Davis',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
    bio: 'Content creator | Photographer | Travel enthusiast',
    following: 1500,
    followers: 125000,
    isVerified: true,
    isOwnProfile: false,
    isFollowing: true,
    onFollowClick: () => console.log('Unfollow'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}

/**
 * Popular verified user
 */
export const PopularUser: Story = {
  args: {
    username: 'vitalik.lens',
    displayName: 'Vitalik Buterin',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vitalik',
    bio: 'Ethereum co-founder',
    following: 5000,
    followers: 2500000,
    isVerified: true,
    isOwnProfile: false,
    isFollowing: false,
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}

/**
 * New user with minimal info
 */
export const NewUser: Story = {
  args: {
    username: 'newuser.lens',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=newuser',
    following: 0,
    followers: 0,
    isVerified: false,
    isOwnProfile: true,
    onEditClick: () => console.log('Edit profile'),
  },
}

/**
 * No bio
 */
export const NoBio: Story = {
  args: {
    username: 'diana.lens',
    displayName: 'Diana Lee',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana',
    following: 456,
    followers: 789,
    isVerified: false,
    isOwnProfile: false,
    isFollowing: false,
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}

/**
 * Long bio
 */
export const LongBio: Story = {
  args: {
    username: 'explorer.lens',
    displayName: 'World Explorer',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=explorer',
    bio: 'Professional photographer and videographer sharing my journey through stunning landscapes and urban exploration. Follow for daily inspiration, behind-the-scenes content, and travel tips from around the world.',
    following: 3200,
    followers: 456000,
    isVerified: true,
    isOwnProfile: false,
    isFollowing: true,
    onFollowClick: () => console.log('Unfollow'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}

/**
 * Loading state - following in progress
 */
export const FollowLoading: Story = {
  args: {
    username: 'frank.lens',
    displayName: 'Frank Miller',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=frank',
    bio: 'Developer building on Web3',
    following: 678,
    followers: 2340,
    isVerified: false,
    isOwnProfile: false,
    isFollowing: false,
    isFollowLoading: true,
    onFollowClick: () => console.log('Follow'),
    onMessageClick: () => console.log('Message'),
    onMoreClick: () => console.log('More'),
  },
}
