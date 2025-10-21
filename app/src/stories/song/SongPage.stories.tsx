import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SongPage, type LeaderboardEntry } from '@/components/song/SongPage'
import type { VideoPost } from '@/components/video/VideoGrid'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const meta = {
  title: 'Song/SongPage',
  component: SongPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof SongPage>

export default meta
type Story = StoryObj<typeof meta>

// Sample external links
const sampleSongLinks = [
  { label: 'Spotify', url: 'https://open.spotify.com/track/example' },
  { label: 'Apple Music', url: 'https://music.apple.com/track/example' },
  { label: 'YouTube', url: 'https://youtube.com/watch?v=example' },
]

const sampleLyricsLinks = [
  { label: 'Genius', url: 'https://genius.com/example' },
  { label: 'Intellectual', url: 'https://intellectual.insprill.net/example' },
  { label: 'Dumb', url: 'https://dumb.lunar.icu/example' },
]

// Sample video posts
const sampleVideos: VideoPost[] = [
  {
    id: '1',
    thumbnailUrl: 'https://picsum.photos/400/711?random=1',
    username: 'dance_queen',
  },
  {
    id: '2',
    thumbnailUrl: 'https://picsum.photos/400/711?random=2',
    username: 'rhythm_master',
  },
  {
    id: '3',
    thumbnailUrl: 'https://picsum.photos/400/711?random=3',
    username: 'vocal_hero',
  },
  {
    id: '4',
    thumbnailUrl: 'https://picsum.photos/400/711?random=4',
    username: 'melody_star',
  },
  {
    id: '5',
    thumbnailUrl: 'https://picsum.photos/400/711?random=5',
    username: 'beat_boxer',
  },
  {
    id: '6',
    thumbnailUrl: 'https://picsum.photos/400/711?random=6',
    username: 'karaoke_king',
  },
]

// Sample leaderboard
const sampleLeaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    username: 'karaoke_king',
    score: 9850,
    avatarUrl: 'https://placebear.com/100/100',
  },
  {
    rank: 2,
    username: 'melody_master',
    score: 8720,
    avatarUrl: 'https://placebear.com/101/101',
  },
  {
    rank: 3,
    username: 'rhythm_queen',
    score: 7890,
    avatarUrl: 'https://placebear.com/102/102',
  },
  {
    rank: 4,
    username: 'vocal_hero',
    score: 6543,
    avatarUrl: 'https://placebear.com/103/103',
  },
  {
    rank: 5,
    username: 'dance_star',
    score: 5432,
    avatarUrl: 'https://placebear.com/104/104',
  },
]

const currentUser: LeaderboardEntry = {
  rank: 15,
  username: 'you',
  score: 2340,
  avatarUrl: 'https://placebear.com/105/105',
  isCurrentUser: true,
}

/**
 * Song page with videos - the main use case
 */
export const WithVideos: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    songLinks: sampleSongLinks,
    lyricsLinks: sampleLyricsLinks,
    leaderboardEntries: sampleLeaderboard,
    currentUser,
    videos: sampleVideos,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play full song'),
    onArtistClick: () => console.log('Artist clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

/**
 * Song page with no videos yet
 */
export const EmptyState: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    songLinks: sampleSongLinks,
    lyricsLinks: sampleLyricsLinks,
    leaderboardEntries: sampleLeaderboard,
    currentUser,
    videos: [],
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play full song'),
    onArtistClick: () => console.log('Artist clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

/**
 * Song page with many videos (scrollable grid)
 */
export const ManyVideos: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    songLinks: sampleSongLinks,
    lyricsLinks: sampleLyricsLinks,
    leaderboardEntries: sampleLeaderboard,
    currentUser,
    videos: [
      ...sampleVideos,
      ...sampleVideos.map((v, i) => ({ ...v, id: `${v.id}-${i}` })),
      ...sampleVideos.map((v, i) => ({ ...v, id: `${v.id}-${i}-2` })),
    ],
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play full song'),
    onArtistClick: () => console.log('Artist clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

/**
 * Song page focused on Students tab
 */
export const StudentsTab: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    songLinks: sampleSongLinks,
    lyricsLinks: sampleLyricsLinks,
    leaderboardEntries: sampleLeaderboard,
    currentUser,
    videos: sampleVideos,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play full song'),
    onArtistClick: () => console.log('Artist clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

/**
 * Song page with minimal data
 */
export const Minimal: Story = {
  args: {
    songTitle: 'Untitled Song',
    artist: 'Unknown Artist',
    songLinks: [],
    lyricsLinks: [],
    leaderboardEntries: [],
    videos: [],
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play full song'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}
