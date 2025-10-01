import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { CommentsSheet } from '../components/feed/CommentsSheet';
import { ShareSheet } from '../components/feed/ShareSheet';

const meta: Meta<typeof Sheet> = {
  title: 'UI/Sheet',
  component: Sheet,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Sheet Examples
export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Make changes to your profile here. Click save when you're done.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name">Name</label>
            <input 
              id="name" 
              defaultValue="Pedro Duarte" 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="username">Username</label>
            <input 
              id="username" 
              defaultValue="@peduarte" 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="submit">Save changes</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const FromBottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open from Bottom</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[300px]">
        <SheetHeader>
          <SheetTitle>Bottom Sheet</SheetTitle>
          <SheetDescription>
            This sheet slides up from the bottom of the screen.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p>Content goes here...</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const FromLeft: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open from Left</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Left Sheet</SheetTitle>
          <SheetDescription>
            This sheet slides in from the left side.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

export const FromTop: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open from Top</Button>
      </SheetTrigger>
      <SheetContent side="top" className="h-[200px]">
        <SheetHeader>
          <SheetTitle>Top Sheet</SheetTitle>
          <SheetDescription>
            This sheet slides down from the top.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

// Comments Sheet Story
const CommentsSheetDemo = () => {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Comments</Button>
      <CommentsSheet 
        open={open}
        onOpenChange={setOpen}
        postId="demo-post"
      />
    </>
  );
};

export const Comments: Story = {
  render: () => <CommentsSheetDemo />,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
};

// Share Sheet Story
const ShareSheetDemo = () => {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Share Options</Button>
      <ShareSheet 
        open={open}
        onOpenChange={setOpen}
        postUrl="https://karaokeschool.com/@demo"
        postDescription="Check out this amazing video!"
      />
    </>
  );
};

export const Share: Story = {
  render: () => <ShareSheetDemo />,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
};

// Combined Demo
const CombinedDemo = () => {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  
  return (
    <div className="flex gap-4">
      <Button 
        variant="outline" 
        onClick={() => setCommentsOpen(true)}
      >
        💬 Comments
      </Button>
      <Button 
        variant="outline" 
        onClick={() => setShareOpen(true)}
      >
        📤 Share
      </Button>
      
      <CommentsSheet 
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        postId="demo-post"
      />
      <ShareSheet 
        open={shareOpen}
        onOpenChange={setShareOpen}
        postUrl="https://karaokeschool.com/@demo"
        postDescription="Check out this video!"
      />
    </div>
  );
};

export const VideoActions: Story = {
  name: 'Video Actions (Comments & Share)',
  render: () => <CombinedDemo />,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
};