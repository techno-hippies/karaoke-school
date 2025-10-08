import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArtistPage } from '@/components/class/ArtistPage'
import type { ArtistSong } from '@/components/class/ArtistPage'

const meta = {
  title: 'Class/ArtistPage',
  component: ArtistPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ArtistPage>

export default meta
type Story = StoryObj<typeof meta>

const sampleSongs: ArtistSong[] = [
  {
    id: '1',
    title: 'Heat of the Night',
    artworkUrl: 'https://placebear.com/200/200',
    dueCount: 8,
    showPlayButton: true,
    onSongClick: () => console.log('Song clicked: Heat of the Night'),
    onPlayClick: () => console.log('Play clicked: Heat of the Night'),
  },
  {
    id: '2',
    title: 'Midnight Dance',
    artworkUrl: 'https://placebear.com/201/201',
    dueCount: 3,
    showPlayButton: true,
    onSongClick: () => console.log('Song clicked: Midnight Dance'),
    onPlayClick: () => console.log('Play clicked: Midnight Dance'),
  },
  {
    id: '3',
    title: 'Electric Dreams',
    artworkUrl: 'https://placebear.com/202/202',
    dueCount: 12,
    showPlayButton: true,
    onSongClick: () => console.log('Song clicked: Electric Dreams'),
    onPlayClick: () => console.log('Play clicked: Electric Dreams'),
  },
  {
    id: '4',
    title: 'Neon Lights',
    artworkUrl: 'https://placebear.com/203/203',
    dueCount: 0,
    showPlayButton: true,
    onSongClick: () => console.log('Song clicked: Neon Lights'),
    onPlayClick: () => console.log('Play clicked: Neon Lights'),
  },
  {
    id: '5',
    title: 'Stardust',
    artworkUrl: 'https://placebear.com/204/204',
    dueCount: 5,
    showPlayButton: true,
    onSongClick: () => console.log('Song clicked: Stardust'),
    onPlayClick: () => console.log('Play clicked: Stardust'),
  },
]

const sampleLeaderboard = [
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
]

const currentUser = {
  rank: 15,
  username: 'you',
  score: 2340,
  avatarUrl: 'https://placebear.com/104/104',
  isCurrentUser: true,
}

export const QuizDisabled: Story = {
  args: {
    artistName: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    songs: sampleSongs,
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    canQuiz: false,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onQuiz: () => console.log('Quiz clicked'),
  },
}

export const QuizEnabled: Story = {
  args: {
    artistName: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    songs: sampleSongs,
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    canQuiz: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onQuiz: () => console.log('Quiz clicked'),
  },
}

export const ManySongs: Story = {
  args: {
    artistName: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    songs: [
      ...sampleSongs,
      {
        id: '6',
        title: 'Crystal Rain',
        artworkUrl: 'https://placebear.com/205/205',
        dueCount: 2,
        showPlayButton: true,
        onSongClick: () => console.log('Song clicked'),
        onPlayClick: () => console.log('Play clicked'),
      },
      {
        id: '7',
        title: 'Velvet Sky',
        artworkUrl: 'https://placebear.com/206/206',
        dueCount: 7,
        showPlayButton: true,
        onSongClick: () => console.log('Song clicked'),
        onPlayClick: () => console.log('Play clicked'),
      },
      {
        id: '8',
        title: 'Golden Hour',
        artworkUrl: 'https://placebear.com/207/207',
        dueCount: 15,
        showPlayButton: true,
        onSongClick: () => console.log('Song clicked'),
        onPlayClick: () => console.log('Play clicked'),
      },
      {
        id: '9',
        title: 'Moonlight Serenade',
        artworkUrl: 'https://placebear.com/208/208',
        dueCount: 4,
        showPlayButton: true,
        onSongClick: () => console.log('Song clicked'),
        onPlayClick: () => console.log('Play clicked'),
      },
      {
        id: '10',
        title: 'Aurora',
        artworkUrl: 'https://placebear.com/209/209',
        dueCount: 9,
        showPlayButton: true,
        onSongClick: () => console.log('Song clicked'),
        onPlayClick: () => console.log('Play clicked'),
      },
    ],
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    canQuiz: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onQuiz: () => console.log('Quiz clicked'),
  },
}

export const NoArtwork: Story = {
  args: {
    artistName: 'Ethel Waters',
    songs: sampleSongs.slice(0, 3),
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    canQuiz: false,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onQuiz: () => console.log('Quiz clicked'),
  },
}

export const QuizLoading: Story = {
  args: {
    artistName: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    songs: sampleSongs,
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    canQuiz: true,
    isQuizLoading: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onQuiz: () => console.log('Quiz clicked'),
  },
}
