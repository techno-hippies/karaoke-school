import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfilePhotoUpload } from '@/components/profile/ProfilePhotoUpload'

const meta = {
  title: 'Profile/ProfilePhotoUpload',
  component: ProfilePhotoUpload,
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
} satisfies Meta<typeof ProfilePhotoUpload>

export default meta
type Story = StoryObj<typeof meta>

/**
 * With existing photo
 */
export const WithPhoto: Story = {
  args: {
    currentPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane',
    onPhotoChange: (file) => console.log('Photo changed:', file),
  },
}

/**
 * No photo - shows placeholder with camera icon
 */
export const NoPhoto: Story = {
  args: {
    onPhotoChange: (file) => console.log('Photo changed:', file),
  },
}
