import type { Meta, StoryObj } from '@storybook/react-vite'
import { SongPage, type SongSegment } from '@/components/class/SongPage'

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

// Free audio sample for demo purposes
const DEMO_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

// Cataloged segments - timestamps shown but locked (needs base-alignment)
const catalogedSegments: SongSegment[] = [
  { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 15, duration: 15, isOwned: false },
  { id: 'chorus', displayName: 'Chorus', startTime: 15, endTime: 30, duration: 15, isOwned: false },
  { id: 'verse-2', displayName: 'Verse 2', startTime: 45, endTime: 60, duration: 15, isOwned: false },
  { id: 'bridge', displayName: 'Bridge', startTime: 90, endTime: 105, duration: 15, isOwned: false },
]

// Unlocked segments - all owned with timestamps
const unlockedSegments: SongSegment[] = [
  { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 15, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
  { id: 'chorus', displayName: 'Chorus', startTime: 15, endTime: 30, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
  { id: 'verse-2', displayName: 'Verse 2', startTime: 45, endTime: 60, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
  { id: 'bridge', displayName: 'Bridge', startTime: 90, endTime: 105, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
]

const generatingSegments: SongSegment[] = [
  { id: 'placeholder-1', displayName: 'Verse 1', startTime: 0, endTime: 0, duration: 0, isOwned: false },
  { id: 'placeholder-2', displayName: 'Chorus', startTime: 0, endTime: 0, duration: 0, isOwned: false },
  { id: 'placeholder-3', displayName: 'Verse 2', startTime: 0, endTime: 0, duration: 0, isOwned: false },
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

/**
 * Local song - always unlocked with play button, shows segment list
 */
export const LocalSong: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    geniusArtistId: 12345,
    artworkUrl: 'https://placebear.com/800/800',
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    isExternal: false,
    segments: unlockedSegments,
    isAuthenticated: true,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked'),
    onArtistClick: () => console.log('Artist clicked'),
    onSelectSegment: (segment) => console.log('Selected segment:', segment),
  },
}

/**
 * External song - cataloged but locked state
 * Segments have timestamps + lock icons, shows unlock button
 * This is the state after match-and-segment completes, before base-alignment runs
 */
export const ExternalSongLocked: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    geniusArtistId: 12345,
    artworkUrl: 'https://placebear.com/800/800',
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
    segments: catalogedSegments,
    isLocked: true,
    isAuthenticated: true,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked (external)'),
    onArtistClick: () => console.log('Artist clicked'),
    onSelectSegment: (segment) => console.log('Selected segment:', segment),
    onUnlockAll: () => console.log('Unlock all segments'),
  },
}

/**
 * External song - cataloging state (match-and-segment running)
 * Shows skeleton loading segments
 */
export const ExternalSongUnlocking: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    geniusArtistId: 12345,
    artworkUrl: 'https://placebear.com/800/800',
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
    segments: [],
    isAuthenticated: true,
    isUnlocking: true,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked (external)'),
    onArtistClick: () => console.log('Artist clicked'),
    onSelectSegment: (segment) => console.log('Selected segment:', segment),
    onUnlockAll: () => console.log('Unlock all segments'),
  },
}

/**
 * External song - unlocked state (base-alignment complete)
 * Segments have timestamps WITHOUT lock icons, no unlock button, segments are clickable
 */
export const ExternalSongUnlocked: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    geniusArtistId: 12345,
    artworkUrl: 'https://placebear.com/800/800',
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
    segments: unlockedSegments,
    isLocked: false,
    isAuthenticated: true,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked (external)'),
    onArtistClick: () => console.log('Artist clicked'),
    onSelectSegment: (segment) => console.log('Selected segment:', segment),
  },
}

/**
 * Generating segments - Loading state with progress bar
 */
export const GeneratingSegments: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    geniusArtistId: 12345,
    artworkUrl: 'https://placebear.com/800/800',
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    isExternal: false,
    segments: generatingSegments,
    isGenerating: true,
    generatingProgress: 45,
    isAuthenticated: true,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked'),
    onArtistClick: () => console.log('Artist clicked'),
    onSelectSegment: (segment) => console.log('Selected segment:', segment),
    onUnlockAll: () => console.log('Unlock all segments'),
  },
}

/**
 * User not authenticated - external song, should trigger auth modal when trying to unlock
 */
export const NotAuthenticated: Story = {
  args: {
    songTitle: 'Heat of the Night',
    artist: 'Scarlett X',
    geniusArtistId: 12345,
    artworkUrl: 'https://placebear.com/800/800',
    leaderboardEntries: sampleLeaderboard,
    currentUser: currentUser,
    isExternal: true,
    externalSongLinks: [
      { label: 'SoundCloud', url: 'https://soundcloud.com/scarlett-x/heat-of-the-night' },
      { label: 'Maid.zone', url: 'https://maid.zone/scarlett-x/heat-of-the-night' },
    ],
    externalLyricsLinks: [
      { label: 'Genius', url: 'https://genius.com/Scarlett-x-heat-of-the-night-lyrics' },
      { label: 'Intellectual', url: 'https://intellectual.insprill.net/Scarlett-x-heart-of-the-night-lyrics?id=123456' },
      { label: 'Dumb', url: 'https://dm.vern.cc/Scarlett-x-heat-of-the-night-lyrics' },
    ],
    segments: catalogedSegments,
    isLocked: true,
    isAuthenticated: false,
    onBack: () => console.log('Back clicked'),
    onPlay: () => console.log('Play clicked (external)'),
    onArtistClick: () => console.log('Artist clicked'),
    onSelectSegment: (segment) => console.log('Selected segment:', segment),
    onUnlockAll: () => console.log('Unlock all segments'),
    onAuthRequired: () => console.log('Auth required - open auth modal'),
  },
}
