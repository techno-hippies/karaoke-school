import type { Meta, StoryObj } from '@storybook/react-vite'
import { VideoDetail } from '@/components/feed/VideoDetail'
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext'

const meta = {
  title: 'Feed/VideoDetail',
  component: VideoDetail,
  decorators: [
    (Story) => (
      <VideoPlaybackProvider>
        <Story />
      </VideoPlaybackProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VideoDetail>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default video detail view
 * Shows a karaoke video with full engagement UI
 */
export const Default: Story = {
  args: {
    id: '1',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=1',
    username: 'idazeile',
    userHandle: 'Ida Zeile',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=idazeile',
    grade: 'A+',
    description: 'Based on many true stories',
    musicTitle: 'Illegal',
    musicAuthor: 'PinkPantheress',
    musicImageUrl: 'https://picsum.photos/100/100?random=1',
    artistSlug: 'pinkpantheress',
    songSlug: 'illegal',
    createdAt: '2 hours ago',
    likes: 12400,
    shares: 89,
    isLiked: false,
    isFollowing: false,
    canInteract: true,
    onClose: () => console.log('Close clicked'),
    onLikeClick: () => console.log('Like clicked'),
    onShareClick: () => console.log('Share clicked'),
    onFollowClick: () => console.log('Follow clicked'),
    onProfileClick: () => console.log('Profile clicked'),
    onAudioClick: () => console.log('Audio clicked'),
  },
}

/**
 * With Navigation
 * Shows video detail with navigation arrows (part of a playlist/feed)
 */
export const WithNavigation: Story = {
  args: {
    ...Default.args,
    currentVideoIndex: 2,
    totalVideos: 10,
    onNavigatePrevious: () => console.log('Navigate previous'),
    onNavigateNext: () => console.log('Navigate next'),
  },
}

/**
 * Liked State
 * Shows video that user has already liked
 */
export const LikedState: Story = {
  args: {
    ...Default.args,
    isLiked: true,
    likes: 12401,
  },
}

/**
 * Following Creator
 * Shows video from creator user is following
 */
export const FollowingCreator: Story = {
  args: {
    ...Default.args,
    isFollowing: true,
  },
}

/**
 * No Interaction
 * Shows video when user is not logged in (can't interact)
 */
export const NoInteraction: Story = {
  args: {
    ...Default.args,
    canInteract: false,
  },
}

/**
 * With Karaoke Lines
 * Shows video with synced lyrics overlay
 */
export const WithKaraokeLines: Story = {
  args: {
    ...Default.args,
    karaokeLines: [
      {
        text: 'I just wanna go outside',
        start: 0,
        end: 2.5,
      },
      {
        text: 'I just wanna go outside and vibe',
        start: 2.5,
        end: 5,
      },
      {
        text: 'Feeling something in the air tonight',
        start: 5,
        end: 7.5,
      },
      {
        text: "It's illegal",
        start: 7.5,
        end: 10,
      },
    ],
  },
}

/**
 * Minimal (no study button)
 * Shows video with minimal metadata - no artistSlug/songSlug so no study button
 */
export const Minimal: Story = {
  args: {
    id: '2',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=3',
    username: 'artist',
    likes: 100,
    shares: 2,
    canInteract: true,
    onClose: () => console.log('Close clicked'),
  },
}

/**
 * Original Content
 * Shows original (non-copyrighted) content
 */
export const OriginalContent: Story = {
  args: {
    id: '3',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=2',
    username: 'musicmaker',
    userHandle: 'Original Artist',
    description: 'My original composition',
    musicTitle: 'Summer Vibes',
    musicAuthor: 'Music Maker',
    artistSlug: 'music-maker',
    songSlug: 'summer-vibes',
    grade: 'A',
    likes: 8900,
    shares: 67,
    canInteract: true,
    onClose: () => console.log('Close clicked'),
  },
}
