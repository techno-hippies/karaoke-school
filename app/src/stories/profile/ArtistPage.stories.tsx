import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArtistPage, type ArtistSong } from '@/components/profile/ArtistPage'
import type { VideoPost } from '@/components/video/VideoGrid'

const meta = {
  title: 'Profile/ArtistPage',
  component: ArtistPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ArtistPage>

export default meta
type Story = StoryObj<typeof meta>

// Sample videos
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

// Sample songs
const sampleSongs: ArtistSong[] = [
  {
    id: '1',
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/200/200',
    onSongClick: () => console.log('Open song 1'),
  },
  {
    id: '2',
    title: 'Neon Lights',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/201/201',
    onSongClick: () => console.log('Open song 2'),
  },
  {
    id: '3',
    title: 'Midnight Dreams',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/202/202',
    onSongClick: () => console.log('Open song 3'),
  },
  {
    id: '4',
    title: 'Electric Soul',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/203/203',
    onSongClick: () => console.log('Open song 4'),
  },
  {
    id: '5',
    title: 'Crystal Horizon',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/204/204',
    onSongClick: () => console.log('Open song 5'),
  },
]

/**
 * Artist page with all content
 */
export const Default: Story = {
  args: {
    username: 'scarlettx',
    displayName: 'Scarlett X',
    avatarUrl: 'https://placebear.com/300/300',
    isVerified: true,
    isOwnProfile: false,
    following: 0,
    followers: 0,
    isFollowing: false,
    videos: sampleVideos,
    songs: sampleSongs,
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}

/**
 * Following an artist
 */
export const Following: Story = {
  args: {
    username: 'lunaray',
    displayName: 'Luna Ray',
    avatarUrl: 'https://placebear.com/301/301',
    isVerified: true,
    isOwnProfile: false,
    following: 0,
    followers: 0,
    isFollowing: true,
    videos: sampleVideos,
    songs: sampleSongs.slice(0, 3),
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Unfollow clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}

/**
 * Own artist profile (shows edit profile button)
 */
export const OwnProfile: Story = {
  args: {
    username: 'your_artist_name',
    displayName: 'Your Stage Name',
    avatarUrl: 'https://placebear.com/302/302',
    isVerified: false,
    isOwnProfile: true,
    following: 0,
    followers: 0,
    videos: sampleVideos,
    songs: sampleSongs,
    onBack: () => console.log('Back clicked'),
    onEditProfile: () => console.log('Edit profile clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}

/**
 * New artist with minimal content
 */
export const NewArtist: Story = {
  args: {
    username: 'rising_star',
    displayName: 'Rising Star',
    avatarUrl: 'https://placebear.com/303/303',
    isVerified: false,
    isOwnProfile: false,
    following: 0,
    followers: 0,
    isFollowing: false,
    videos: sampleVideos.slice(0, 2),
    songs: sampleSongs.slice(0, 1),
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}

/**
 * Artist with no videos yet
 */
export const NoVideos: Story = {
  args: {
    username: 'echo_black',
    displayName: 'Echo Black',
    avatarUrl: 'https://placebear.com/304/304',
    isVerified: true,
    isOwnProfile: false,
    following: 0,
    followers: 0,
    isFollowing: false,
    videos: [],
    songs: sampleSongs,
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
  },
}

/**
 * Artist with many videos and songs
 */
export const PopularArtist: Story = {
  args: {
    username: 'superstar',
    displayName: 'Superstar',
    avatarUrl: 'https://placebear.com/305/305',
    isVerified: true,
    isOwnProfile: false,
    following: 0,
    followers: 0,
    isFollowing: true,
    videos: [
      ...sampleVideos,
      ...sampleVideos.map((v, i) => ({ ...v, id: `${v.id}-${i}` })),
      ...sampleVideos.map((v, i) => ({ ...v, id: `${v.id}-${i}-2` })),
    ],
    songs: [
      ...sampleSongs,
      ...sampleSongs.map((s, i) => ({ ...s, id: `${s.id}-${i}`, title: `${s.title} (Remix)` })),
    ],
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Unfollow clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}

/**
 * Unverified artist
 */
export const Unverified: Story = {
  args: {
    username: 'indie_artist',
    displayName: 'Indie Artist',
    avatarUrl: 'https://placebear.com/306/306',
    isVerified: false,
    isOwnProfile: false,
    following: 0,
    followers: 0,
    isFollowing: false,
    videos: sampleVideos.slice(0, 4),
    songs: sampleSongs.slice(0, 3),
    onBack: () => console.log('Back clicked'),
    onFollow: () => console.log('Follow clicked'),
    onVideoClick: (video) => console.log('Video clicked:', video),
  },
}
