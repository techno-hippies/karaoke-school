import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
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
    <Tabs defaultValue="account" className="w-96">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account" className="text-foreground">
        <p className="text-sm text-muted-foreground">
          Make changes to your account here. Click save when you're done.
        </p>
      </TabsContent>
      <TabsContent value="password" className="text-foreground">
        <p className="text-sm text-muted-foreground">
          Change your password here. After saving, you'll be logged out.
        </p>
      </TabsContent>
    </Tabs>
  )
}

export const ThreeTabs: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-96">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-foreground">
        <p className="text-sm text-muted-foreground">Overview content goes here</p>
      </TabsContent>
      <TabsContent value="analytics" className="text-foreground">
        <p className="text-sm text-muted-foreground">Analytics content goes here</p>
      </TabsContent>
      <TabsContent value="reports" className="text-foreground">
        <p className="text-sm text-muted-foreground">Reports content goes here</p>
      </TabsContent>
    </Tabs>
  )
}

export const SongSheetTabs: Story = {
  render: () => (
    <Tabs defaultValue="liked" className="w-96">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="liked">Liked</TabsTrigger>
        <TabsTrigger value="studied">Studied</TabsTrigger>
      </TabsList>
      <TabsContent value="liked" className="space-y-2">
        <div className="p-4 border border-border rounded-md">
          <p className="font-medium text-foreground">Heat of the Night</p>
          <p className="text-sm text-muted-foreground">Scarlett X</p>
        </div>
        <div className="p-4 border border-border rounded-md">
          <p className="font-medium text-foreground">Down Home Blues</p>
          <p className="text-sm text-muted-foreground">Ethel Waters</p>
        </div>
      </TabsContent>
      <TabsContent value="studied" className="space-y-2">
        <div className="p-4 border border-border rounded-md">
          <p className="font-medium text-foreground">Mockingbird</p>
          <p className="text-sm text-muted-foreground">Eminem</p>
        </div>
      </TabsContent>
    </Tabs>
  )
}
