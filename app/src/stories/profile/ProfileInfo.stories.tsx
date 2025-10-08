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
  },
}

/**
 * With display name - shows both display name and username
 */
export const WithDisplayName: Story = {
  args: {
    username: 'alice.lens',
    displayName: 'Alice Johnson',
  },
}

/**
 * Verified account
 */
export const Verified: Story = {
  args: {
    username: 'vitalik.lens',
    displayName: 'Vitalik Buterin',
    isVerified: true,
  },
}

/**
 * New user with minimal info
 */
export const NewUser: Story = {
  args: {
    username: 'newuser.lens',
    displayName: 'New User',
  },
}

/**
 * Left aligned (desktop default)
 */
export const LeftAligned: Story = {
  args: {
    username: 'alice.lens',
    displayName: 'Alice Johnson',
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
    isVerified: true,
    alignment: 'center',
  },
}
