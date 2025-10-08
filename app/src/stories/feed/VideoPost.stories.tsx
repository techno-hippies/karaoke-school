import type { Meta, StoryObj } from '@storybook/react-vite'
import { VideoPost } from '@/components/feed/VideoPost'

const meta = {
  title: 'Feed/VideoPost',
  component: VideoPost,
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
} satisfies Meta<typeof VideoPost>

export default meta
type Story = StoryObj<typeof meta>

// Sample karaoke data
const sampleKaraokeLines = [
  {
    text: 'In the heat of the night',
    translation: '在夜晚的热度中',
    start: 0,
    end: 2.5,
    words: [
      { text: 'In', start: 0, end: 0.3 },
      { text: 'the', start: 0.3, end: 0.5 },
      { text: 'heat', start: 0.5, end: 1.0 },
      { text: 'of', start: 1.0, end: 1.2 },
      { text: 'the', start: 1.2, end: 1.4 },
      { text: 'night', start: 1.4, end: 2.5 },
    ],
  },
  {
    text: 'When the stars are shining bright',
    translation: '当星星闪耀明亮',
    start: 2.5,
    end: 5.0,
    words: [
      { text: 'When', start: 2.5, end: 2.8 },
      { text: 'the', start: 2.8, end: 3.0 },
      { text: 'stars', start: 3.0, end: 3.5 },
      { text: 'are', start: 3.5, end: 3.8 },
      { text: 'shining', start: 3.8, end: 4.5 },
      { text: 'bright', start: 4.5, end: 5.0 },
    ],
  },
]

/**
 * Karaoke video with lyrics overlay
 */
export const Default: Story = {
  args: {
    id: '2',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://picsum.photos/400/700?random=2',
    username: 'singerstar',
    musicTitle: 'Heat of the Night',
    musicAuthor: 'Scarlett X',
    musicImageUrl: 'https://placebear.com/200/200',
    likes: 45000,
    comments: 2100,
    shares: 3400,
    karaokeLines: sampleKaraokeLines,
    isLiked: false,
    isFollowing: false,
    canInteract: true,
    onLikeClick: () => console.log('Like clicked'),
    onCommentClick: () => console.log('Comment clicked'),
    onShareClick: () => console.log('Share clicked'),
    onFollowClick: () => console.log('Follow clicked'),
    onProfileClick: () => console.log('Profile clicked'),
    onAudioClick: () => console.log('Audio clicked'),
  },
}

/**
 * Cover video - user singing a cover version
 */
export const Cover: Story = {
  args: {
    id: '3',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://picsum.photos/400/700?random=3',
    username: 'musiclover',
    musicTitle: 'Down Home Blues (Cover)',
    musicAuthor: 'Ethel Waters',
    musicImageUrl: 'https://placebear.com/201/201',
    likes: 89001, // +1 from like
    comments: 5600,
    shares: 8900,
    karaokeLines: sampleKaraokeLines,
    isLiked: true,
    isFollowing: true,
    canInteract: true,
    onLikeClick: () => console.log('Unlike clicked'),
    onCommentClick: () => console.log('Comment clicked'),
    onShareClick: () => console.log('Share clicked'),
    onFollowClick: () => console.log('Unfollow clicked'),
    onProfileClick: () => console.log('Profile clicked'),
    onAudioClick: () => console.log('Audio clicked'),
  },
}

/**
 * Already liked and following
 */
export const LikedAndFollowing: Story = {
  args: {
    id: '4',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://picsum.photos/400/700?random=4',
    username: 'viral_sensation',
    musicTitle: 'Stand By Me',
    musicAuthor: 'Ben E. King',
    musicImageUrl: 'https://placebear.com/202/202',
    likes: 2500000,
    comments: 125000,
    shares: 450000,
    karaokeLines: sampleKaraokeLines,
    isLiked: true,
    isFollowing: true,
    canInteract: true,
    onLikeClick: () => console.log('Like clicked'),
    onCommentClick: () => console.log('Comment clicked'),
    onShareClick: () => console.log('Share clicked'),
    onFollowClick: () => console.log('Follow clicked'),
    onProfileClick: () => console.log('Profile clicked'),
    onAudioClick: () => console.log('Audio clicked'),
  },
}

/**
 * Not authenticated (cannot interact)
 */
export const NotAuthenticated: Story = {
  args: {
    id: '5',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://picsum.photos/400/700?random=5',
    username: 'talent_show',
    musicTitle: 'Blue Moon',
    musicAuthor: 'The Marcels',
    musicImageUrl: 'https://placebear.com/203/203',
    likes: 5600,
    comments: 234,
    shares: 89,
    karaokeLines: sampleKaraokeLines,
    isLiked: false,
    isFollowing: false,
    canInteract: false, // Cannot interact
    onLikeClick: () => console.log('Like clicked (requires auth)'),
    onCommentClick: () => console.log('Comment clicked'),
    onShareClick: () => console.log('Share clicked'),
    onFollowClick: () => console.log('Follow clicked (requires auth)'),
    onProfileClick: () => console.log('Profile clicked'),
    onAudioClick: () => console.log('Audio clicked'),
  },
}
