import type { Meta, StoryObj } from '@storybook/react'
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
    description: 'Based on many true stories 🤧',
    musicTitle: 'Illegal',
    musicAuthor: 'PinkPantheress',
    musicImageUrl: 'https://picsum.photos/100/100?random=1',
    geniusId: 8434253,
    createdAt: '2 hours ago',
    likes: 12400,
    comments: 342,
    shares: 89,
    isLiked: false,
    isFollowing: false,
    canInteract: true,
    commentsData: [
      {
        id: '1',
        username: 'musiclover',
        text: 'This is amazing! Love your voice 🎵',
        likes: 45,
        isLiked: false,
      },
      {
        id: '2',
        username: 'karaokefan',
        text: 'You nailed this one! A+ well deserved',
        likes: 32,
        isLiked: true,
      },
      {
        id: '3',
        username: 'singer123',
        text: 'Such good pitch control 👏',
        likes: 18,
        isLiked: false,
      },
    ],
    onClose: () => console.log('Close clicked'),
    onLikeClick: () => console.log('Like clicked'),
    onCommentClick: () => console.log('Comment clicked'),
    onShareClick: () => console.log('Share clicked'),
    onFollowClick: () => console.log('Follow clicked'),
    onProfileClick: () => console.log('Profile clicked'),
    onAudioClick: () => console.log('Audio clicked'),
    onSubmitComment: async (content: string) => {
      console.log('Submit comment:', content)
      return true
    },
    onLikeComment: (commentId: string) => console.log('Like comment:', commentId),
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
 * Loading Comments
 * Shows loading state for comments
 */
export const LoadingComments: Story = {
  args: {
    ...Default.args,
    commentsData: [],
    isCommentsLoading: true,
  },
}

/**
 * No Comments
 * Shows empty state when there are no comments
 */
export const NoComments: Story = {
  args: {
    ...Default.args,
    comments: 0,
    commentsData: [],
  },
}

/**
 * Many Comments
 * Shows scrollable comments section
 */
export const ManyComments: Story = {
  args: {
    ...Default.args,
    comments: 500,
    commentsData: Array.from({ length: 20 }, (_, i) => ({
      id: `${i + 1}`,
      username: `user${i + 1}`,
      text: `This is comment ${i + 1}. ${i % 3 === 0 ? 'Amazing performance! 🎵' : i % 3 === 1 ? 'Love this song! ❤️' : 'Great job! 👏'}`,
      likes: Math.floor(Math.random() * 100),
      isLiked: i % 5 === 0,
    })),
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
 * Minimal
 * Shows video with minimal metadata
 */
export const Minimal: Story = {
  args: {
    id: '2',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=3',
    username: 'artist',
    likes: 100,
    comments: 5,
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
    description: 'My original composition 🎵',
    musicTitle: 'Summer Vibes',
    musicAuthor: 'Music Maker',
    grade: 'A',
    likes: 8900,
    comments: 234,
    shares: 67,
    canInteract: true,
    commentsData: [],
    onClose: () => console.log('Close clicked'),
  },
}
