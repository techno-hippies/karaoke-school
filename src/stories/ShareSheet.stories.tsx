import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { ShareSheet } from '../components/feed/ShareSheet';
import { Button } from '../components/ui/button';
import { Share2 } from 'lucide-react';

const meta: Meta<typeof ShareSheet> = {
  title: 'Feed/ShareSheet',
  component: ShareSheet,
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
const ShareSheetWrapper = ({ 
  defaultOpen = false,
  ...props 
}: { 
  defaultOpen?: boolean;
} & React.ComponentProps<typeof ShareSheet>) => {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Button 
        onClick={() => setOpen(true)}
        className="bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-2"
      >
        <Share2 className="w-4 h-4" />
        Share Video
      </Button>
      <ShareSheet 
        {...props}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
};

export const Default: Story = {
  render: () => (
    <ShareSheetWrapper 
      postUrl="https://karaokeschool.com/@username/video123"
      postDescription="Check out this amazing karaoke performance! 🎤"
    />
  ),
};

export const OpenByDefault: Story = {
  render: () => (
    <ShareSheetWrapper 
      defaultOpen={true}
      postUrl="https://karaokeschool.com/@creator/video456"
      postDescription="This is incredible! Must watch 🔥"
    />
  ),
};

export const CustomDescription: Story = {
  render: () => (
    <ShareSheetWrapper 
      postUrl="https://karaokeschool.com/@singer/performance"
      postDescription="Just nailed this song! What do you think? 🎵 #karaoke #singing #music"
    />
  ),
};

export const MobileView: Story = {
  render: () => (
    <ShareSheetWrapper 
      postUrl="https://karaokeschool.com/@mobile/video"
      postDescription="Sharing from mobile!"
    />
  ),
  parameters: {
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
};

export const TabletView: Story = {
  render: () => (
    <ShareSheetWrapper 
      postUrl="https://karaokeschool.com/@tablet/video"
      postDescription="Tablet sharing experience"
    />
  ),
  parameters: {
    viewport: {
      defaultViewport: 'ipad',
    },
  },
};