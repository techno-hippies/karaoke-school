import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfilePageView, type Video, type ArtistSong } from '@/components/profile/ProfilePageView'
import type { LeaderboardEntry } from '@/components/class/Leaderboard'

const meta = {
  title: 'Profile/ProfilePageView',
  component: ProfilePageView,
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
} satisfies Meta<typeof ProfilePageView>

export default meta
type Story = StoryObj<typeof meta>

const mockVideos: Video[] = Array.from({ length: 18 }, (_, i) => ({
  id: `video-${i}`,
  thumbnailUrl: `https://picsum.photos/400/711?random=${i}`,
  playCount: Math.floor(Math.random() * 5000000),
  // Mix of free and premium videos - every 3rd video is premium
  isPremium: i % 3 === 0,
}))

const mockSongs: ArtistSong[] = [
  {
    id: '1',
    title: 'Obsessed',
    artist: 'Addison Rae',
    artworkUrl: 'https://picsum.photos/400/400?random=song1',
    onSongClick: () => console.log('Navigate to song 1'),
  },
  {
    id: '2',
    title: 'Diet Pepsi',
    artist: 'Addison Rae',
    artworkUrl: 'https://picsum.photos/400/400?random=song2',
    onSongClick: () => console.log('Navigate to song 2'),
  },
  {
    id: '3',
    title: 'Aquamarine',
    artist: 'Addison Rae',
    artworkUrl: 'https://picsum.photos/400/400?random=song3',
    onSongClick: () => console.log('Navigate to song 3'),
  },
  {
    id: '4',
    title: 'I Got It Bad',
    artist: 'Addison Rae',
    artworkUrl: 'https://picsum.photos/400/400?random=song4',
    onSongClick: () => console.log('Navigate to song 4'),
  },
  {
    id: '5',
    title: '2 Die 4',
    artist: 'Addison Rae',
    artworkUrl: 'https://picsum.photos/400/400?random=song5',
    onSongClick: () => console.log('Navigate to song 5'),
  },
]

const mockTopFans: LeaderboardEntry[] = [
  {
    rank: 1,
    username: 'superfan123',
    score: 12847,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fan1',
    onProfileClick: () => console.log('Navigate to fan 1'),
  },
  {
    rank: 2,
    username: 'musiclover_99',
    score: 9234,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fan2',
    onProfileClick: () => console.log('Navigate to fan 2'),
  },
  {
    rank: 3,
    username: 'karaoke_king',
    score: 7891,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fan3',
    onProfileClick: () => console.log('Navigate to fan 3'),
  },
]

/**
 * Own profile - Creator (no artist ID, 2 tabs: Videos | Top Fans)
 */
export const OwnProfileCreator: Story = {
  args: {
    profile: {
      username: 'alice.lens',
      displayName: 'Alice Johnson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
      following: 892,
      followers: 1250,
      isVerified: true,
      isOwnProfile: true,
    },
    videos: mockVideos,
    videosLoading: false,
    topFans: mockTopFans,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onStudyClick: () => console.log('Study'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Artist profile - not following (3 tabs: Videos | Songs | Top Fans)
 * Shows "Follow" button before following
 */
export const ArtistNotFollowing: Story = {
  args: {
    profile: {
      username: 'addisonrae',
      displayName: 'Addison Rae',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=addisonrae',
      following: 234,
      followers: 88500000,
      isVerified: true,
      isOwnProfile: false,
      geniusArtistId: 1177, // Has Genius artist ID = is an artist
    },
    videos: mockVideos,
    videosLoading: false,
    songs: mockSongs,
    songsLoading: false,
    topFans: mockTopFans,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onStudyClick: () => console.log('Study'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Artist profile - following (3 tabs: Videos | Songs | Top Fans)
 * Shows "Study" button after following (key UX change!)
 */
export const ArtistFollowing: Story = {
  args: {
    profile: {
      username: 'billieeilish',
      displayName: 'Billie Eilish',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=billieeilish',
      following: 1500,
      followers: 108000000,
      isVerified: true,
      isOwnProfile: false,
      geniusArtistId: 1421, // Has Genius artist ID = is an artist
    },
    videos: mockVideos,
    videosLoading: false,
    songs: mockSongs,
    songsLoading: false,
    topFans: mockTopFans,
    followState: {
      isFollowing: true, // ← Following = Study button shows
      isLoading: false,
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Unfollow'),
    onStudyClick: () => console.log('Study - navigate to artist study page'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Creator profile - not following (2 tabs: Videos | Top Fans)
 * Regular TikTok creator without music on Genius
 */
export const CreatorNotFollowing: Story = {
  args: {
    profile: {
      username: 'charlie.lens',
      displayName: 'Charlie Davis',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
      following: 456,
      followers: 2340000,
      isVerified: false,
      isOwnProfile: false,
      // No geniusArtistId = regular creator (not an artist)
    },
    videos: mockVideos,
    videosLoading: false,
    topFans: mockTopFans,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onStudyClick: () => console.log('Study'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Creator profile - following (2 tabs: Videos | Top Fans)
 * Shows "Study" button for creators too after following
 */
export const CreatorFollowing: Story = {
  args: {
    profile: {
      username: 'emma.lens',
      displayName: 'Emma Wilson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma',
      following: 678,
      followers: 5670000,
      isVerified: false,
      isOwnProfile: false,
      // No geniusArtistId = regular creator
    },
    videos: mockVideos,
    videosLoading: false,
    topFans: [],
    followState: {
      isFollowing: true, // ← Following = Study button shows
      isLoading: false,
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Unfollow'),
    onStudyClick: () => console.log('Study - study their videos'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Artist - loading songs
 */
export const ArtistLoadingSongs: Story = {
  args: {
    profile: {
      username: 'taylorswift',
      displayName: 'Taylor Swift',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=taylorswift',
      following: 2000,
      followers: 274000000,
      isVerified: true,
      isOwnProfile: false,
      geniusArtistId: 1177,
    },
    videos: mockVideos,
    videosLoading: false,
    songs: [],
    songsLoading: true, // ← Loading songs
    topFans: mockTopFans,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onStudyClick: () => console.log('Study'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Loading videos
 */
export const LoadingVideos: Story = {
  args: {
    profile: {
      username: 'diana.lens',
      displayName: 'Diana Lee',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana',
      following: 456,
      followers: 789,
      isVerified: false,
      isOwnProfile: false,
    },
    videos: [],
    videosLoading: true, // ← Loading videos
    topFans: [],
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onStudyClick: () => console.log('Study'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * No videos - empty state
 */
export const NoVideos: Story = {
  args: {
    profile: {
      username: 'newuser.lens',
      displayName: 'New User',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=newuser',
      following: 0,
      followers: 0,
      isVerified: false,
      isOwnProfile: true,
    },
    videos: [],
    videosLoading: false,
    topFans: [],
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onStudyClick: () => console.log('Study'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * No top fans - empty state
 */
export const NoTopFans: Story = {
  args: {
    profile: {
      username: 'grace.lens',
      displayName: 'Grace Kim',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=grace',
      following: 23,
      followers: 45,
      isVerified: false,
      isOwnProfile: true,
    },
    videos: mockVideos,
    videosLoading: false,
    topFans: [], // ← No fans yet
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onStudyClick: () => console.log('Study'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Follow loading state
 */
export const FollowLoading: Story = {
  args: {
    profile: {
      username: 'frank.lens',
      displayName: 'Frank Miller',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=frank',
      following: 345,
      followers: 12000,
      isVerified: true,
      isOwnProfile: false,
    },
    videos: mockVideos,
    videosLoading: false,
    topFans: mockTopFans,
    followState: {
      isFollowing: false,
      isLoading: true, // ← Loading follow action
    },
    isConnected: true,
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onStudyClick: () => console.log('Study'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}

/**
 * Not connected - viewing other profile
 */
export const NotConnected: Story = {
  args: {
    profile: {
      username: 'helen.lens',
      displayName: 'Helen Park',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=helen',
      following: 567,
      followers: 8900,
      isVerified: false,
      isOwnProfile: false,
    },
    videos: mockVideos,
    videosLoading: false,
    topFans: mockTopFans,
    followState: {
      isFollowing: false,
      isLoading: false,
    },
    isConnected: false, // ← Not connected
    onDisconnect: () => console.log('Disconnect'),
    onEditProfile: () => console.log('Edit profile'),
    onFollowClick: () => console.log('Follow'),
    onStudyClick: () => console.log('Study'),
    onMessageClick: () => console.log('Message'),
    onShareProfile: () => console.log('Share'),
    onVideoClick: (video) => console.log('Video clicked:', video.id),
    onNavigateHome: () => console.log('Navigate home'),
  },
}
