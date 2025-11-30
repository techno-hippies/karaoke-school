import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, DotsThree } from '@phosphor-icons/react'
import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { VideoGrid, type VideoPost } from '@/components/video/VideoGrid'
import { Leaderboard, type LeaderboardEntry } from '@/components/leaderboard/Leaderboard'
import { ExternalLinksDrawer } from '@/components/media/ExternalLinksDrawer'
import { useSongVideos } from '@/hooks/useSongVideos'
import { cn } from '@/lib/utils'

// Re-export for backwards compatibility
export type { LeaderboardEntry }

/**
 * Skeleton loading state for SongPage
 * Matches the layout to prevent content jump
 */
export function SongPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-full h-screen bg-background flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-6xl flex flex-col">
        {/* Header skeleton */}
        <div className="absolute top-0 left-0 right-0 z-50">
          <div className="flex items-center justify-between h-12 px-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-10 h-10 rounded-full" />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Album Art Hero skeleton */}
          <div className="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
            <Skeleton className="w-full h-full" />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.95) 100%)'
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-8 w-48 md:h-10 md:w-64" />
                  <Skeleton className="h-6 w-32 md:h-7 md:w-40" />
                </div>
                <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
              </div>
            </div>
          </div>

          <div className="px-4 mt-4 space-y-4 pb-8">
            {/* Tabs skeleton */}
            <div className="w-full">
              <Skeleton className="w-full h-10 rounded-lg" />

              {/* Leaderboard skeleton entries */}
              <div className="mt-4 space-y-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 rounded-full bg-muted/30"
                  >
                    <Skeleton className="w-8 h-6" />
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <Skeleton className="flex-1 h-5" />
                    <Skeleton className="w-16 h-4" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer skeleton */}
        <div className="flex-shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
          <div className="flex gap-3">
            <Skeleton className="flex-1 h-12 rounded-lg" />
            <Skeleton className="flex-1 h-12 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
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
  // Videos - can provide manually or via spotifyTrackId query
  spotifyTrackId?: string // Query all videos for this song across creators
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
  spotifyTrackId,
  videos: manualVideos,
  isLoadingVideos: manualIsLoadingVideos,
  onVideoClick,
  leaderboardEntries,
  currentUser,
  className,
}: SongPageProps) {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Query videos by spotifyTrackId (queries Lens for all creator videos of this song)
  // Only used when videos are not provided manually (Storybook mode)
  const { data: queriedVideos, isLoading: queriedIsLoadingVideos } = useSongVideos(
    manualVideos ? undefined : spotifyTrackId
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
            <Tabs defaultValue="students" className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                <TabsTrigger value="students">{t('song.students')}</TabsTrigger>
                <TabsTrigger value="videos">
                  {t('song.videos')}{videos.length > 0 && ` (${videos.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="students" className="mt-4">
                <Leaderboard
                  entries={leaderboardEntries}
                  currentUser={currentUser}
                />
              </TabsContent>

              <TabsContent value="videos" className="mt-4">
                {videos.length > 0 || videosLoading ? (
                  <VideoGrid
                    videos={videos}
                    isLoading={videosLoading}
                    onVideoClick={onVideoClick}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground">{t('song.noVideosYet')}</p>
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
