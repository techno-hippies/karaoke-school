import type { Meta, StoryObj } from '@storybook/react-vite'
import { CommentSheet } from '@/components/feed/CommentSheet'
import type { CommentData } from '@/components/feed/Comment'

const meta = {
  title: 'Feed/CommentSheet',
  component: CommentSheet,
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
} satisfies Meta<typeof CommentSheet>

export default meta
type Story = StoryObj<typeof meta>

const sampleComments: CommentData[] = [
  {
    id: '1',
    username: 'musiclover',
    text: 'This is amazing! Love your voice 🎤',
    likes: 42,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=musiclover',
  },
  {
    id: '2',
    username: 'karaokefan',
    text: 'Been practicing this song for weeks! Thanks for the inspiration 💪',
    likes: 15,
    isLiked: true,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=karaokefan',
  },
  {
    id: '3',
    username: 'singer99',
    text: 'Your karaoke skills are incredible! 🔥',
    likes: 127,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=singer99',
  },
  {
    id: '4',
    username: 'superfan',
    text: 'This is absolutely incredible! I have been following your karaoke journey for so long and seeing how much you have improved is truly inspiring.',
    likes: 234,
    isLiked: true,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=superfan',
  },
  {
    id: '5',
    username: 'newbie',
    text: 'Just discovered your channel, subscribed! 🎵',
    likes: 8,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=newbie',
  },
]

/**
 * Default state with comments
 */
export const Default: Story = {
  args: {
    open: true,
    comments: sampleComments,
    commentCount: 125,
    canComment: true,
    onOpenChange: (open) => console.log('Sheet open:', open),
    onSubmitComment: async (content) => {
      console.log('Submit comment:', content)
      return true
    },
    onLikeComment: (id) => console.log('Like comment:', id),
  },
}

/**
 * Empty state - no comments yet
 */
export const Empty: Story = {
  args: {
    open: true,
    comments: [],
    commentCount: 0,
    canComment: true,
    onOpenChange: (open) => console.log('Sheet open:', open),
    onSubmitComment: async (content) => {
      console.log('Submit comment:', content)
      return true
    },
  },
}

/**
 * Loading state
 */
export const Loading: Story = {
  args: {
    open: true,
    comments: [],
    commentCount: 0,
    canComment: false,
    isLoading: true,
    onOpenChange: (open) => console.log('Sheet open:', open),
  },
}

/**
 * Not authenticated - cannot comment
 */
export const NotAuthenticated: Story = {
  args: {
    open: true,
    comments: sampleComments,
    commentCount: 125,
    canComment: false,
    onOpenChange: (open) => console.log('Sheet open:', open),
  },
}

/**
 * Submitting comment
 */
export const Submitting: Story = {
  args: {
    open: true,
    comments: sampleComments,
    commentCount: 125,
    canComment: true,
    isSubmitting: true,
    onOpenChange: (open) => console.log('Sheet open:', open),
    onSubmitComment: async (content) => {
      console.log('Submit comment:', content)
      await new Promise(resolve => setTimeout(resolve, 2000))
      return true
    },
  },
}
