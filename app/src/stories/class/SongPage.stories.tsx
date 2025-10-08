import type { Meta, StoryObj } from '@storybook/react-vite'
import { SongPage } from '@/components/class/SongPage'

const meta = {
  title: 'Class/SongPage',
  component: SongPage,
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
} satisfies Meta<typeof SongPage>

export default meta
type Story = StoryObj<typeof meta>

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

export const LocalSong: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    newCount: 12,
    learningCount: 5,
    dueCount: 8,
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    isExternal: false,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

export const ExternalSong: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    newCount: 12,
    learningCount: 5,
    dueCount: 8,
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    isExternal: true,
    externalSongLinks: [
      { label: 'SoundCloud', url: 'https://soundcloud.com/scarlett-x/heat-of-the-night' },
      { label: 'Maid.zone', url: 'https://maid.zone/scarlett-x/heat-of-the-night' },
    ],
    externalLyricsLinks: [
      { label: 'Genius', url: 'https://genius.com/Scarlett-x-heat-of-the-night-lyrics' },
      { label: 'Intellectual', url: 'https://intellectual.insprill.net/Scarlett-x-heat-of-the-night-lyrics?id=123456' },
      { label: 'Dumb', url: 'https://dm.vern.cc/Scarlett-x-heat-of-the-night-lyrics' },
    ],
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked (external)'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

export const NoArtwork: Story = {
  args: {
    songTitle: 'Down Home Blues',
    artist: 'Ethel Waters',
    newCount: 0,
    learningCount: 0,
    dueCount: 25,
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    isExternal: false,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

export const StudyLoading: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    newCount: 12,
    learningCount: 5,
    dueCount: 8,
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    isExternal: false,
    isStudyLoading: true,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

export const KaraokeLoading: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/800/800',
    newCount: 12,
    learningCount: 5,
    dueCount: 8,
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    isExternal: false,
    isKaraokeLoading: true,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}
