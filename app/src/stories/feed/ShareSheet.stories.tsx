import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShareSheet } from '@/components/feed/ShareSheet'

const meta = {
  title: 'Feed/ShareSheet',
  component: ShareSheet,
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
} satisfies Meta<typeof ShareSheet>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default share sheet
 */
export const Default: Story = {
  args: {
    open: true,
    postUrl: 'https://example.com/video/123',
    postDescription: 'Check out this amazing karaoke performance!',
    onOpenChange: (open) => console.log('Sheet open:', open),
    onCopyLink: () => console.log('Link copied to clipboard'),
    onDownload: () => console.log('Download video'),
  },
}
