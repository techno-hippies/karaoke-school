import type { Meta, StoryObj } from '@storybook/react-vite'
import { EditProfileView } from '@/components/profile/EditProfileView'

const meta = {
  title: 'Profile/EditProfileView',
  component: EditProfileView,
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
} satisfies Meta<typeof EditProfileView>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Complete profile with all fields filled
 */
export const Complete: Story = {
  args: {
    profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane',
    displayName: 'Jane Doe',
    username: 'janedoe.lens',
    bio: 'Photographer based in NYC. Coffee addict.',
    socialLinks: {
      twitter: 'https://twitter.com/janedoe',
      instagram: 'https://instagram.com/janedoe',
      website: 'https://janedoe.com',
    },
    onPhotoChange: (file) => console.log('Photo changed:', file),
    onDisplayNameChange: (value) => console.log('Name changed:', value),
    onBioChange: (value) => console.log('Bio changed:', value),
    onSocialLinkChange: (platform, url) => console.log('Social link changed:', platform, url),
    onSave: () => console.log('Save'),
    onCancel: () => console.log('Cancel'),
  },
}

/**
 * Minimal profile - new user
 */
export const Minimal: Story = {
  args: {
    displayName: 'New User',
    username: 'newuser.lens',
    bio: '',
    socialLinks: {},
    onPhotoChange: (file) => console.log('Photo changed:', file),
    onDisplayNameChange: (value) => console.log('Name changed:', value),
    onBioChange: (value) => console.log('Bio changed:', value),
    onSocialLinkChange: (platform, url) => console.log('Social link changed:', platform, url),
    onSave: () => console.log('Save'),
    onCancel: () => console.log('Cancel'),
  },
}

/**
 * Partial social links
 */
export const PartialSocial: Story = {
  args: {
    profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
    displayName: 'Alice Johnson',
    username: 'alice.lens',
    bio: 'Product designer & creative technologist',
    socialLinks: {
      twitter: 'https://twitter.com/alice',
    },
    onPhotoChange: (file) => console.log('Photo changed:', file),
    onDisplayNameChange: (value) => console.log('Name changed:', value),
    onBioChange: (value) => console.log('Bio changed:', value),
    onSocialLinkChange: (platform, url) => console.log('Social link changed:', platform, url),
    onSave: () => console.log('Save'),
    onCancel: () => console.log('Cancel'),
  },
}

/**
 * All social links filled
 */
export const AllSocial: Story = {
  args: {
    profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
    displayName: 'Bob Smith',
    username: 'bob.lens',
    bio: 'Building cool stuff on Lens',
    socialLinks: {
      twitter: 'https://twitter.com/bob',
      instagram: 'https://instagram.com/bob',
      website: 'https://bob.dev',
    },
    onPhotoChange: (file) => console.log('Photo changed:', file),
    onDisplayNameChange: (value) => console.log('Name changed:', value),
    onBioChange: (value) => console.log('Bio changed:', value),
    onSocialLinkChange: (platform, url) => console.log('Social link changed:', platform, url),
    onSave: () => console.log('Save'),
    onCancel: () => console.log('Cancel'),
  },
}

/**
 * No social links
 */
export const NoSocial: Story = {
  args: {
    profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
    displayName: 'Charlie Davis',
    username: 'charlie.lens',
    bio: 'Content creator',
    socialLinks: {},
    onPhotoChange: (file) => console.log('Photo changed:', file),
    onDisplayNameChange: (value) => console.log('Name changed:', value),
    onBioChange: (value) => console.log('Bio changed:', value),
    onSocialLinkChange: (platform, url) => console.log('Social link changed:', platform, url),
    onSave: () => console.log('Save'),
    onCancel: () => console.log('Cancel'),
  },
}
