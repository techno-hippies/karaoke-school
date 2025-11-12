import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
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

export interface AccountPageProps {
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
  isLoadingVideos?: boolean

  // Songs tab
  songs?: ArtistSong[]

  // Handlers
  onBack?: () => void
  onFollow?: () => void
  onSubscribe?: () => void
  onEditProfile?: () => void

  className?: string
}

/**
 * AccountPage - Universal profile for all account types (students, TikTok creators, artists)
 * Shows videos (Dances) and conditionally shows Songs tab if data exists
 * Subscribe button appears if onSubscribe is provided (for artists with Unlock locks)
 */
export function AccountPage({
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
  isLoadingVideos = false,
  songs = [],
  onBack,
  onFollow,
  onSubscribe,
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

                {/* Action Buttons - Follow/Subscribe or Edit profile */}
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
                  <div className="flex gap-3 mt-4">
                    {onFollow && (
                      <Button
                        size="lg"
                        variant={isFollowing ? 'outline' : 'default'}
                        onClick={onFollow}
                        disabled={isFollowLoading}
                        className="min-w-[120px]"
                      >
                        {isFollowLoading ? (
                          <>
                            <Spinner size="sm" />
                            <span>{isFollowing ? 'Unfollowing...' : 'Following...'}</span>
                          </>
                        ) : isFollowing ? 'Following' : 'Follow'}
                      </Button>
                    )}
                    {onSubscribe && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={onSubscribe}
                        className="min-w-[120px]"
                      >
                        Subscribe
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 space-y-4 pb-8 pt-6">
            {/* Conditional tabs based on available data */}
            {songs.length > 0 ? (
              // Show both Dances and Songs tabs (artist profile)
              <Tabs defaultValue="dances" className="w-full">
                <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                  <TabsTrigger value="dances">Dances</TabsTrigger>
                  <TabsTrigger value="songs">Songs</TabsTrigger>
                </TabsList>

                <TabsContent value="dances" className="mt-4">
                  <VideoGrid
                    videos={videos}
                    onVideoClick={onVideoClick}
                    isLoading={isLoadingVideos}
                    showUsernames={false}
                  />
                </TabsContent>

                <TabsContent value="songs" className="mt-4">
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
                </TabsContent>
              </Tabs>
            ) : (
              // Show only Dances tab (student/TikTok creator without published songs)
              <div>
                <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Dances</h3>
                <VideoGrid
                  videos={videos}
                  onVideoClick={onVideoClick}
                  isLoading={isLoadingVideos}
                  showUsernames={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
