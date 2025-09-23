import type { Meta, StoryObj } from '@storybook/react';
import { Comment } from '../components/feed/Comment';

const meta: Meta<typeof Comment> = {
  title: 'Feed/Comment',
  component: Comment,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-96 p-4 bg-neutral-900 rounded-lg">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAvatar: Story = {
  args: {
    comment: {
      id: '1',
      username: 'user123',
      text: 'This is an amazing post! 🔥 Love the content',
      likes: 234,
      avatar: 'https://picsum.photos/40/40?random=1',
    },
    onLike: (commentId) => console.log('Liked comment:', commentId),
  },
};

export const WithoutAvatar: Story = {
  args: {
    comment: {
      id: '2',
      username: 'creator_fan',
      text: 'Great video! Where did you film this?',
      likes: 89,
    },
    onLike: (commentId) => console.log('Liked comment:', commentId),
  },
};

export const LongComment: Story = {
  args: {
    comment: {
      id: '3',
      username: 'music_lover',
      text: 'This song is absolutely incredible! I\'ve been listening to it on repeat for the past week. The way the melody flows with the lyrics is just perfect. Can you please share the name of the artist and where I can find more music like this? This type of content is exactly what I was looking for.',
      likes: 1250,
      avatar: 'https://picsum.photos/40/40?random=3',
    },
    onLike: (commentId) => console.log('Liked comment:', commentId),
  },
};

export const HighLikes: Story = {
  args: {
    comment: {
      id: '4',
      username: 'viral_commenter',
      text: 'This deserves way more views! 🚀',
      likes: 15600,
      avatar: 'https://picsum.photos/40/40?random=4',
    },
    onLike: (commentId) => console.log('Liked comment:', commentId),
  },
};

export const NoLikes: Story = {
  args: {
    comment: {
      id: '5',
      username: 'new_user',
      text: 'First comment! 👋',
      likes: 0,
    },
    onLike: (commentId) => console.log('Liked comment:', commentId),
  },
};