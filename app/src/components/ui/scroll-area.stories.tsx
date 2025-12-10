import type { Meta, StoryObj } from 'storybook-solidjs'
import { ScrollArea } from './scroll-area'
import { SongTile } from '../song/SongTile'

const meta: Meta<typeof ScrollArea> = {
  title: 'UI/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ScrollArea>

const songs = [
  { title: 'Bohemian Rhapsody', artist: 'Queen', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a' },
  { title: 'Toxic', artist: 'Britney Spears', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273bca9e64a0bfd1a85c2f05c9f' },
  { title: 'Bad Guy', artist: 'Billie Eilish', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce' },
  { title: 'Lose Yourself', artist: 'Eminem', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2736ca5c90113b30c3c43ffb8f4' },
  { title: 'Shape of You', artist: 'Ed Sheeran', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96' },
  { title: 'Blinding Lights', artist: 'The Weeknd', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' },
]

export const Horizontal: Story = {
  render: () => (
    <ScrollArea orientation="horizontal" class="w-full pb-4">
      <div class="flex gap-3">
        {songs.map((song) => (
          <SongTile title={song.title} artist={song.artist} artworkUrl={song.artworkUrl} />
        ))}
      </div>
    </ScrollArea>
  ),
}

export const HorizontalHiddenScrollbar: Story = {
  render: () => (
    <ScrollArea orientation="horizontal" hideScrollbar class="w-full">
      <div class="flex gap-3">
        {songs.map((song) => (
          <SongTile title={song.title} artist={song.artist} artworkUrl={song.artworkUrl} />
        ))}
      </div>
    </ScrollArea>
  ),
}

export const Vertical: Story = {
  decorators: [(Story) => <div class="h-48"><Story /></div>],
  render: () => (
    <ScrollArea orientation="vertical" class="h-full">
      <div class="space-y-4 pr-4">
        {[...songs, ...songs].map((song, i) => (
          <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
            <img src={song.artworkUrl} class="w-12 h-12 rounded-lg object-cover" />
            <div>
              <p class="font-medium">{song.title}</p>
              <p class="text-sm text-muted-foreground">{song.artist}</p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
}
