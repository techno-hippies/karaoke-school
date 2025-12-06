import type { Meta, StoryObj } from 'storybook-solidjs'
import { SongItem } from './SongItem'

const meta: Meta<typeof SongItem> = {
  title: 'Components/SongItem',
  component: SongItem,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    artist: { control: 'text' },
    artworkUrl: { control: 'text' },
    rank: { control: 'number' },
  },
}

export default meta
type Story = StoryObj<typeof SongItem>

export const Default: Story = {
  args: {
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
  },
}

export const WithRank: Story = {
  args: {
    title: 'Lose Yourself',
    artist: 'Eminem',
    artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2736ca5c90113b30c3c43ffb8f4',
    rank: 1,
  },
}

export const NoArtwork: Story = {
  args: {
    title: 'Unknown Track',
    artist: 'Mystery Artist',
  },
}

export const LongText: Story = {
  args: {
    title: 'This Is A Very Long Song Title That Should Be Truncated',
    artist: 'Artist Name That Is Also Very Long And Should Be Truncated Too',
    artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
  },
}

export const SongList: Story = {
  render: () => (
    <div class="flex flex-col gap-1 max-w-md">
      <SongItem
        title="Bohemian Rhapsody"
        artist="Queen"
        artworkUrl="https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a"
        rank={1}
      />
      <SongItem
        title="Toxic"
        artist="Britney Spears"
        artworkUrl="https://i.scdn.co/image/ab67616d0000b273bca9e64a0bfd1a85c2f05c9f"
        rank={2}
      />
      <SongItem
        title="Bad Guy"
        artist="Billie Eilish"
        artworkUrl="https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce"
        rank={3}
      />
      <SongItem
        title="Lose Yourself"
        artist="Eminem"
        artworkUrl="https://i.scdn.co/image/ab67616d0000b2736ca5c90113b30c3c43ffb8f4"
        rank={4}
      />
    </div>
  ),
}
