import type { Meta, StoryObj } from '@storybook/react-vite'
import { SongListItem } from '@/components/ui/SongListItem'

const meta = {
  title: 'UI/SongListItem',
  component: SongListItem,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: 'oklch(0.1818 0.0170 299.9718)' }],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
    },
    artist: {
      control: 'text',
    },
    artworkUrl: {
      control: 'text',
    },
    dueCount: {
      control: 'number',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl mx-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SongListItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    onClick: () => console.log('Song clicked'),
  },
}

export const WithPlayButton: Story = {
  args: {
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/400/400',
    showPlayButton: true,
    onPlayClick: () => console.log('Play clicked'),
    onClick: () => console.log('Song clicked'),
  },
}

export const WithArtwork: Story = {
  args: {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artworkUrl: 'https://placebear.com/g/400/400',
    onClick: () => console.log('Song clicked'),
  },
}

export const WithDueCount: Story = {
  args: {
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    dueCount: 5,
    onClick: () => console.log('Song clicked'),
  },
}

export const WithArtworkAndDue: Story = {
  args: {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artworkUrl: 'https://placebear.com/401/401',
    dueCount: 12,
    onClick: () => console.log('Song clicked'),
  },
}

export const HighDueCount: Story = {
  args: {
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    artworkUrl: 'https://placebear.com/402/402',
    dueCount: 99,
    onClick: () => console.log('Song clicked'),
  },
}

export const LongTitles: Story = {
  args: {
    title: 'The Night We Met (From "13 Reasons Why" Soundtrack)',
    artist: 'Lord Huron & The Amazing String Orchestra',
    dueCount: 3,
    onClick: () => console.log('Song clicked'),
  },
}

export const SongList: Story = {
  render: () => (
    <div className="space-y-2">
      <SongListItem
        title="Heat of the Night"
        artist="Scarlett X"
        dueCount={5}
        onClick={() => console.log('Song 1 clicked')}
      />
      <SongListItem
        title="Blinding Lights"
        artist="The Weeknd"
        artworkUrl="https://placebear.com/403/403"
        dueCount={12}
        onClick={() => console.log('Song 2 clicked')}
      />
      <SongListItem
        title="Shape of You"
        artist="Ed Sheeran"
        artworkUrl="https://placebear.com/g/404/404"
        onClick={() => console.log('Song 3 clicked')}
      />
      <SongListItem
        title="Down Home Blues"
        artist="Ethel Waters"
        dueCount={8}
        onClick={() => console.log('Song 4 clicked')}
      />
      <SongListItem
        title="Someone Like You"
        artist="Adele"
        artworkUrl="https://placebear.com/405/405"
        dueCount={3}
        onClick={() => console.log('Song 5 clicked')}
      />
    </div>
  ),
}
