import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileInfo } from '@/components/profile/ProfileInfo'

const meta = {
  title: 'Profile/ProfileInfo',
  component: ProfileInfo,
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
} satisfies Meta<typeof ProfileInfo>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Username only - no display name
 */
export const UsernameOnly: Story = {
  args: {
    username: 'alice.lens',
    bio: 'Building in public 🚀',
  },
}

/**
 * With display name - shows both display name and username
 */
export const WithDisplayName: Story = {
  args: {
    username: 'alice.lens',
    displayName: 'Alice Johnson',
    bio: 'Product designer & creative technologist',
  },
}

/**
 * Verified account
 */
export const Verified: Story = {
  args: {
    username: 'vitalik.lens',
    displayName: 'Vitalik Buterin',
    bio: 'Ethereum co-founder',
    isVerified: true,
  },
}

/**
 * No bio
 */
export const NoBio: Story = {
  args: {
    username: 'newuser.lens',
    displayName: 'New User',
  },
}

/**
 * Long bio
 */
export const LongBio: Story = {
  args: {
    username: 'creator.lens',
    displayName: 'Content Creator',
    bio: 'Professional photographer and videographer sharing my journey through stunning landscapes and urban exploration. Follow for daily inspiration and behind-the-scenes content.',
    isVerified: true,
  },
}

/**
 * Left aligned (desktop default)
 */
export const LeftAligned: Story = {
  args: {
    username: 'alice.lens',
    displayName: 'Alice Johnson',
    bio: 'Building in public 🚀',
    isVerified: true,
    alignment: 'left',
  },
}

/**
 * Center aligned (mobile default)
 */
export const CenterAligned: Story = {
  args: {
    username: 'alice.lens',
    displayName: 'Alice Johnson',
    bio: 'Building in public 🚀',
    isVerified: true,
    alignment: 'center',
  },
}
