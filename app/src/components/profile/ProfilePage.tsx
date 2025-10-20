import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfileInfo } from './ProfileInfo'
import { ProfileStats } from './ProfileStats'
import { SongItem, type SongItemProps } from '@/components/song/SongItem'
import { cn } from '@/lib/utils'

export interface Achievement {
  id: string
  title: string
  description: string
  iconUrl?: string
  unlockedAt?: Date
  isLocked?: boolean
}

export interface ActivityItem {
  id: string
  type: 'practice' | 'performance' | 'streak' | 'achievement'
  timestamp: Date
  title: string
  description?: string
  // For song-related activities
  song?: {
    title: string
    artist: string
    artworkUrl?: string
  }
  // For performance activities
  score?: number
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

  // Achievements
  achievements?: Achievement[]

  // Activity
  activities?: ActivityItem[]

  // Handlers
  onBack?: () => void
  onFollow?: () => void
  onMessage?: () => void
  onActivitySongClick?: (activity: ActivityItem) => void

  className?: string
}

/**
 * ProfilePage - Student profile with achievements and activity
 * Shows profile avatar (not hero), 2 tabs (Achievements, Activity), Follow button footer
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
  achievements = [],
  activities = [],
  onBack,
  onFollow,
  onMessage,
  onActivitySongClick,
  className,
}: ProfilePageProps) {

  const formatActivityTime = (timestamp: Date): string => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return timestamp.toLocaleDateString()
  }

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

                <ProfileStats
                  following={following}
                  followers={followers}
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          <div className="px-4 mt-2 space-y-4 pb-8">
            {/* Tabs: Achievements | Activity */}
            <Tabs defaultValue="achievements" className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                <TabsTrigger value="achievements">Achievements</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

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

              <TabsContent value="activity" className="mt-4">
                {activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex gap-3 p-3 rounded-2xl bg-muted/30"
                      >
                        {/* Activity Type Icon */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {activity.type === 'practice' && <span className="text-lg">📚</span>}
                          {activity.type === 'performance' && <span className="text-lg">🎤</span>}
                          {activity.type === 'streak' && <span className="text-lg">🔥</span>}
                          {activity.type === 'achievement' && <span className="text-lg">🏆</span>}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-sm font-semibold">{activity.title}</h3>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatActivityTime(activity.timestamp)}
                            </span>
                          </div>

                          {activity.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {activity.description}
                            </p>
                          )}

                          {activity.song && (
                            <div
                              className="mt-2 cursor-pointer"
                              onClick={() => onActivitySongClick?.(activity)}
                            >
                              <SongItem
                                title={activity.song.title}
                                artist={activity.song.artist}
                                artworkUrl={activity.song.artworkUrl}
                                className="bg-background/50"
                              />
                            </div>
                          )}

                          {activity.score !== undefined && (
                            <div className="mt-2 text-sm">
                              <span className="font-bold text-primary">{activity.score}</span>
                              <span className="text-muted-foreground"> points</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No activity yet
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Sticky Footer with Follow/Message buttons */}
        {!isOwnProfile && (
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
