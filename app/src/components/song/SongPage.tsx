import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, DotsThree } from '@phosphor-icons/react'
import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { VideoGrid, type VideoPost } from '@/components/video/VideoGrid'
import { ExternalLinksDrawer } from '@/components/media/ExternalLinksDrawer'
import { useSongVideos } from '@/hooks/useSongVideos'
import { cn } from '@/lib/utils'

export interface LeaderboardEntry {
  rank: number
  username: string
  score: number
  avatarUrl?: string
  isCurrentUser?: boolean
}

interface ExternalLink {
  label: string
  url: string
}

export interface SongPageProps {
  songTitle: string
  artist: string
  artworkUrl?: string
  songLinks?: ExternalLink[]
  lyricsLinks?: ExternalLink[]
  onBack?: () => void
  onPlay: () => void
  onArtistClick?: () => void
  // Footer actions
  onStudy?: () => void
  onKaraoke?: () => void
  // Videos - can provide manually or via geniusId query
  geniusId?: number // Query all videos for this song across creators
  videos?: VideoPost[] // Manual override (for Storybook)
  isLoadingVideos?: boolean
  onVideoClick?: (video: VideoPost) => void
  // Leaderboard tab
  leaderboardEntries: LeaderboardEntry[]
  currentUser?: LeaderboardEntry
  className?: string
}

/**
 * Song detail page with videos and student leaderboard
 * Queries videos across ALL creators for this song via Lens GraphQL
 */
export function SongPage({
  songTitle,
  artist,
  artworkUrl,
  songLinks = [],
  lyricsLinks = [],
  onBack,
  onPlay,
  onArtistClick,
  onStudy,
  onKaraoke,
  geniusId,
  videos: manualVideos,
  isLoadingVideos: manualIsLoadingVideos,
  onVideoClick,
  leaderboardEntries,
  currentUser,
  className,
}: SongPageProps) {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Query videos by genius_id (queries Lens for all creator videos of this song)
  // Only used when videos are not provided manually (Storybook mode)
  const { data: queriedVideos, isLoading: queriedIsLoadingVideos } = useSongVideos(
    manualVideos ? undefined : geniusId
  )

  // Use manual videos/loading if provided (for container), otherwise use queried
  const videos = manualVideos ?? queriedVideos ?? []
  const videosLoading = manualIsLoadingVideos ?? queriedIsLoadingVideos

  return (
    <div className={cn('relative w-full h-screen bg-background flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-6xl flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-50">
          <div className="flex items-center justify-between h-12 px-4">
            <BackButton onClick={onBack} variant="floating" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(true)}
              className="shrink-0"
              aria-label="External links"
            >
              <DotsThree className="w-6 h-6" weight="bold" />
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Album Art Hero */}
          <div className="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
            {artworkUrl && (
              <img
                src={artworkUrl}
                alt={songTitle}
                className="w-full h-full object-cover"
              />
            )}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.95) 100%)'
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-foreground text-2xl md:text-4xl font-bold mb-1">
                    {songTitle}
                  </h1>
                  {onArtistClick ? (
                    <button
                      onClick={onArtistClick}
                      className="text-muted-foreground text-xl md:text-2xl font-semibold hover:text-foreground transition-colors cursor-pointer text-left"
                    >
                      {artist}
                    </button>
                  ) : (
                    <p className="text-muted-foreground text-xl md:text-2xl font-semibold">
                      {artist}
                    </p>
                  )}
                </div>
                <button
                  onClick={onPlay}
                  className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer bg-primary hover:opacity-90"
                >
                  <Play className="w-7 h-7 text-foreground" weight="fill" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 mt-4 space-y-4 pb-8">
            {/* Tabs: Videos | Students */}
            <Tabs defaultValue="videos" className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                <TabsTrigger value="videos">{t('song.videos')}</TabsTrigger>
                <TabsTrigger value="students">{t('song.students')}</TabsTrigger>
              </TabsList>

              <TabsContent value="videos" className="mt-4">
                <VideoGrid
                  videos={videos}
                  isLoading={videosLoading}
                  onVideoClick={onVideoClick}
                />
              </TabsContent>

              <TabsContent value="students" className="mt-4">
                <div className="space-y-1">
                  {leaderboardEntries.map((entry) => (
                    <div
                      key={entry.username}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-full',
                        entry.isCurrentUser ? 'bg-primary/10' : 'bg-muted/30'
                      )}
                    >
                      <div className="w-8 text-center font-bold text-muted-foreground">
                        #{entry.rank}
                      </div>
                      {entry.avatarUrl && (
                        <img
                          src={entry.avatarUrl}
                          alt={entry.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{entry.username}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.score.toLocaleString()} {t('song.points')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {currentUser && !leaderboardEntries.some(e => e.isCurrentUser) && (
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
                          {currentUser.score.toLocaleString()} {t('song.points')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Sticky Footer with Study and Karaoke buttons */}
        {(onStudy || onKaraoke) && (
          <div className="flex-shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
            <div className="flex gap-3">
              {onStudy && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onStudy}
                  className="flex-1"
                >
                  {t('song.study')}
                </Button>
              )}
              {onKaraoke && (
                <Button
                  size="lg"
                  variant="default"
                  onClick={onKaraoke}
                  className="flex-1"
                >
                  {t('song.karaoke')}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* External Links Drawer */}
      <ExternalLinksDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        songLinks={songLinks}
        lyricsLinks={lyricsLinks}
      />
    </div>
  )
}
