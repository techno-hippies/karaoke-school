import { useState } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { ProfileHeader } from './ProfileHeader'
import { VideoGrid, type Video } from './VideoGrid'
import { BackButton } from '@/components/ui/back-button'
import { SubscriptionDialog } from './SubscriptionDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Leaderboard, type LeaderboardEntry } from '@/components/class/Leaderboard'
import { SongItem } from '@/components/ui/SongItem'

export interface ArtistSong {
  id: string
  title: string
  artist: string
  artworkUrl?: string
  onSongClick?: () => void
  onPlayClick?: () => void
  showPlayButton?: boolean
}

export interface ProfilePageViewProps {
  // Profile data
  profile: {
    username: string
    displayName?: string
    avatarUrl: string
    following: number
    followers: number
    isVerified: boolean
    isOwnProfile: boolean
    geniusArtistId?: number // If set, this profile is an artist with songs
  }

  // Videos
  videos: Video[]
  videosLoading?: boolean

  // Songs (only for artists)
  songs?: ArtistSong[]
  songsLoading?: boolean

  // Top Fans (replaces "Favorite Artists")
  topFans?: LeaderboardEntry[]

  // Follow state
  followState: {
    isFollowing: boolean
    isLoading: boolean
  }

  // Navigation
  onNavigateHome: () => void

  // Wallet
  isConnected?: boolean
  onDisconnect?: () => void

  // Handlers
  onEditProfile: () => void
  onFollowClick: () => void
  onStudyClick?: () => void
  onMessageClick: () => void
  onShareProfile: () => void
  onVideoClick: (video: Video) => void
}

/**
 * ProfilePageView - Main profile layout
 * Combines desktop sidebar, mobile header/footer, profile header, and video/song grid
 * Shows 3 tabs for artists (Videos | Songs | Top Fans)
 * Shows 2 tabs for creators (Videos | Top Fans)
 */
export function ProfilePageView({
  profile,
  videos,
  videosLoading,
  songs = [],
  songsLoading = false,
  topFans = [],
  followState,
  isConnected,
  onDisconnect,
  onEditProfile,
  onFollowClick,
  onStudyClick,
  onMessageClick,
  onShareProfile,
  onVideoClick,
  onNavigateHome,
}: ProfilePageViewProps) {
  const isArtist = !!profile.geniusArtistId
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false)

  return (
    <>
      {/* Desktop Logout - top right */}
      {isConnected && profile.isOwnProfile && (
        <div className="hidden md:block absolute top-4 right-4 z-50">
          <button
            onClick={onDisconnect}
            className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
          >
            <SignOut className="h-5 w-5 text-neutral-400" />
          </button>
        </div>
      )}

      {/* Container for profile content */}
      <div className="max-w-6xl mx-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-4 border-b border-border">
            {/* Left: Back button or spacer */}
            {!profile.isOwnProfile ? (
              <BackButton onClick={onNavigateHome} />
            ) : (
              <div className="w-12" />
            )}

            {/* Center: Title */}
            <h1 className="text-center font-semibold text-base text-foreground flex-1">
              {profile.displayName || profile.username}
            </h1>

            {/* Right: Logout button or spacer */}
            {isConnected && profile.isOwnProfile ? (
              <button
                onClick={onDisconnect}
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
              >
                <SignOut className="h-5 w-5 text-neutral-400" />
              </button>
            ) : (
              <div className="w-9" />
            )}
          </div>

          {/* Profile Header */}
          <ProfileHeader
            username={profile.username}
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl}
            following={profile.following}
            followers={profile.followers}
            isVerified={profile.isVerified}
            isOwnProfile={profile.isOwnProfile}
            isFollowing={followState.isFollowing}
            isFollowLoading={followState.isLoading}
            onEditClick={onEditProfile}
            onFollowClick={onFollowClick}
            onStudyClick={onStudyClick}
            onSubscribeClick={() => setSubscriptionDialogOpen(true)}
            onMessageClick={onMessageClick}
            onMoreClick={onShareProfile}
          />

          {/* Tabs: Videos | Songs (if artist) | Top Fans */}
          <div className="mt-4 mb-4">
            <Tabs defaultValue="videos" className="w-full">
              <div className="px-4">
                <TabsList className={`w-full grid ${isArtist ? 'grid-cols-3' : 'grid-cols-2'} bg-muted/50`}>
                  <TabsTrigger value="videos">Videos</TabsTrigger>
                  {isArtist && (
                    <TabsTrigger value="songs">Songs</TabsTrigger>
                  )}
                  <TabsTrigger value="fans">Fans</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="videos" className="mt-4">
                <VideoGrid
                  videos={videos}
                  isLoading={videosLoading}
                  onVideoClick={onVideoClick}
                />
              </TabsContent>

              {isArtist && (
                <TabsContent value="songs" className="mt-4 px-4">
                  {songsLoading ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Loading songs...
                    </div>
                  ) : songs.length > 0 ? (
                    <div className="space-y-0.5">
                      {songs.map((song, index) => (
                        <SongItem
                          key={song.id}
                          rank={index + 1}
                          title={song.title}
                          artist={song.artist}
                          artworkUrl={song.artworkUrl}
                          showPlayButton={song.showPlayButton}
                          onPlayClick={song.onPlayClick}
                          onClick={song.onSongClick}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No songs available
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="fans" className="mt-4 px-4">
                {topFans.length > 0 ? (
                  <Leaderboard entries={topFans} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No fans yet
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

      {/* Subscription Dialog */}
      <SubscriptionDialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
        username={profile.username}
        userAvatar={profile.avatarUrl}
        onSubscribe={() => {
          console.log('Subscribe clicked for', profile.username)
          setSubscriptionDialogOpen(false)
        }}
      />
    </>
  )
}
