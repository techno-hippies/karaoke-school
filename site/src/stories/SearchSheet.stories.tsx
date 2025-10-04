import type { Meta, StoryObj } from '@storybook/react'
import { SearchSheet } from '../components/ui/SearchSheet'

const mockResults = [
  {
    genius_id: 1,
    title: 'Heat of the Night',
    title_with_featured: 'Heat of the Night',
    artist: 'Scarlett X',
    genius_slug: 'scarlett-x-heat-of-the-night',
    url: 'https://genius.com/Scarlett-x-heat-of-the-night-lyrics',
    artwork_thumbnail: 'https://images.genius.com/1234/200x200.jpg',
    lyrics_state: 'complete',
  },
  {
    genius_id: 2,
    title: 'Down Home Blues',
    title_with_featured: 'Down Home Blues',
    artist: 'Ethel Waters',
    genius_slug: 'ethel-waters-down-home-blues',
    url: 'https://genius.com/Ethel-waters-down-home-blues-lyrics',
    artwork_thumbnail: null,
    lyrics_state: 'complete',
  },
  {
    genius_id: 3,
    title: 'Billie Jean',
    title_with_featured: 'Billie Jean',
    artist: 'Michael Jackson',
    genius_slug: 'michael-jackson-billie-jean',
    url: 'https://genius.com/Michael-jackson-billie-jean-lyrics',
    artwork_thumbnail: 'https://images.genius.com/5678/200x200.jpg',
    lyrics_state: 'complete',
  },
]

const meta = {
  title: 'Components/SearchSheet',
  component: SearchSheet,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the search sheet is open',
    },
    isConnected: {
      control: 'boolean',
      description: 'Whether wallet is connected',
    },
    isLoading: {
      control: 'boolean',
      description: 'Loading state',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
    onClose: {
      action: 'closed',
      description: 'Called when sheet is closed',
    },
    onSearch: {
      action: 'searched',
      description: 'Called when search is triggered',
    },
    onResultClick: {
      action: 'result-clicked',
      description: 'Called when a search result is clicked',
    },
    onConnectClick: {
      action: 'connect-clicked',
      description: 'Called when connect wallet is clicked',
    },
  },
} satisfies Meta<typeof SearchSheet>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    isOpen: true,
    isConnected: true,
    searchResults: [],
    isLoading: false,
    error: null,
  },
}

export const WithResults: Story = {
  args: {
    isOpen: true,
    isConnected: true,
    searchResults: mockResults,
    isLoading: false,
    error: null,
  },
}

export const Loading: Story = {
  args: {
    isOpen: true,
    isConnected: true,
    searchResults: [],
    isLoading: true,
    error: null,
  },
}

export const NoResults: Story = {
  args: {
    isOpen: true,
    isConnected: true,
    searchResults: [],
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    // Simulate search with no results
    const input = canvasElement.querySelector('input')
    if (input) {
      input.value = 'nonexistent song xyz'
    }
  },
}

export const WithError: Story = {
  args: {
    isOpen: true,
    isConnected: true,
    searchResults: [],
    isLoading: false,
    error: 'Failed to search. Please try again.',
  },
}

export const Disconnected: Story = {
  args: {
    isOpen: true,
    isConnected: false,
    searchResults: [],
    isLoading: false,
    error: null,
  },
}

export const Closed: Story = {
  args: {
    isOpen: false,
    isConnected: true,
    searchResults: [],
    isLoading: false,
    error: null,
  },
}

export const ManyResults: Story = {
  args: {
    isOpen: true,
    isConnected: true,
    searchResults: [
      ...mockResults,
      ...mockResults.map((r, i) => ({ ...r, genius_id: i + 100 })),
      ...mockResults.map((r, i) => ({ ...r, genius_id: i + 200 })),
      ...mockResults.map((r, i) => ({ ...r, genius_id: i + 300 })),
    ],
    isLoading: false,
    error: null,
  },
}

export const LongTitles: Story = {
  args: {
    isOpen: true,
    isConnected: true,
    searchResults: [
      {
        genius_id: 999,
        title: 'This Is A Very Long Song Title That Should Truncate When Displayed',
        title_with_featured: 'This Is A Very Long Song Title That Should Truncate When Displayed (feat. Many Artists)',
        artist: 'Artist With A Very Long Name That Also Should Truncate',
        genius_slug: 'long-song',
        url: 'https://genius.com/long-song',
        artwork_thumbnail: 'https://images.genius.com/999/200x200.jpg',
        lyrics_state: 'complete',
      },
    ],
    isLoading: false,
    error: null,
  },
}

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  args: {
    isOpen: true,
    isConnected: true,
    searchResults: mockResults,
    isLoading: false,
    error: null,
  },
}
