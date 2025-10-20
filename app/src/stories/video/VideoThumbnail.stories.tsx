import type { Meta, StoryObj } from '@storybook/react-vite'
import { VideoThumbnail } from '@/components/video/VideoThumbnail'

const meta = {
  title: 'Video/VideoThumbnail',
  component: VideoThumbnail,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VideoThumbnail>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default video thumbnail
 */
export const Default: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/400/711',
    username: 'dance_queen',
    onClick: () => console.log('Video clicked'),
  },
}

/**
 * Video by popular creator
 */
export const PopularCreator: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/401/711',
    username: 'viral_star',
    onClick: () => console.log('Video clicked'),
  },
}

/**
 * Video with long username (truncated)
 */
export const LongUsername: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/403/711',
    username: 'this_is_a_very_long_username_that_will_be_truncated',
    onClick: () => console.log('Video clicked'),
  },
}

/**
 * Video by new creator
 */
export const NewCreator: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/404/711',
    username: 'new_creator',
    onClick: () => console.log('Video clicked'),
  },
}
