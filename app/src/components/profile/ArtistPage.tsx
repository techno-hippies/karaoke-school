import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfileInfo } from './ProfileInfo'
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

export interface TopStudent {
  rank: number
  username: string
  score: number
  avatarUrl?: string
  isCurrentUser?: boolean
  onStudentClick?: () => void
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
  onEditProfile?: () => void

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
  onEditProfile,
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

              {/* Info Section with Follow Button below handle */}
              <div className="flex-1 w-full flex flex-col items-center md:items-start">
                <ProfileInfo
                  username={username}
                  displayName={displayName}
                  isVerified={isVerified}
                  alignment="center"
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

              <TabsContent value="students" className="mt-4">
                <div className="space-y-1">
                  {topStudents.length > 0 ? (
                    <>
                      {topStudents.map((student) => (
                        <SongItem
                          key={student.username}
                          rank={student.rank}
                          title={student.username}
                          artist={`${student.score.toLocaleString()} pts`}
                          artworkUrl={student.avatarUrl}
                          isHighlighted={student.isCurrentUser}
                          onClick={student.onStudentClick}
                        />
                      ))}

                      {currentUser && !topStudents.some(s => s.isCurrentUser) && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <SongItem
                            rank={currentUser.rank}
                            title={currentUser.username}
                            artist={`${currentUser.score.toLocaleString()} pts`}
                            artworkUrl={currentUser.avatarUrl}
                            isHighlighted={true}
                            onClick={currentUser.onStudentClick}
                          />
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
