import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof Sheet> = {
  title: 'UI/Sheet',
  component: Sheet,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

export const FromBottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Sheet</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Are you absolutely sure?</SheetTitle>
          <SheetDescription>
            This action cannot be undone. This will permanently delete your account.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  )
}

export const FromRight: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open from Right</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage your account settings and preferences.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  )
}

export const FromLeft: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open from Left</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>
            Navigate through the app.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  )
}

export const CommentSheet: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>💬 Comments</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Comments</SheetTitle>
          <SheetDescription>
            Join the conversation
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="p-3 bg-card rounded-lg">
            <p className="text-sm font-medium">@user123</p>
            <p className="text-sm text-muted-foreground">This is amazing! 🔥</p>
          </div>
          <div className="p-3 bg-card rounded-lg">
            <p className="text-sm font-medium">@musiclover</p>
            <p className="text-sm text-muted-foreground">Can't stop listening to this</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export const SongSheet: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="rounded-full">Select Song</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Choose a song</SheetTitle>
          <SheetDescription>
            Select from your liked or studied songs
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer">
            <div className="w-12 h-12 bg-muted rounded-md" />
            <div className="flex-1">
              <p className="text-sm font-medium">Heat of the Night</p>
              <p className="text-xs text-muted-foreground">Scarlett X</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer">
            <div className="w-12 h-12 bg-muted rounded-md" />
            <div className="flex-1">
              <p className="text-sm font-medium">Down Home Blues</p>
              <p className="text-xs text-muted-foreground">Ethel Waters</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
