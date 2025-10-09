import { Leaderboard } from './Leaderboard'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/ui/back-button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SongItem } from '@/components/ui/SongItem'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LeaderboardEntry } from './Leaderboard'
import { cn } from '@/lib/utils'

export interface ArtistSong {
  id: string
  title: string
  artist: string
  artworkUrl?: string
  onSongClick?: () => void
  onPlayClick?: () => void
  showPlayButton?: boolean
}

export interface ArtistPageProps {
  artistName: string
  artworkUrl?: string
  onBack?: () => void
  // Top Songs
  songs: ArtistSong[]
  // Leaderboard
  leaderboardEntries: LeaderboardEntry[]
  currentUser?: LeaderboardEntry
  // Actions
  onStudy?: () => void
  onQuiz?: () => void
  canQuiz?: boolean
  isStudyLoading?: boolean
  isQuizLoading?: boolean
  className?: string
}

// Artist detail page with top songs, leaderboard, and study/quiz actions
export function ArtistPage({
  artistName,
  artworkUrl,
  onBack,
  songs,
  leaderboardEntries,
  currentUser,
  onStudy,
  onQuiz,
  canQuiz = false,
  isStudyLoading = false,
  isQuizLoading = false,
  className,
}: ArtistPageProps) {
  return (
    <div className={cn('relative w-full h-screen bg-background overflow-hidden flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-2xl">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <div className="flex items-center h-16 px-4">
          <BackButton onClick={onBack} variant="floating" />
        </div>
      </div>

      {/* Main content */}
      <ScrollArea className="absolute top-0 left-0 right-0 bottom-0">
        {/* Album Art Hero */}
        <div className="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
          {artworkUrl && (
            <img
              src={artworkUrl}
              alt={artistName}
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
                <h1 className="text-foreground text-2xl font-bold">
                  {artistName}
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4 pb-32">
          <Tabs defaultValue="songs" className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-muted/50">
              <TabsTrigger value="songs">Top Songs</TabsTrigger>
              <TabsTrigger value="fans">Top Fans</TabsTrigger>
            </TabsList>

            <TabsContent value="songs" className="mt-4">
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
            </TabsContent>

            <TabsContent value="fans" className="mt-4">
              <Leaderboard
                entries={leaderboardEntries}
                currentUser={currentUser}
              />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* Sticky Footer with Study and Quiz Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
        <div className="flex gap-3">
          <Button
            onClick={onQuiz}
            disabled={!canQuiz || isQuizLoading}
            size="lg"
            variant="secondary"
            className="flex-1"
          >
            {isQuizLoading && <Spinner />}
            Quiz
          </Button>

          <Button
            onClick={onStudy}
            disabled={isStudyLoading}
            size="lg"
            className="flex-1"
          >
            {isStudyLoading && <Spinner />}
            Study
          </Button>
        </div>
      </div>
      </div>
    </div>
  )
}
