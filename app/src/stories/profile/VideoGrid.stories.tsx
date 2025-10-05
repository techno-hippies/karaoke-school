import type { Meta, StoryObj } from '@storybook/react-vite'
import { VideoGrid, type Video } from '@/components/profile/VideoGrid'

const meta = {
  title: 'Profile/VideoGrid',
  component: VideoGrid,
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
} satisfies Meta<typeof VideoGrid>

export default meta
type Story = StoryObj<typeof meta>

const mockVideos: Video[] = Array.from({ length: 18 }, (_, i) => ({
  id: `video-${i}`,
  thumbnailUrl: `https://picsum.photos/400/711?random=${i}`,
  playCount: Math.floor(Math.random() * 5000000),
}))

/**
 * Default grid with multiple videos
 */
export const Default: Story = {
  args: {
    videos: mockVideos,
    onVideoClick: (video) => console.log('Clicked video:', video.id),
  },
}

/**
 * Few videos - shows partial grid
 */
export const FewVideos: Story = {
  args: {
    videos: mockVideos.slice(0, 5),
    onVideoClick: (video) => console.log('Clicked video:', video.id),
  },
}

/**
 * Empty state - no videos
 */
export const Empty: Story = {
  args: {
    videos: [],
  },
}

/**
 * Loading state - skeleton grid
 */
export const Loading: Story = {
  args: {
    videos: [],
    isLoading: true,
  },
}

/**
 * Many videos - scrollable grid
 */
export const ManyVideos: Story = {
  args: {
    videos: Array.from({ length: 60 }, (_, i) => ({
      id: `video-${i}`,
      thumbnailUrl: `https://picsum.photos/400/711?random=${i}`,
      playCount: Math.floor(Math.random() * 5000000),
    })),
    onVideoClick: (video) => console.log('Clicked video:', video.id),
  },
}

/**
 * Single video
 */
export const SingleVideo: Story = {
  args: {
    videos: [mockVideos[0]],
    onVideoClick: (video) => console.log('Clicked video:', video.id),
  },
}
