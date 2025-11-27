import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof Drawer> = {
  title: 'UI/Drawer',
  component: Drawer,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.145 0 0)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Open Drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Are you absolutely sure?</DrawerTitle>
          <DrawerDescription>This action cannot be undone.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Submit</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export const WithContent: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Open with Content</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Song Selection</DrawerTitle>
          <DrawerDescription>Choose a song from the list below</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-600 rounded-md flex items-center justify-center">
              <span className="text-xl">🎤</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Blinding Lights</p>
              <p className="text-xs text-muted-foreground">The Weeknd</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-600 rounded-md flex items-center justify-center">
              <span className="text-xl">🎤</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Shape of You</p>
              <p className="text-xs text-muted-foreground">Ed Sheeran</p>
            </div>
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export const ConfirmAction: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="destructive">Delete Account</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Confirm Deletion</DrawerTitle>
          <DrawerDescription>
            This will permanently delete your account and all associated data.
            This action cannot be undone.
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-foreground">
              ⚠️ Warning: This is a permanent action
            </p>
          </div>
        </div>
        <DrawerFooter>
          <Button variant="destructive">Yes, Delete My Account</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export const CompactForm: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Quick Add</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add New Item</DrawerTitle>
          <DrawerDescription>Fill in the details below</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-background border rounded-md"
              placeholder="Enter name..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="w-full px-3 py-2 bg-background border rounded-md"
              placeholder="Enter description..."
              rows={3}
            />
          </div>
        </div>
        <DrawerFooter>
          <Button>Add Item</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
