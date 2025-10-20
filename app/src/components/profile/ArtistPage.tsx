import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfileInfo } from './ProfileInfo'
import { VideoGrid, type VideoPost } from '@/components/video/VideoGrid'
import { SongItem } from '@/components/song/SongItem'
import { cn } from '@/lib/utils'

export interface ArtistSong {
  id: string
  title: string
  artist: string
  artworkUrl?: string
  onSongClick?: () => void
}

export interface TopStudent {
  rank: number
  username: string
  score: number
  avatarUrl?: string
  isCurrentUser?: boolean
}

export interface ArtistPageProps {
  // Profile data
  username: string
  displayName?: string
  avatarUrl: string
  isVerified?: boolean
  isOwnProfile?: boolean

  // Follow state
  isFollowing?: boolean
  isFollowLoading?: boolean

  // Videos tab
  videos?: VideoPost[]
  onVideoClick?: (video: VideoPost) => void

  // Songs tab
  songs?: ArtistSong[]

  // Students tab
  topStudents?: TopStudent[]
  currentUser?: TopStudent

  // Handlers
  onBack?: () => void
  onFollow?: () => void

  className?: string
}

/**
 * ArtistPage - Artist profile with videos, songs, and students
 * Shows profile avatar (not hero), 3 tabs (Videos, Songs, Students), Follow button above tabs
 */
export function ArtistPage({
  username,
  displayName,
  avatarUrl,
  isVerified = false,
  isOwnProfile = false,
  isFollowing = false,
  isFollowLoading = false,
  videos = [],
  onVideoClick,
  songs = [],
  topStudents = [],
  currentUser,
  onBack,
  onFollow,
  className,
}: ArtistPageProps) {

  return (
    <div className={cn('relative w-full h-screen bg-background flex justify-center', className)}>
      <div className="relative w-full h-screen md:max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0">
          <div className="flex items-center h-12 px-4 pt-2">
            <BackButton onClick={onBack} variant="ghost" />
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

              {/* Info Section */}
              <div className="flex-1 w-full">
                <ProfileInfo
                  username={username}
                  displayName={displayName}
                  isVerified={isVerified}
                  alignment="center"
                />
              </div>
            </div>

            {/* Follow Button */}
            {!isOwnProfile && onFollow && (
              <div className="mt-4 mb-4 flex justify-center">
                <Button
                  size="lg"
                  variant={isFollowing ? 'outline' : 'default'}
                  onClick={onFollow}
                  disabled={isFollowLoading}
                  className="w-full max-w-md"
                >
                  {isFollowLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                </Button>
              </div>
            )}
          </div>

          <div className="px-4 space-y-4 pb-8">
            {/* Tabs: Videos | Songs | Students */}
            <Tabs defaultValue="videos" className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-muted/50">
                <TabsTrigger value="videos">Videos</TabsTrigger>
                <TabsTrigger value="songs">Songs</TabsTrigger>
                <TabsTrigger value="students">Students</TabsTrigger>
              </TabsList>

              <TabsContent value="videos" className="mt-4 -mx-4 md:-mx-6">
                <VideoGrid
                  videos={videos}
                  onVideoClick={onVideoClick}
                  showUsernames={false}
                />
              </TabsContent>

              <TabsContent value="songs" className="mt-4">
                {songs.length > 0 ? (
                  <div className="space-y-0.5">
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

              <TabsContent value="students" className="mt-4">
                <div className="space-y-1">
                  {topStudents.length > 0 ? (
                    <>
                      {topStudents.map((student) => (
                        <div
                          key={student.username}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-full',
                            student.isCurrentUser ? 'bg-primary/10' : 'bg-muted/30'
                          )}
                        >
                          <div className="w-8 text-center font-bold text-muted-foreground">
                            #{student.rank}
                          </div>
                          {student.avatarUrl && (
                            <img
                              src={student.avatarUrl}
                              alt={student.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{student.username}</p>
                            <p className="text-sm text-muted-foreground">
                              {student.score.toLocaleString()} pts
                            </p>
                          </div>
                        </div>
                      ))}

                      {currentUser && !topStudents.some(s => s.isCurrentUser) && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-primary/10">
                            <div className="w-8 text-center font-bold text-muted-foreground">
                              #{currentUser.rank}
                            </div>
                            {currentUser.avatarUrl && (
                              <img
                                src={currentUser.avatarUrl}
                                alt={currentUser.username}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{currentUser.username}</p>
                              <p className="text-sm text-muted-foreground">
                                {currentUser.score.toLocaleString()} pts
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No students yet
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
