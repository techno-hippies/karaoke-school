import type { Meta, StoryObj } from '@storybook/react-vite'
import { SocialLinkItem } from '@/components/profile/SocialLinkItem'

const meta = {
  title: 'Profile/SocialLinkItem',
  component: SocialLinkItem,
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
} satisfies Meta<typeof SocialLinkItem>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Empty Twitter link - shows "Add Twitter"
 */
export const EmptyTwitter: Story = {
  args: {
    platform: 'twitter',
    onAdd: () => console.log('Add Twitter'),
  },
}

/**
 * Empty Instagram link
 */
export const EmptyInstagram: Story = {
  args: {
    platform: 'instagram',
    onAdd: () => console.log('Add Instagram'),
  },
}

/**
 * Empty Website link
 */
export const EmptyWebsite: Story = {
  args: {
    platform: 'website',
    onAdd: () => console.log('Add Website'),
  },
}

/**
 * Filled Twitter link - shows input with remove button
 */
export const FilledTwitter: Story = {
  args: {
    platform: 'twitter',
    url: 'https://twitter.com/janedoe',
    onChange: (url) => console.log('Changed:', url),
    onRemove: () => console.log('Remove Twitter'),
  },
}

/**
 * Filled Instagram link
 */
export const FilledInstagram: Story = {
  args: {
    platform: 'instagram',
    url: 'https://instagram.com/janedoe',
    onChange: (url) => console.log('Changed:', url),
    onRemove: () => console.log('Remove Instagram'),
  },
}

/**
 * Filled Website link
 */
export const FilledWebsite: Story = {
  args: {
    platform: 'website',
    url: 'https://janedoe.com',
    onChange: (url) => console.log('Changed:', url),
    onRemove: () => console.log('Remove Website'),
  },
}

/**
 * All social links example
 */
export const AllLinks: Story = {
  render: () => (
    <div className="space-y-3">
      <SocialLinkItem
        platform="twitter"
        url="https://twitter.com/janedoe"
        onChange={(url) => console.log('Twitter:', url)}
        onRemove={() => console.log('Remove Twitter')}
      />
      <SocialLinkItem
        platform="instagram"
        url="https://instagram.com/janedoe"
        onChange={(url) => console.log('Instagram:', url)}
        onRemove={() => console.log('Remove Instagram')}
      />
      <SocialLinkItem
        platform="website"
        onAdd={() => console.log('Add Website')}
      />
    </div>
  ),
}
