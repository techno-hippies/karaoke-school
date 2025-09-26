import type { Meta, StoryObj } from '@storybook/react';
import { SongListItem, type Song } from '../components/ui/SongListItem';

const meta: Meta<typeof SongListItem> = {
  title: 'Content Creation/SongListItem',
  component: SongListItem,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-screen w-full bg-neutral-900 p-4">
        <div className="w-full max-w-sm mx-auto bg-neutral-800 rounded-lg overflow-hidden">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Sample song data
const sampleSong: Song = {
  id: '1',
  title: 'Summer Vibes',
  artist: 'Popular Artist',
  duration: 200, // 3:20
  thumbnailUrl: 'https://picsum.photos/200/200?random=1',
  audioUrl: 'https://example.com/audio.mp3',
};

const longTitleSong: Song = {
  id: '2',
  title: 'Dancing Through the Night (This is a very long song title that should be truncated properly)',
  artist: 'Artist Name with a Very Long Name',
  duration: 167, // 2:47
  thumbnailUrl: 'https://picsum.photos/200/200?random=2',
  audioUrl: 'https://example.com/audio2.mp3',
};

const noThumbnailSong: Song = {
  id: '3',
  title: 'Midnight Dreams',
  artist: 'Indie Artist',
  duration: 201, // 3:21
  audioUrl: 'https://example.com/audio3.mp3',
};

const shortSong: Song = {
  id: '4',
  title: 'Quick Beat',
  artist: 'Local Creator',
  duration: 15, // 0:15
  thumbnailUrl: 'https://picsum.photos/200/200?random=4',
  audioUrl: 'https://example.com/audio4.mp3',
};

export const Default: Story = {
  args: {
    song: sampleSong,
    onClick: (song) => console.log('Song clicked:', song.title),
    onPlay: (song) => console.log('Play clicked:', song.title),
  },
};

export const Selected: Story = {
  args: {
    song: sampleSong,
    isSelected: true,
    onClick: (song) => console.log('Song clicked:', song.title),
    onPlay: (song) => console.log('Play clicked:', song.title),
  },
};

export const Playing: Story = {
  args: {
    song: sampleSong,
    isPlaying: true,
    onClick: (song) => console.log('Song clicked:', song.title),
    onPlay: (song) => console.log('Play clicked:', song.title),
  },
};

export const SelectedAndPlaying: Story = {
  args: {
    song: sampleSong,
    isSelected: true,
    isPlaying: true,
    onClick: (song) => console.log('Song clicked:', song.title),
    onPlay: (song) => console.log('Play clicked:', song.title),
  },
};

export const LongTitle: Story = {
  args: {
    song: longTitleSong,
    onClick: (song) => console.log('Song clicked:', song.title),
    onPlay: (song) => console.log('Play clicked:', song.title),
  },
};

export const NoThumbnail: Story = {
  args: {
    song: noThumbnailSong,
    onClick: (song) => console.log('Song clicked:', song.title),
    onPlay: (song) => console.log('Play clicked:', song.title),
  },
};

export const ShortDuration: Story = {
  args: {
    song: shortSong,
    onClick: (song) => console.log('Song clicked:', song.title),
    onPlay: (song) => console.log('Play clicked:', song.title),
  },
};

export const WithSelectButton: Story = {
  args: {
    song: sampleSong,
    showSelectButton: true,
    onClick: (song) => console.log('Song clicked:', song.title),
    onPlay: (song) => console.log('Play clicked:', song.title),
    onSelect: (song) => console.log('Select clicked:', song.title),
  },
};

export const PlayingWithSelectButton: Story = {
  args: {
    song: sampleSong,
    isPlaying: true,
    showSelectButton: true,
    onClick: (song) => console.log('Song clicked:', song.title),
    onPlay: (song) => console.log('Play clicked:', song.title),
    onSelect: (song) => console.log('Select clicked:', song.title),
  },
};

// List example with multiple songs
export const SongList: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen w-full bg-neutral-900 p-4">
        <div className="w-full max-w-sm mx-auto bg-neutral-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-neutral-700">
            <h2 className="text-white font-semibold">Select a Song</h2>
          </div>
          <div className="divide-y divide-neutral-700">
            <SongListItem
              song={sampleSong}
              onClick={(song) => console.log('Song clicked:', song.title)}
              onPlay={(song) => console.log('Play clicked:', song.title)}
            />
            <SongListItem
              song={longTitleSong}
              isSelected={true}
              onClick={(song) => console.log('Song clicked:', song.title)}
              onPlay={(song) => console.log('Play clicked:', song.title)}
            />
            <SongListItem
              song={noThumbnailSong}
              isPlaying={true}
              onClick={(song) => console.log('Song clicked:', song.title)}
              onPlay={(song) => console.log('Play clicked:', song.title)}
            />
            <SongListItem
              song={shortSong}
              onClick={(song) => console.log('Song clicked:', song.title)}
              onPlay={(song) => console.log('Play clicked:', song.title)}
            />
          </div>
        </div>
      </div>
    ),
  ],
  render: () => <></>,
};