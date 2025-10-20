import type { Meta, StoryObj } from '@storybook/react-vite'
import { VideoDetail } from '@/components/feed/VideoDetail'
import type { CommentData } from '@/components/feed/Comment'

const meta = {
  title: 'Feed/VideoDetail',
  component: VideoDetail,
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
} satisfies Meta<typeof VideoDetail>

export default meta
type Story = StoryObj<typeof meta>

// Sample karaoke data
const sampleKaraokeLines = [
  {
    text: 'In the heat of the night when the temperature rises high',
    translation: '在夜晚的热度中当温度升高',
    start: 0,
    end: 2.5,
    words: [
      { text: 'In', start: 0, end: 0.3 },
      { text: 'the', start: 0.3, end: 0.5 },
      { text: 'heat', start: 0.5, end: 1.0 },
      { text: 'of', start: 1.0, end: 1.2 },
      { text: 'the', start: 1.2, end: 1.4 },
      { text: 'night', start: 1.4, end: 1.8 },
      { text: 'when', start: 1.8, end: 2.0 },
      { text: 'the', start: 2.0, end: 2.1 },
      { text: 'temperature', start: 2.1, end: 2.3 },
      { text: 'rises', start: 2.3, end: 2.4 },
      { text: 'high', start: 2.4, end: 2.5 },
    ],
  },
  {
    text: 'When the stars are shining bright across the midnight sky',
    translation: '当星星在午夜的天空中闪耀明亮',
    start: 2.5,
    end: 5.0,
    words: [
      { text: 'When', start: 2.5, end: 2.8 },
      { text: 'the', start: 2.8, end: 3.0 },
      { text: 'stars', start: 3.0, end: 3.5 },
      { text: 'are', start: 3.5, end: 3.8 },
      { text: 'shining', start: 3.8, end: 4.2 },
      { text: 'bright', start: 4.2, end: 4.5 },
      { text: 'across', start: 4.5, end: 4.7 },
      { text: 'the', start: 4.7, end: 4.8 },
      { text: 'midnight', start: 4.8, end: 4.9 },
      { text: 'sky', start: 4.9, end: 5.0 },
    ],
  },
]

// Sample comments
const sampleComments: CommentData[] = [
  {
    id: '1',
    username: 'music_fan_2024',
    text: 'This is absolutely amazing! Your voice is incredible 🔥🔥',
    likes: 234,
    isLiked: false,
  },
  {
    id: '2',
    username: 'karaoke_pro',
    text: 'Perfect pitch control! Been following your journey and seeing so much improvement 🎵',
    likes: 156,
    isLiked: true,
  },
  {
    id: '3',
    username: 'talent_scout',
    text: 'You need to audition for The Voice! Seriously talented.',
    likes: 89,
    isLiked: false,
  },
  {
    id: '4',
    username: 'vocal_coach',
    text: 'Love the breath control here. Great technique! 👏',
    likes: 67,
    isLiked: false,
  },
  {
    id: '5',
    username: 'singer_wannabe',
    text: 'How do you hit those high notes so effortlessly? Any tips?',
    likes: 45,
    isLiked: false,
  },
]

/**
 * Default video detail view with karaoke
 */
export const Default: Story = {
  args: {
    id: '1',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://picsum.photos/400/700?random=1',
    username: 'singer_star',
    userHandle: 'Professional Vocalist',
    createdAt: '2024-8-9',
    description: 'Practicing this classic! Let me know what you think 🎤✨\n\n#karaoke #singing #cover',
    musicTitle: 'Heat of the Night',
    musicAuthor: 'Scarlett X',
    musicImageUrl: 'https://placebear.com/200/200',
    geniusId: 123456,
    likes: 12500,
    comments: 342,
    shares: 1890,
    karaokeLines: sampleKaraokeLines,
    isLiked: false,
    isFollowing: false,
    canInteract: true,
    commentsData: sampleComments,
    onLikeClick: () => console.log('Like clicked'),
    onCommentClick: () => console.log('Comment clicked'),
    onShareClick: () => console.log('Share clicked'),
    onFollowClick: () => console.log('Follow clicked'),
    onProfileClick: () => console.log('Profile clicked'),
    onAudioClick: () => console.log('Navigate to /song/123456'),
    onClose: () => console.log('Close clicked'),
    onSubmitComment: async (content) => {
      console.log('Comment submitted:', content)
      return true
    },
    onLikeComment: (commentId) => console.log('Comment liked:', commentId),
  },
}

/**
 * Already liked and following
 */
export const LikedAndFollowing: Story = {
  args: {
    ...Default.args,
    id: '2',
    username: 'viral_sensation',
    userHandle: 'Viral Star',
    createdAt: '2024-12-15',
    description: 'This blew up overnight! Thank you all so much!! 🚀💫\n\n#viral #fyp #trending',
    likes: 2500000,
    comments: 125000,
    shares: 450000,
    isLiked: true,
    isFollowing: true,
  },
}

/**
 * Not authenticated - cannot interact
 */
export const NotAuthenticated: Story = {
  args: {
    ...Default.args,
    id: '3',
    username: 'talent_show',
    userHandle: 'Talent Scout',
    createdAt: '2024-11-3',
    description: 'Sign in to like, comment, and follow! 🎭',
    canInteract: false,
    commentsData: sampleComments,
  },
}

/**
 * No comments yet
 */
export const NoComments: Story = {
  args: {
    ...Default.args,
    id: '4',
    username: 'new_artist',
    description: 'My first cover! Be kind please 🥺',
    comments: 0,
    commentsData: [],
  },
}

/**
 * Loading comments
 */
export const LoadingComments: Story = {
  args: {
    ...Default.args,
    id: '5',
    isCommentsLoading: true,
    commentsData: [],
  },
}

/**
 * With navigation controls (in a playlist/feed)
 */
export const WithNavigation: Story = {
  args: {
    ...Default.args,
    id: '6',
    currentVideoIndex: 2,
    totalVideos: 10,
    onNavigatePrevious: () => console.log('Navigate to previous video'),
    onNavigateNext: () => console.log('Navigate to next video'),
  },
}

/**
 * First video in playlist
 */
export const FirstVideoInPlaylist: Story = {
  args: {
    ...Default.args,
    id: '7',
    currentVideoIndex: 0,
    totalVideos: 10,
    onNavigatePrevious: () => console.log('Previous disabled'),
    onNavigateNext: () => console.log('Navigate to next video'),
  },
}

/**
 * Last video in playlist
 */
export const LastVideoInPlaylist: Story = {
  args: {
    ...Default.args,
    id: '8',
    currentVideoIndex: 9,
    totalVideos: 10,
    onNavigatePrevious: () => console.log('Navigate to previous video'),
    onNavigateNext: () => console.log('Next disabled'),
  },
}

/**
 * No karaoke overlay - just regular video
 */
export const NoKaraoke: Story = {
  args: {
    ...Default.args,
    id: '9',
    username: 'dance_moves',
    description: 'Check out my new choreography! 💃',
    karaokeLines: undefined,
  },
}

/**
 * Long description and music info
 */
export const LongContent: Story = {
  args: {
    ...Default.args,
    id: '10',
    username: 'storyteller_singer',
    description: `This song means so much to me! 🎵

I've been practicing for weeks to get this right. The high notes were especially challenging but I'm finally happy with the result.

Special thanks to everyone who has been supporting my journey. Your comments and encouragement keep me going! ❤️

What should I cover next? Drop your suggestions below! 👇

#singing #cover #music #vocals #practice #journey #grateful`,
    musicTitle: 'A Very Long Song Title That Might Need To Be Truncated',
    musicAuthor: 'An Artist With An Equally Long Name',
    commentsData: [
      ...sampleComments,
      {
        id: '6',
        username: 'super_fan',
        text: 'Your dedication really shows! I remember when you first started and the improvement is incredible. Keep it up!',
        likes: 123,
        isLiked: false,
      },
    ],
  },
}

/**
 * Premium locked video - requires subscription
 */
export const PremiumLocked: Story = {
  args: {
    ...Default.args,
    id: '11',
    username: 'billboard_artist',
    userHandle: 'Chart Topper',
    createdAt: '2024-12-20',
    description: 'My cover of this Billboard hit! 🔥 Subscribe to watch the full performance',
    musicTitle: 'Shape of You',
    musicAuthor: 'Ed Sheeran',
    isPremium: true,
    userIsSubscribed: false,
    likes: 3456789,
    comments: 234567,
    shares: 123456,
  },
}

/**
 * Premium unlocked - user is subscribed
 */
export const PremiumUnlocked: Story = {
  args: {
    ...Default.args,
    id: '12',
    username: 'billboard_artist',
    userHandle: 'Chart Topper',
    createdAt: '2024-12-20',
    description: 'My cover of this Billboard hit! 🔥 Thanks for subscribing!',
    musicTitle: 'Blinding Lights',
    musicAuthor: 'The Weeknd',
    geniusId: 789012,
    isPremium: true,
    userIsSubscribed: true,
    likes: 4567890,
    comments: 345678,
    shares: 234567,
  },
}

/**
 * Video without video URL (just thumbnail)
 */
export const ThumbnailOnly: Story = {
  args: {
    ...Default.args,
    id: '11',
    videoUrl: undefined,
    description: 'Coming soon! 🎬',
  },
}
