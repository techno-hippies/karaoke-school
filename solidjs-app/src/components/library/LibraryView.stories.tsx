import type { Meta, StoryObj } from 'storybook-solidjs'
import { LibraryView } from './LibraryView'

const meta: Meta<typeof LibraryView> = {
  title: 'Components/LibraryView',
  component: LibraryView,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof LibraryView>

const mockSections = [
  {
    id: 'trending',
    title: 'Trending Now',
    songs: [
      { id: '1', title: 'Bohemian Rhapsody', artist: 'Queen', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a' },
      { id: '2', title: 'Toxic', artist: 'Britney Spears', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273bca9e64a0bfd1a85c2f05c9f' },
      { id: '3', title: 'Bad Guy', artist: 'Billie Eilish', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce' },
      { id: '4', title: 'Lose Yourself', artist: 'Eminem', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2736ca5c90113b30c3c43ffb8f4' },
      { id: '5', title: 'Shape of You', artist: 'Ed Sheeran', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96' },
    ],
  },
  {
    id: 'pop',
    title: 'Pop Hits',
    songs: [
      { id: '6', title: 'Blinding Lights', artist: 'The Weeknd', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' },
      { id: '7', title: 'Levitating', artist: 'Dua Lipa', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b27382e706aca2b1b6c7bbd0ab02' },
      { id: '8', title: 'Watermelon Sugar', artist: 'Harry Styles', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b27377fdcfda6535601aff081b6a' },
      { id: '9', title: 'drivers license', artist: 'Olivia Rodrigo', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2738b6ddb8af57f7f66d4f79e7b' },
    ],
  },
  {
    id: 'classics',
    title: 'Classic Rock',
    showArtist: false,
    songs: [
      { id: '10', title: 'Hotel California', artist: 'Eagles', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2734637341b9f507521afa9a778' },
      { id: '11', title: 'Stairway to Heaven', artist: 'Led Zeppelin', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273c1b8f5a01b70af9cb61cb39b' },
      { id: '12', title: 'Sweet Child O Mine', artist: "Guns N' Roses", artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2732659db1c9c68bca49efbfc20' },
    ],
  },
]

export const Default: Story = {
  args: {
    sections: mockSections,
  },
}

export const Loading: Story = {
  args: {
    sections: [],
    isLoading: true,
  },
}

export const Empty: Story = {
  args: {
    sections: [],
  },
}

export const SingleSection: Story = {
  args: {
    sections: [mockSections[0]],
  },
}
