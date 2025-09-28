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
        Open Comments (234 comments)
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
    />
  ),
};

export const OpenByDefault: Story = {
  render: () => (
    <CommentsSheetWrapper 
      defaultOpen={true}
      postId="open-post"
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
    />
  ),
  parameters: {
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
};