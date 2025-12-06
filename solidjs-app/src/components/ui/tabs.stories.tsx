import type { Meta, StoryObj } from 'storybook-solidjs'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'

const meta: Meta = {
  title: 'UI/Tabs',
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="songs" class="w-full max-w-md">
      <TabsList class="w-full grid grid-cols-2">
        <TabsTrigger value="songs">Songs</TabsTrigger>
        <TabsTrigger value="students">Students</TabsTrigger>
      </TabsList>
      <TabsContent value="songs">
        <div class="p-4 text-center text-muted-foreground">
          Songs content goes here
        </div>
      </TabsContent>
      <TabsContent value="students">
        <div class="p-4 text-center text-muted-foreground">
          Students content goes here
        </div>
      </TabsContent>
    </Tabs>
  ),
}

export const ThreeTabs: Story = {
  render: () => (
    <Tabs defaultValue="lyrics" class="w-full max-w-md">
      <TabsList class="w-full grid grid-cols-3">
        <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
        <TabsTrigger value="info">Info</TabsTrigger>
        <TabsTrigger value="related">Related</TabsTrigger>
      </TabsList>
      <TabsContent value="lyrics">
        <div class="p-4">Lyrics panel</div>
      </TabsContent>
      <TabsContent value="info">
        <div class="p-4">Song info panel</div>
      </TabsContent>
      <TabsContent value="related">
        <div class="p-4">Related songs panel</div>
      </TabsContent>
    </Tabs>
  ),
}

export const WithDisabled: Story = {
  render: () => (
    <Tabs defaultValue="profile" class="w-full max-w-md">
      <TabsList class="w-full grid grid-cols-4">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="settings" disabled>Settings</TabsTrigger>
        <TabsTrigger value="contact">Contact</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">Profile details</TabsContent>
      <TabsContent value="dashboard">Dashboard details</TabsContent>
      <TabsContent value="settings">Settings details</TabsContent>
      <TabsContent value="contact">Contact details</TabsContent>
    </Tabs>
  ),
}
