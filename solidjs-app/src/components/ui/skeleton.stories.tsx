import type { Meta, StoryObj } from 'storybook-solidjs'
import { Skeleton } from './skeleton'

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Skeleton>

export const Default: Story = {
  args: {
    class: 'h-4 w-48',
  },
}

export const Circle: Story = {
  args: {
    class: 'h-12 w-12 rounded-full',
  },
}

export const Card: Story = {
  render: () => (
    <div class="flex items-center gap-4 p-4">
      <Skeleton class="h-12 w-12 rounded-full" />
      <div class="space-y-2">
        <Skeleton class="h-4 w-48" />
        <Skeleton class="h-4 w-32" />
      </div>
    </div>
  ),
}

export const SongItemSkeleton: Story = {
  render: () => (
    <div class="flex items-center gap-3 p-2">
      <Skeleton class="h-12 w-12 rounded-lg" />
      <div class="flex-1 space-y-2">
        <Skeleton class="h-4 w-3/4" />
        <Skeleton class="h-3 w-1/2" />
      </div>
    </div>
  ),
}

export const SongTileSkeleton: Story = {
  render: () => (
    <div class="w-32">
      <Skeleton class="aspect-square w-full rounded-2xl" />
      <Skeleton class="h-4 w-3/4 mt-2" />
      <Skeleton class="h-4 w-1/2 mt-1" />
    </div>
  ),
}

export const ListSkeleton: Story = {
  render: () => (
    <div class="space-y-4">
      {[1, 2, 3].map((i) => (
        <div class="flex items-center gap-3 p-2">
          <Skeleton class="h-12 w-12 rounded-lg" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  ),
}
