import type { Meta, StoryObj } from '@storybook/react-vite'
import { Comment } from '@/components/feed/Comment'

const meta = {
  title: 'Feed/Comment',
  component: Comment,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Comment>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default comment with avatar
 */
export const Default: Story = {
  args: {
    comment: {
      id: '1',
      username: 'musiclover',
      text: 'This is amazing! Love your voice 🎤',
      likes: 0,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=musiclover',
    },
    onLike: (id) => console.log('Liked comment:', id),
  },
}

/**
 * Comment with likes
 */
export const WithLikes: Story = {
  args: {
    comment: {
      id: '2',
      username: 'karaokefan',
      text: 'Been practicing this song for weeks! Thanks for the inspiration 💪',
      likes: 42,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=karaokefan',
    },
    onLike: (id) => console.log('Liked comment:', id),
  },
}

/**
 * Liked comment
 */
export const Liked: Story = {
  args: {
    comment: {
      id: '3',
      username: 'singer99',
      text: 'Your karaoke skills are incredible! 🔥',
      likes: 127,
      isLiked: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=singer99',
    },
    onLike: (id) => console.log('Unliked comment:', id),
  },
}

/**
 * Comment without avatar
 */
export const NoAvatar: Story = {
  args: {
    comment: {
      id: '4',
      username: 'anonymous',
      text: 'Great performance!',
      likes: 5,
    },
    showAvatar: false,
    onLike: (id) => console.log('Liked comment:', id),
  },
}

/**
 * Long comment text
 */
export const LongText: Story = {
  args: {
    comment: {
      id: '5',
      username: 'superfan',
      text: 'This is absolutely incredible! I have been following your karaoke journey for so long and seeing how much you have improved is truly inspiring. Keep up the amazing work and never stop singing! 🎵🎤',
      likes: 234,
      isLiked: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=superfan',
    },
    onLike: (id) => console.log('Liked comment:', id),
  },
}
