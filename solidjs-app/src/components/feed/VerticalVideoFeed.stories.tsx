import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { VerticalVideoFeed } from './VerticalVideoFeed'
import type { VideoPostData } from './types'

const meta: Meta<typeof VerticalVideoFeed> = {
  title: 'Feed/VerticalVideoFeed',
  component: VerticalVideoFeed,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof VerticalVideoFeed>

// Sample videos with different content
const SAMPLE_VIDEOS: VideoPostData[] = [
  {
    id: 'video-1',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/v1/360/640',
    username: 'scarlett',
    userAvatar: 'https://picsum.photos/seed/u1/100/100',
    musicTitle: 'Toxic',
    musicAuthor: 'Britney Spears',
    musicImageUrl: 'https://picsum.photos/seed/a1/100/100',
    artistSlug: 'britney-spears',
    songSlug: 'toxic',
    likes: 1234,
    shares: 56,
    description: 'First video in the feed!',
    isLiked: false,
    isFollowing: false,
    canInteract: true,
  },
  {
    id: 'video-2',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/v2/360/640',
    username: 'melody',
    userAvatar: 'https://picsum.photos/seed/u2/100/100',
    musicTitle: 'Shape of You',
    musicAuthor: 'Ed Sheeran',
    musicImageUrl: 'https://picsum.photos/seed/a2/100/100',
    artistSlug: 'ed-sheeran',
    songSlug: 'shape-of-you',
    likes: 5678,
    shares: 234,
    description: 'Second video - scroll down!',
    isLiked: true,
    isFollowing: true,
    canInteract: true,
  },
  {
    id: 'video-3',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/v3/360/640',
    username: 'harmony',
    userAvatar: 'https://picsum.photos/seed/u3/100/100',
    musicTitle: 'Bad Guy',
    musicAuthor: 'Billie Eilish',
    musicImageUrl: 'https://picsum.photos/seed/a3/100/100',
    artistSlug: 'billie-eilish',
    songSlug: 'bad-guy',
    likes: 9999,
    shares: 567,
    description: 'Third video in feed',
    isLiked: false,
    isFollowing: false,
    canInteract: true,
  },
  {
    id: 'video-4',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/v4/360/640',
    username: 'rhythms',
    musicTitle: 'Blinding Lights',
    musicAuthor: 'The Weeknd',
    artistSlug: 'the-weeknd',
    songSlug: 'blinding-lights',
    likes: 12345,
    shares: 890,
    description: 'Fourth video!',
    isLiked: false,
    isFollowing: false,
    canInteract: true,
  },
]

/**
 * Interactive wrapper with like/follow state
 */
function InteractiveFeed(props: { videos: VideoPostData[]; initialVideoId?: string }) {
  const [videos, setVideos] = createSignal(props.videos)

  const handleLike = (videoId: string) => {
    setVideos(vids =>
      vids.map(v =>
        v.id === videoId
          ? { ...v, isLiked: !v.isLiked, likes: v.isLiked ? v.likes - 1 : v.likes + 1 }
          : v
      )
    )
  }

  const handleFollow = (videoId: string) => {
    setVideos(vids =>
      vids.map(v =>
        v.id === videoId ? { ...v, isFollowing: !v.isFollowing } : v
      )
    )
  }

  return (
    <VerticalVideoFeed
      videos={videos()}
      initialVideoId={props.initialVideoId}
      onLikeClick={handleLike}
      onFollowClick={handleFollow}
      onProfileClick={(username) => console.log('Profile:', username)}
    />
  )
}

/**
 * Default feed with multiple videos
 */
export const Default: Story = {
  render: () => <InteractiveFeed videos={SAMPLE_VIDEOS} />,
}

/**
 * Start at specific video
 */
export const StartAtVideo2: Story = {
  render: () => <InteractiveFeed videos={SAMPLE_VIDEOS} initialVideoId="video-2" />,
}

/**
 * Single video
 */
export const SingleVideo: Story = {
  render: () => <InteractiveFeed videos={[SAMPLE_VIDEOS[0]]} />,
}

/**
 * Empty feed
 */
export const Empty: Story = {
  render: () => <VerticalVideoFeed videos={[]} />,
}

/**
 * Loading state
 */
export const Loading: Story = {
  render: () => (
    <VerticalVideoFeed
      videos={SAMPLE_VIDEOS.slice(0, 2)}
      isLoading={true}
      hasMore={true}
    />
  ),
}

/**
 * With mobile footer spacing
 */
export const WithMobileFooter: Story = {
  render: () => (
    <div class="relative">
      <InteractiveFeed videos={SAMPLE_VIDEOS} />
      {/* Simulated footer */}
      <div class="fixed bottom-0 left-0 right-0 h-16 bg-background/90 border-t border-border flex items-center justify-around z-50">
        <div class="text-xs text-muted-foreground">Home</div>
        <div class="text-xs text-muted-foreground">Search</div>
        <div class="text-xs text-muted-foreground">Study</div>
        <div class="text-xs text-muted-foreground">Chat</div>
        <div class="text-xs text-muted-foreground">Wallet</div>
      </div>
    </div>
  ),
}
