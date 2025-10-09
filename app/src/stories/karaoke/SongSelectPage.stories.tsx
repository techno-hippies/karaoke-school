import type { Meta, StoryObj } from '@storybook/react-vite'
import { SongSelectPage, type Song, type SongSegment } from '@/components/karaoke/SongSelectPage'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Karaoke/SongSelectPage',
  component: SongSelectPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SongSelectPage>

export default meta
type Story = StoryObj<typeof meta>

// Free audio sample for demo purposes
const DEMO_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

// Sample segments for processed songs
const sampleSegments: SongSegment[] = [
  { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 15, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
  { id: 'chorus', displayName: 'Chorus', startTime: 15, endTime: 30, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
  { id: 'verse-2', displayName: 'Verse 2', startTime: 45, endTime: 60, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
  { id: 'bridge', displayName: 'Bridge', startTime: 90, endTime: 105, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
]

const trendingSongs: Song[] = [
  {
    id: '1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artworkUrl: 'https://picsum.photos/seed/song1/200/200',
    isFree: false,
  },
  {
    id: '2',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    artworkUrl: 'https://picsum.photos/seed/song2/200/200',
    isFree: true,
  },
  {
    id: '3',
    title: 'Dance Monkey',
    artist: 'Tones and I',
    artworkUrl: 'https://picsum.photos/seed/song3/200/200',
    isFree: false,
  },
  {
    id: '4',
    title: 'Someone Like You',
    artist: 'Adele',
    artworkUrl: 'https://picsum.photos/seed/song4/200/200',
    isFree: true,
  },
  {
    id: '5',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    artworkUrl: 'https://picsum.photos/seed/song5/200/200',
    isFree: false,
  },
  {
    id: '6',
    title: 'Levitating',
    artist: 'Dua Lipa',
    artworkUrl: 'https://picsum.photos/seed/song6/200/200',
    isFree: true,
  },
  {
    id: '7',
    title: 'As It Was',
    artist: 'Harry Styles',
    artworkUrl: 'https://picsum.photos/seed/song7/200/200',
    isFree: false,
  },
  {
    id: '8',
    title: 'Anti-Hero',
    artist: 'Taylor Swift',
    artworkUrl: 'https://picsum.photos/seed/song8/200/200',
    isFree: true,
  },
  {
    id: '9',
    title: 'Heat Waves',
    artist: 'Glass Animals',
    artworkUrl: 'https://picsum.photos/seed/song9/200/200',
    isFree: false,
  },
  {
    id: '10',
    title: 'Shivers',
    artist: 'Ed Sheeran',
    artworkUrl: 'https://picsum.photos/seed/song10/200/200',
    isFree: false,
  },
]

const favoriteSongs: Song[] = [
  {
    id: '11',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    artworkUrl: 'https://picsum.photos/seed/fav1/200/200',
    isFree: false,
  },
  {
    id: '12',
    title: 'Don\'t Stop Believin\'',
    artist: 'Journey',
    artworkUrl: 'https://picsum.photos/seed/fav2/200/200',
    isFree: true,
  },
  {
    id: '13',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    artworkUrl: 'https://picsum.photos/seed/fav3/200/200',
    isFree: false,
  },
  {
    id: '14',
    title: 'I Will Always Love You',
    artist: 'Whitney Houston',
    artworkUrl: 'https://picsum.photos/seed/fav4/200/200',
    isFree: true,
  },
  {
    id: '15',
    title: 'Wonderwall',
    artist: 'Oasis',
    artworkUrl: 'https://picsum.photos/seed/fav5/200/200',
    isFree: false,
  },
]

/**
 * Default page - Trending tab
 */
export const Default: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close clicked'),
    trendingSongs,
    favoriteSongs,
    onSelectSong: (song) => console.log('Selected song:', song),
  },
}

/**
 * Empty trending list
 */
export const EmptyTrending: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close clicked'),
    trendingSongs: [],
    favoriteSongs,
    onSelectSong: (song) => console.log('Selected song:', song),
  },
}

/**
 * Empty favorites list
 */
export const EmptyFavorites: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close clicked'),
    trendingSongs,
    favoriteSongs: [],
    onSelectSong: (song) => console.log('Selected song:', song),
  },
}

/**
 * Interactive - Click button to open
 */
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [selectedSong, setSelectedSong] = useState<Song | null>(null)

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Button onClick={() => setOpen(true)}>
          Select a song
        </Button>
        {selectedSong && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Selected:</p>
            <p className="text-lg font-semibold">{selectedSong.title}</p>
            <p className="text-sm text-muted-foreground">{selectedSong.artist}</p>
          </div>
        )}
        <SongSelectPage
          open={open}
          onClose={() => setOpen(false)}
          trendingSongs={trendingSongs}
          favoriteSongs={favoriteSongs}
          onSelectSong={(song) => {
            setSelectedSong(song)
            console.log('Selected song:', song)
          }}
        />
      </div>
    )
  },
}

/**
 * No Credits - Shows purchase sheet when song is selected
 */
export const NoCredits: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [purchased, setPurchased] = useState(false)

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Button onClick={() => setOpen(true)}>
          Select a song (0 credits)
        </Button>
        {purchased && (
          <div className="text-center p-4 bg-green-500/20 rounded-lg">
            <p className="text-lg font-semibold">Credits purchased!</p>
          </div>
        )}
        <SongSelectPage
          open={open}
          onClose={() => setOpen(false)}
          trendingSongs={trendingSongs}
          favoriteSongs={favoriteSongs}
          userCredits={0}
          onPurchaseCredits={() => {
            setPurchased(true)
            console.log('Credits purchased!')
            setTimeout(() => setPurchased(false), 3000)
          }}
        />
      </div>
    )
  },
}

/**
 * Has Credits - Shows segment picker then confirm sheet
 */
export const HasCredits: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    const [credits, setCredits] = useState(5)

    // Add segments to processed songs
    const processedSongs: Song[] = trendingSongs.map(song => ({
      ...song,
      isProcessed: true,
      segments: sampleSegments,
    }))

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground">Credits: {credits}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          Select a song ({credits} credits)
        </Button>
        {confirmed && (
          <div className="text-center p-4 bg-green-500/20 rounded-lg">
            <p className="text-lg font-semibold">Song confirmed!</p>
          </div>
        )}
        <SongSelectPage
          open={open}
          onClose={() => setOpen(false)}
          trendingSongs={processedSongs}
          favoriteSongs={favoriteSongs}
          userCredits={credits}
          onConfirmCredit={(song, segment) => {
            setCredits(credits - 1)
            setConfirmed(true)
            console.log('Confirmed song:', song, 'segment:', segment)
            setTimeout(() => setConfirmed(false), 3000)
          }}
        />
      </div>
    )
  },
}

/**
 * Needs Generation - Shows generate karaoke sheet for unprocessed song
 */
export const NeedsGeneration: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [generated, setGenerated] = useState(false)

    // Mark some songs as not processed
    const mixedSongs: Song[] = trendingSongs.map((song, idx) => ({
      ...song,
      isProcessed: idx > 2, // First 3 songs need generation
      segments: idx > 2 ? sampleSegments : undefined, // Processed songs have segments
    }))

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Button onClick={() => setOpen(true)}>
          Select a song (some need generation)
        </Button>
        {generated && (
          <div className="text-center p-4 bg-blue-500/20 rounded-lg">
            <p className="text-lg font-semibold">Karaoke generation started!</p>
          </div>
        )}
        <SongSelectPage
          open={open}
          onClose={() => setOpen(false)}
          trendingSongs={mixedSongs}
          favoriteSongs={favoriteSongs}
          userCredits={5}
          onGenerateKaraoke={(song) => {
            setGenerated(true)
            console.log('Generating karaoke for:', song)
            setTimeout(() => setGenerated(false), 3000)
          }}
        />
      </div>
    )
  },
}
