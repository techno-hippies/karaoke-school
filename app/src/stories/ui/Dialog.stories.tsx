import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const meta: Meta<typeof Dialog> = {
  title: 'UI/Dialog',
  component: Dialog,
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

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your account
            and remove your data from our servers.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

export const WithForm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Edit Profile</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input id="name" defaultValue="Pedro Duarte" />
          </div>
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <Input id="username" defaultValue="@peduarte" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const UsernameModal: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Set Username</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose your username</DialogTitle>
          <DialogDescription>
            Your username must be at least 7 characters long.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Input
              id="username"
              placeholder="Enter username (7+ characters)"
              className="text-base"
            />
          </div>
        </div>
        <DialogFooter>
          <Button>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
