import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { VideoPlayer } from '@/components/feed/VideoPlayer'
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext'

const meta = {
  title: 'Feed/VideoPlayer',
  component: VideoPlayer,
  decorators: [
    (Story) => (
      <VideoPlaybackProvider>
        <div className="w-full h-screen bg-black">
          <Story />
        </div>
      </VideoPlaybackProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VideoPlayer>

export default meta
type Story = StoryObj<typeof meta>

// Interactive wrapper component
function InteractivePlayer(props: Partial<React.ComponentProps<typeof VideoPlayer>>) {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <VideoPlayer
      isPlaying={isPlaying}
      isMuted={false}
      onTogglePlay={() => setIsPlaying(!isPlaying)}
      onPlayFailed={() => setIsPlaying(false)}
      {...props}
    />
  )
}

/**
 * Thumbnail only (no video URL)
 * Shows just the poster image with play button
 */
export const ThumbnailOnly: Story = {
  render: () => (
    <InteractivePlayer
      thumbnailUrl="https://picsum.photos/400/711?random=1"
    />
  ),
}

/**
 * Video with thumbnail
 * Normal playback with poster image that fades when video starts
 */
export const WithThumbnail: Story = {
  render: () => (
    <InteractivePlayer
      videoUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
      thumbnailUrl="https://picsum.photos/400/711?random=2"
    />
  ),
}

/**
 * Video without thumbnail
 * Shows black screen with play button initially
 */
export const WithoutThumbnail: Story = {
  render: () => (
    <InteractivePlayer
      videoUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
    />
  ),
}

/**
 * Autoplay enabled
 * Video should start playing automatically
 * Note: May be blocked by browser autoplay policy
 */
export const AutoplayEnabled: Story = {
  render: () => {
    const [isPlaying, setIsPlaying] = useState(true)

    return (
      <VideoPlayer
        videoUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
        thumbnailUrl="https://picsum.photos/400/711?random=3"
        isPlaying={isPlaying}
        isMuted={false}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onPlayFailed={() => setIsPlaying(false)}
      />
    )
  },
}

/**
 * No media
 * Shows fallback state when no video or thumbnail provided
 */
export const NoMedia: Story = {
  render: () => (
    <InteractivePlayer />
  ),
}

/**
 * Loading state
 * Shows spinner while video is loading (visible briefly on mount)
 */
export const Loading: Story = {
  render: () => {
    const [isPlaying, setIsPlaying] = useState(true)

    return (
      <VideoPlayer
        videoUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        thumbnailUrl="https://picsum.photos/400/711?random=4"
        isPlaying={isPlaying}
        isMuted={false}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onPlayFailed={() => setIsPlaying(false)}
      />
    )
  },
}

/**
 * Mobile aspect ratio
 * 9:16 centered container (like actual app)
 */
export const MobileAspectRatio: Story = {
  render: () => (
    <div className="w-full h-screen bg-background flex items-center justify-center">
      <div className="w-full md:w-[50.625vh] h-full md:h-[90vh] max-w-[450px] max-h-[800px]">
        <InteractivePlayer
          videoUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
          thumbnailUrl="https://picsum.photos/400/711?random=5"
        />
      </div>
    </div>
  ),
}
