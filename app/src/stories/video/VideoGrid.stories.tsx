import type { Meta, StoryObj } from '@storybook/react-vite'
import { VideoGrid, type VideoPost } from '@/components/video/VideoGrid'

const meta = {
  title: 'Video/VideoGrid',
  component: VideoGrid,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VideoGrid>

export default meta
type Story = StoryObj<typeof meta>

const mockVideos: VideoPost[] = Array.from({ length: 18 }, (_, i) => ({
  id: `video-${i}`,
  thumbnailUrl: `https://picsum.photos/400/711?random=${i}`,
  username: ['dance_queen', 'rhythm_master', 'vocal_hero', 'melody_star', 'beat_boxer', 'karaoke_king'][i % 6],
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
      username: ['dance_queen', 'rhythm_master', 'vocal_hero', 'melody_star', 'beat_boxer', 'karaoke_king'][i % 6],
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
