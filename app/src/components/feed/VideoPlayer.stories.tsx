import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { VideoPlayer } from './VideoPlayer'

const meta: Meta<typeof VideoPlayer> = {
  title: 'Feed/VideoPlayer',
  component: VideoPlayer,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div class="w-[360px] h-[640px] bg-black rounded-lg overflow-hidden">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof VideoPlayer>

// Sample video URLs (public domain / test videos)
const SAMPLE_VIDEO = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
const SAMPLE_THUMBNAIL = 'https://picsum.photos/seed/video1/360/640'

/**
 * Interactive wrapper that manages play/mute state
 */
function InteractiveVideoPlayer(props: {
  videoUrl?: string
  thumbnailUrl?: string
  initialPlaying?: boolean
  initialMuted?: boolean
}) {
  const [isPlaying, setIsPlaying] = createSignal(props.initialPlaying ?? false)
  const [isMuted, setIsMuted] = createSignal(props.initialMuted ?? true)
  const [currentTime, setCurrentTime] = createSignal(0)

  return (
    <div class="relative w-full h-full">
      <VideoPlayer
        videoUrl={props.videoUrl}
        thumbnailUrl={props.thumbnailUrl}
        isPlaying={isPlaying()}
        isMuted={isMuted()}
        onTogglePlay={() => setIsPlaying(!isPlaying())}
        onPlayFailed={() => {
          console.log('Autoplay blocked')
          setIsPlaying(false)
        }}
        onTimeUpdate={setCurrentTime}
      />
      {/* Debug overlay */}
      <div class="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded font-mono z-50">
        <div>Playing: {isPlaying() ? 'yes' : 'no'}</div>
        <div>Muted: {isMuted() ? 'yes' : 'no'}</div>
        <div>Time: {currentTime().toFixed(1)}s</div>
      </div>
      {/* Mute toggle button */}
      <button
        onClick={() => setIsMuted(!isMuted())}
        class="absolute bottom-4 right-4 bg-black/50 text-white p-2 rounded-full z-50"
      >
        {isMuted() ? '🔇' : '🔊'}
      </button>
    </div>
  )
}

/**
 * Default state - paused with thumbnail
 */
export const Default: Story = {
  render: () => (
    <InteractiveVideoPlayer
      videoUrl={SAMPLE_VIDEO}
      thumbnailUrl={SAMPLE_THUMBNAIL}
    />
  ),
}

/**
 * Playing state
 */
export const Playing: Story = {
  render: () => (
    <InteractiveVideoPlayer
      videoUrl={SAMPLE_VIDEO}
      thumbnailUrl={SAMPLE_THUMBNAIL}
      initialPlaying={true}
    />
  ),
}

/**
 * With thumbnail only (no video)
 */
export const ThumbnailOnly: Story = {
  render: () => (
    <InteractiveVideoPlayer
      thumbnailUrl={SAMPLE_THUMBNAIL}
    />
  ),
}

/**
 * No media - fallback state
 */
export const NoMedia: Story = {
  render: () => (
    <InteractiveVideoPlayer />
  ),
}

/**
 * Error state - invalid video URL
 */
export const ErrorState: Story = {
  render: () => (
    <InteractiveVideoPlayer
      videoUrl="https://invalid-url-that-will-fail.mp4"
      thumbnailUrl={SAMPLE_THUMBNAIL}
      initialPlaying={true}
    />
  ),
}
