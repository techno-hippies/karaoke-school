import type { Meta, StoryObj } from 'storybook-solidjs'
import { SongTile } from './SongTile'

const meta: Meta<typeof SongTile> = {
  title: 'Components/SongTile',
  component: SongTile,
  tags: ['autodocs'],
  decorators: [(Story) => <div class="w-32"><Story /></div>],
}

export default meta
type Story = StoryObj<typeof SongTile>

export const Default: Story = {
  args: {
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
  },
}

export const NoArtist: Story = {
  args: {
    title: 'Toxic',
    artist: 'Britney Spears',
    artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273bca9e64a0bfd1a85c2f05c9f',
    showArtist: false,
  },
}

export const NoArtwork: Story = {
  args: {
    title: 'Unknown Track',
    artist: 'Mystery Artist',
  },
}

export const HorizontalScroll: Story = {
  decorators: [(Story) => <div class="w-full"><Story /></div>],
  render: () => (
    <div class="flex gap-3 overflow-x-auto pb-2">
      <SongTile
        title="Bohemian Rhapsody"
        artist="Queen"
        artworkUrl="https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a"
      />
      <SongTile
        title="Toxic"
        artist="Britney Spears"
        artworkUrl="https://i.scdn.co/image/ab67616d0000b273bca9e64a0bfd1a85c2f05c9f"
      />
      <SongTile
        title="Bad Guy"
        artist="Billie Eilish"
        artworkUrl="https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce"
      />
      <SongTile
        title="Lose Yourself"
        artist="Eminem"
        artworkUrl="https://i.scdn.co/image/ab67616d0000b2736ca5c90113b30c3c43ffb8f4"
      />
    </div>
  ),
}
