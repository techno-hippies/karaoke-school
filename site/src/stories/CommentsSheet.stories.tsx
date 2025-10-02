import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import { CommentsSheet } from '../components/feed/CommentsSheet';
import { Button } from '../components/ui/button';

const meta: Meta<typeof CommentsSheet> = {
  title: 'Feed/CommentsSheet',
  component: CommentsSheet,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock comments data
const mockComments = [
  {
    id: '1',
    content: 'This is amazing! Love the karaoke performance 🎤',
    author: {
      username: 'musiclover',
      avatar: 'https://i.pravatar.cc/150?img=1'
    },
    likes: 24,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    content: 'Great song choice! You nailed it 🔥',
    author: {
      username: 'karaokefan',
      avatar: 'https://i.pravatar.cc/150?img=2'
    },
    likes: 15,
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    content: 'Can you do more songs from this artist?',
    author: {
      username: 'singingsoul',
      avatar: 'https://i.pravatar.cc/150?img=3'
    },
    likes: 8,
    createdAt: new Date().toISOString()
  }
];

// Wrapper component to handle state
const CommentsSheetWrapper = ({
  defaultOpen = false,
  ...props
}: {
  defaultOpen?: boolean;
} & React.ComponentProps<typeof CommentsSheet>) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Button
        onClick={() => setOpen(true)}
        className="bg-red-600 hover:bg-red-700 text-white"
      >
        Open Comments ({props.commentCount || 0} comments)
      </Button>
      <CommentsSheet
        {...props}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
};

export const Default: Story = {
  render: () => (
    <CommentsSheetWrapper
      postId="default-post"
      comments={mockComments}
      commentCount={mockComments.length}
      canComment={false}
      isLoading={false}
      isSubmitting={false}
      onSubmitComment={async (content) => {
        console.log('Comment submitted:', content);
        return true;
      }}
    />
  ),
};

export const OpenByDefault: Story = {
  render: () => (
    <CommentsSheetWrapper
      defaultOpen={true}
      postId="open-post"
      comments={mockComments}
      commentCount={mockComments.length}
      canComment={true}
      isLoading={false}
      isSubmitting={false}
      onSubmitComment={async (content) => {
        console.log('Comment submitted:', content);
        return true;
      }}
    />
  ),
};

export const EmptyComments: Story = {
  render: () => {
    const EmptyCommentsSheet = () => {
      const [open, setOpen] = useState(false);

      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Button
            onClick={() => setOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Open Comments (No comments yet)
          </Button>
          <CommentsSheet
            open={open}
            onOpenChange={setOpen}
            postId="empty-post"
            comments={[]}
            commentCount={0}
            canComment={true}
            isLoading={false}
            isSubmitting={false}
            onSubmitComment={async (content) => {
              console.log('Comment submitted:', content);
              return true;
            }}
          />
        </div>
      );
    };

    return <EmptyCommentsSheet />;
  },
};

export const MobileView: Story = {
  render: () => (
    <CommentsSheetWrapper
      postId="mobile-post"
      comments={mockComments}
      commentCount={mockComments.length}
      canComment={true}
      isLoading={false}
      isSubmitting={false}
      onSubmitComment={async (content) => {
        console.log('Comment submitted:', content);
        return true;
      }}
    />
  ),
  parameters: {
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
};

export const Loading: Story = {
  render: () => (
    <CommentsSheetWrapper
      defaultOpen={true}
      postId="loading-post"
      comments={[]}
      commentCount={0}
      canComment={false}
      isLoading={true}
      isSubmitting={false}
      onSubmitComment={async (content) => {
        console.log('Comment submitted:', content);
        return true;
      }}
    />
  ),
};