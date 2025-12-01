import type { Meta, StoryObj } from '@storybook/react-vite'
import { VerticalVideoFeed } from '@/components/feed/VerticalVideoFeed'
import type { VideoPostData } from '@/components/feed/types'
import { AuthProvider } from '@/contexts/AuthContext'

const meta = {
  title: 'Feed/VerticalVideoFeed',
  component: VerticalVideoFeed,
  decorators: [
    (Story) => (
      <AuthProvider>
        <Story />
      </AuthProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VerticalVideoFeed>

export default meta
type Story = StoryObj<typeof meta>

// Sample video data
const mockVideos: VideoPostData[] = [
  {
    id: '1',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=1',
    username: 'idazeile',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=idazeile',
    grade: 'A+',
    musicTitle: 'Illegal',
    musicAuthor: 'PinkPantheress',
    musicImageUrl: 'https://picsum.photos/100/100?random=1',
    artistSlug: 'pinkpantheress',
    songSlug: 'illegal',
    likes: 12400,
    shares: 89,
    isLiked: false,
    isFollowing: false,
    canInteract: true,
  },
  {
    id: '2',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=2',
    username: 'musiclover',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=musiclover',
    grade: 'B+',
    musicTitle: 'Levitating',
    musicAuthor: 'Dua Lipa',
    musicImageUrl: 'https://picsum.photos/100/100?random=2',
    artistSlug: 'dua-lipa',
    songSlug: 'levitating',
    likes: 45000,
    shares: 340,
    isLiked: true,
    isFollowing: true,
    canInteract: true,
  },
  {
    id: '3',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=3',
    username: 'singerstar',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=singerstar',
    grade: 'A',
    musicTitle: 'Heat of the Night',
    musicAuthor: 'Scarlett X',
    musicImageUrl: 'https://picsum.photos/100/100?random=3',
    artistSlug: 'scarlett-x',
    songSlug: 'heat-of-the-night',
    likes: 89000,
    shares: 8900,
    isLiked: false,
    isFollowing: false,
    canInteract: true,
  },
  {
    id: '4',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=4',
    username: 'talent_show',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=talent_show',
    grade: 'A-',
    musicTitle: 'Blue Moon',
    musicAuthor: 'The Marcels',
    musicImageUrl: 'https://picsum.photos/100/100?random=4',
    artistSlug: 'the-marcels',
    songSlug: 'blue-moon',
    likes: 5600,
    shares: 89,
    isLiked: false,
    isFollowing: false,
    canInteract: true,
  },
  {
    id: '5',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=5',
    username: 'viral_sensation',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=viral_sensation',
    grade: 'A+',
    musicTitle: 'Stand By Me',
    musicAuthor: 'Ben E. King',
    musicImageUrl: 'https://picsum.photos/100/100?random=5',
    artistSlug: 'ben-e-king',
    songSlug: 'stand-by-me',
    likes: 2500000,
    shares: 450000,
    isLiked: true,
    isFollowing: true,
    canInteract: true,
  },
]

/**
 * Default vertical scrolling feed with 5 videos
 * Use arrow keys or mouse wheel to navigate
 */
export const Default: Story = {
  args: {
    videos: mockVideos,
    isLoading: false,
    hasMore: true,
    hasMobileFooter: true,
    onLoadMore: () => console.log('Load more requested'),
  },
}

/**
 * Empty feed state
 */
export const Empty: Story = {
  args: {
    videos: [],
    isLoading: false,
    hasMore: false,
    hasMobileFooter: true,
  },
}

/**
 * Loading state (shows existing videos while loading more)
 */
export const Loading: Story = {
  args: {
    videos: mockVideos,
    isLoading: true,
    hasMore: true,
    hasMobileFooter: true,
  },
}

/**
 * Single video (minimal feed)
 */
export const SingleVideo: Story = {
  args: {
    videos: [mockVideos[0]],
    isLoading: false,
    hasMore: false,
    hasMobileFooter: true,
  },
}

/**
 * Feed without mobile footer
 * Used in fullscreen contexts like video detail pages
 */
export const NoMobileFooter: Story = {
  args: {
    videos: mockVideos,
    isLoading: false,
    hasMore: true,
    hasMobileFooter: false,
  },
}

/**
 * Feed with URL updates enabled
 * Simulates video detail page behavior
 */
export const WithUrlUpdates: Story = {
  args: {
    videos: mockVideos,
    isLoading: false,
    hasMore: true,
    hasMobileFooter: false,
    updateUrlOnScroll: true,
    baseUrl: '/u/creator/video/',
  },
}

/**
 * Feed starting at specific video
 * Tests scroll restoration when navigating to video detail
 */
export const StartAtVideo3: Story = {
  args: {
    videos: mockVideos,
    isLoading: false,
    hasMore: true,
    hasMobileFooter: true,
    initialVideoId: '3', // Will scroll to third video on mount
  },
}
