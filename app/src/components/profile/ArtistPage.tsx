import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfileInfo } from './ProfileInfo'
import { ProfileStats } from './ProfileStats'
import { VideoGrid, type VideoPost } from '@/components/video/VideoGrid'
import { SongItem } from '@/components/ui/SongItem'
import { cn } from '@/lib/utils'

export interface ArtistSong {
  id: string
  title: string
  artist: string
  artworkUrl?: string
  onSongClick?: () => void
}

export interface ArtistPageProps {
  // Profile data
  username: string
  displayName?: string
  avatarUrl: string
  isVerified?: boolean
  isOwnProfile?: boolean

  // Stats
  following?: number
  followers?: number

  // Follow state
  isFollowing?: boolean
  isFollowLoading?: boolean

  // Videos tab
  videos?: VideoPost[]
  onVideoClick?: (video: VideoPost) => void

  // Songs tab
  songs?: ArtistSong[]

  // Handlers
  onBack?: () => void
  onFollow?: () => void
  onEditProfile?: () => void

  className?: string
}

/**
 * ArtistPage - Artist profile with dances and songs
 * Shows profile avatar (not hero), 2 tabs (Dances, Songs), Follow button above tabs
 */
export function ArtistPage({
  username,
  displayName,
  avatarUrl,
  isVerified = false,
  isOwnProfile = false,
  following = 0,
  followers = 0,
  isFollowing = false,
  isFollowLoading = false,
  videos = [],
  onVideoClick,
  songs = [],
  onBack,
  onFollow,
  onEditProfile,
  className,
}: ArtistPageProps) {

  return (
    <div className={cn('relative w-full h-screen bg-background flex justify-center', className)}>
      <div className="relative w-full h-screen md:max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0">
          <div className="flex items-center h-12 px-4 pt-2">
            <BackButton onClick={onBack} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {/* Profile Section */}
          <div className="pt-4 pb-2 px-4 md:px-6">
            <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-start">
              {/* Avatar */}
              <ProfileAvatar
                src={avatarUrl}
                alt={displayName || username}
                size="xl"
              />

              {/* Info Section with Stats and Follow Button */}
              <div className="flex-1 w-full flex flex-col items-center md:items-start">
                <ProfileInfo
                  username={username}
                  displayName={displayName}
                  isVerified={isVerified}
                  alignment="center"
                />

                {/* Stats */}
                <ProfileStats
                  following={following}
                  followers={followers}
                />

                {/* Action Button - Follow or Edit profile */}
                {isOwnProfile ? (
                  onEditProfile && (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={onEditProfile}
                      className="mt-4 min-w-[200px]"
                    >
                      Edit profile
                    </Button>
                  )
                ) : (
                  onFollow && (
                    <Button
                      size="lg"
                      variant={isFollowing ? 'outline' : 'default'}
                      onClick={onFollow}
                      disabled={isFollowLoading}
                      className="mt-4 min-w-[200px]"
                    >
                      {isFollowLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="px-4 space-y-4 pb-8 pt-6">
            {/* Tabs: Dances | Songs */}
            <Tabs defaultValue="dances" className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                <TabsTrigger value="dances">Dances</TabsTrigger>
                <TabsTrigger value="songs">Songs</TabsTrigger>
              </TabsList>

              <TabsContent value="dances" className="mt-4 -mx-4 md:-mx-6">
                <VideoGrid
                  videos={videos}
                  onVideoClick={onVideoClick}
                  showUsernames={false}
                />
              </TabsContent>

              <TabsContent value="songs" className="mt-4">
                {songs.length > 0 ? (
                  <div className="space-y-1">
                    {songs.map((song, index) => (
                      <SongItem
                        key={song.id}
                        rank={index + 1}
                        title={song.title}
                        artist={song.artist}
                        artworkUrl={song.artworkUrl}
                        onClick={song.onSongClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No songs yet
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
