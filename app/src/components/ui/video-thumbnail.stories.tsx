import type { Meta, StoryObj } from 'storybook-solidjs'
import { VideoThumbnail } from './video-thumbnail'

const meta: Meta<typeof VideoThumbnail> = {
  title: 'UI/VideoThumbnail',
  component: VideoThumbnail,
  tags: ['autodocs'],
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
    aspectRatio: {
      control: 'select',
      options: ['16/9', '9/16', '1/1', '4/3'],
    },
    showPlayButton: { control: 'boolean' },
    duration: { control: 'text' },
    class: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof VideoThumbnail>

export const Square: Story = {
  args: {
    src: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
    aspectRatio: '1/1',
    class: 'w-48',
  },
}

export const Landscape: Story = {
  args: {
    src: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
    aspectRatio: '16/9',
    class: 'w-64',
  },
}

export const Portrait: Story = {
  args: {
    src: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
    aspectRatio: '9/16',
    class: 'w-32',
  },
}

export const WithDuration: Story = {
  args: {
    src: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
    aspectRatio: '16/9',
    duration: '3:45',
    class: 'w-64',
  },
}

export const NoPlayButton: Story = {
  args: {
    src: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
    aspectRatio: '16/9',
    showPlayButton: false,
    class: 'w-64',
  },
}

export const NoImage: Story = {
  args: {
    aspectRatio: '16/9',
    duration: '2:30',
    class: 'w-64',
  },
}

export const FeedGrid: Story = {
  render: () => (
    <div class="grid grid-cols-2 gap-2 max-w-sm">
      <VideoThumbnail
        src="https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a"
        aspectRatio="9/16"
        duration="0:58"
      />
      <VideoThumbnail
        src="https://i.scdn.co/image/ab67616d0000b273bca9e64a0bfd1a85c2f05c9f"
        aspectRatio="9/16"
        duration="1:02"
      />
      <VideoThumbnail
        src="https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce"
        aspectRatio="9/16"
        duration="0:45"
      />
      <VideoThumbnail
        src="https://i.scdn.co/image/ab67616d0000b2736ca5c90113b30c3c43ffb8f4"
        aspectRatio="9/16"
        duration="0:52"
      />
    </div>
  ),
}
