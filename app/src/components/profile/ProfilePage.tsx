import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfileInfo } from './ProfileInfo'
import { ProfileStats } from './ProfileStats'
import { VideoGrid, type VideoPost } from '@/components/video/VideoGrid'
import { cn } from '@/lib/utils'

export interface Achievement {
  id: string
  title: string
  description: string
  iconUrl?: string
  unlockedAt?: Date
  isLocked?: boolean
}

export interface ProfilePageProps {
  // Profile data
  username: string
  displayName?: string
  avatarUrl: string
  following: number
  followers: number
  isVerified?: boolean
  isOwnProfile?: boolean

  // Follow state
  isFollowing?: boolean
  isFollowLoading?: boolean

  // Videos tab
  videos?: VideoPost[]
  onVideoClick?: (video: VideoPost) => void

  // Achievements
  achievements?: Achievement[]

  // Handlers
  onBack?: () => void
  onFollow?: () => void
  onMessage?: () => void
  onEditProfile?: () => void

  className?: string
}

/**
 * ProfilePage - Student profile with dances and achievements
 * Shows profile avatar (not hero), 2 tabs (Dances, Achievements), Follow button footer
 */
export function ProfilePage({
  username,
  displayName,
  avatarUrl,
  following,
  followers,
  isVerified = false,
  isOwnProfile = false,
  isFollowing = false,
  isFollowLoading = false,
  videos = [],
  onVideoClick,
  achievements = [],
  onBack,
  onFollow,
  onMessage,
  onEditProfile,
  className,
}: ProfilePageProps) {

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

              {/* Info Section */}
              <div className="flex-1 w-full">
                <ProfileInfo
                  username={username}
                  displayName={displayName}
                  isVerified={isVerified}
                  alignment="center"
                />

                <ProfileStats
                  following={following}
                  followers={followers}
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          <div className="px-4 md:px-6 mt-2 space-y-4 pb-8">
            {/* Tabs: Dances | Achievements */}
            <Tabs defaultValue="dances" className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                <TabsTrigger value="dances">Dances</TabsTrigger>
                <TabsTrigger value="achievements">Achievements</TabsTrigger>
              </TabsList>

              <TabsContent value="dances" className="mt-4">
                <VideoGrid
                  videos={videos}
                  onVideoClick={onVideoClick}
                  showUsernames={false}
                />
              </TabsContent>

              <TabsContent value="achievements" className="mt-4">
                {achievements.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {achievements.map((achievement) => (
                      <div
                        key={achievement.id}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-colors',
                          achievement.isLocked
                            ? 'bg-muted/30 border-border opacity-60'
                            : 'bg-card border-primary/20'
                        )}
                      >
                        {achievement.iconUrl ? (
                          <img
                            src={achievement.iconUrl}
                            alt={achievement.title}
                            className="w-16 h-16 object-contain"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <span className="text-2xl">🏆</span>
                          </div>
                        )}
                        <h3 className="text-sm font-semibold text-center">
                          {achievement.title}
                        </h3>
                        <p className="text-xs text-muted-foreground text-center line-clamp-2">
                          {achievement.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No achievements yet
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Sticky Footer with Follow/Message buttons OR Edit Profile button */}
        {isOwnProfile ? (
          onEditProfile && (
            <div className="flex-shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
              <Button
                size="lg"
                variant="outline"
                onClick={onEditProfile}
                className="w-full"
              >
                Edit Profile
              </Button>
            </div>
          )
        ) : (
          <div className="flex-shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
            <div className="flex gap-3">
              {onFollow && (
                <Button
                  size="lg"
                  variant={isFollowing ? 'outline' : 'default'}
                  onClick={onFollow}
                  disabled={isFollowLoading}
                  className="flex-1"
                >
                  {isFollowLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                </Button>
              )}
              {onMessage && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onMessage}
                  className="flex-1"
                >
                  Message
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
