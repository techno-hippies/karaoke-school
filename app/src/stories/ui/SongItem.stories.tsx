import type { Meta, StoryObj } from '@storybook/react-vite'
import { SongItem } from '@/components/ui/SongItem'
import { ItemGroup } from '@/components/ui/item'

const meta = {
  title: 'UI/SongItem',
  component: SongItem,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
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
    showPlayButton: {
      control: 'boolean',
    },
    isPlaying: {
      control: 'boolean',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl mx-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SongItem>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default song item with gradient fallback
 */
export const Default: Story = {
  args: {
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    onClick: () => console.log('Song clicked'),
  },
}

/**
 * Song with album artwork
 */
export const WithArtwork: Story = {
  args: {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artworkUrl: 'https://placebear.com/400/400',
    onClick: () => console.log('Song clicked'),
  },
}

/**
 * Song with play button overlay
 */
export const WithPlayButton: Story = {
  args: {
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/401/401',
    showPlayButton: true,
    onPlayClick: () => console.log('Play clicked'),
    onClick: () => console.log('Song clicked'),
  },
}

/**
 * Currently playing state (pause button)
 */
export const Playing: Story = {
  args: {
    title: 'Down Home Blues',
    artist: 'Ethel Waters',
    artworkUrl: 'https://placebear.com/402/402',
    showPlayButton: true,
    isPlaying: true,
    onPlayClick: () => console.log('Pause clicked'),
    onClick: () => console.log('Song clicked'),
  },
}

/**
 * Song with gradient fallback and play button
 */
export const GradientWithPlay: Story = {
  args: {
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    showPlayButton: true,
    onPlayClick: () => console.log('Play clicked'),
    onClick: () => console.log('Song clicked'),
  },
}

/**
 * Long titles and artist names (truncation test)
 */
export const LongTitles: Story = {
  args: {
    title: 'The Night We Met (From "13 Reasons Why" Soundtrack)',
    artist: 'Lord Huron & The Amazing String Orchestra',
    artworkUrl: 'https://placebear.com/403/403',
    showPlayButton: true,
    onPlayClick: () => console.log('Play clicked'),
    onClick: () => console.log('Song clicked'),
  },
}

/**
 * List of songs - mixed states (playing, paused, no button, gradient fallback)
 */
export const SongList: Story = {
  render: () => (
    <ItemGroup className="gap-2">
      <SongItem
        title="Heat of the Night"
        artist="Scarlett X"
        artworkUrl="https://placebear.com/404/404"
        showPlayButton
        isPlaying
        onPlayClick={() => console.log('Pause Heat of the Night')}
        onClick={() => console.log('Song 1 clicked')}
      />
      <SongItem
        title="Blinding Lights"
        artist="The Weeknd"
        artworkUrl="https://placebear.com/405/405"
        showPlayButton
        onPlayClick={() => console.log('Play Blinding Lights')}
        onClick={() => console.log('Song 2 clicked')}
      />
      <SongItem
        title="Shape of You"
        artist="Ed Sheeran"
        showPlayButton
        onPlayClick={() => console.log('Play Shape of You')}
        onClick={() => console.log('Song 3 clicked')}
      />
      <SongItem
        title="Down Home Blues"
        artist="Ethel Waters"
        artworkUrl="https://placebear.com/406/406"
        onClick={() => console.log('Song 4 clicked')}
      />
      <SongItem
        title="Someone Like You"
        artist="Adele"
        artworkUrl="https://placebear.com/407/407"
        showPlayButton
        onPlayClick={() => console.log('Play Someone Like You')}
        onClick={() => console.log('Song 5 clicked')}
      />
    </ItemGroup>
  ),
}
