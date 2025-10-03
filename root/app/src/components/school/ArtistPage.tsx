import { CaretLeft } from '@phosphor-icons/react'
import { Leaderboard } from './Leaderboard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SongListItem } from '@/components/ui/SongListItem'
import type { LeaderboardEntry } from './Leaderboard'
import { cn } from '@/lib/utils'

export interface ArtistSong {
  id: string
  title: string
  artworkUrl?: string
  dueCount?: number
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
    <div className={cn('relative w-full h-screen bg-neutral-900 overflow-hidden', className)}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <div className="flex items-center h-16 px-4">
          <button
            onClick={onBack}
            className="w-12 h-12 flex items-center justify-center hover:bg-neutral-800/50 transition-colors rounded-full"
          >
            <CaretLeft className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        className="absolute top-0 left-0 right-0 bottom-0 overflow-y-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgb(64 64 64) transparent'
        }}
      >
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
                <h1 className="text-white text-2xl font-bold">
                  {artistName}
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4 pb-32">
          <Tabs defaultValue="songs" className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-neutral-800/50">
              <TabsTrigger value="songs">Top Songs</TabsTrigger>
              <TabsTrigger value="fans">Top Fans</TabsTrigger>
            </TabsList>

            <TabsContent value="songs" className="mt-4">
              <div className="space-y-1">
                {songs.map((song) => (
                  <SongListItem
                    key={song.id}
                    title={song.title}
                    artist=""
                    artworkUrl={song.artworkUrl}
                    dueCount={song.dueCount}
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
      </div>

      {/* Sticky Footer with Study and Quiz Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-neutral-900 via-neutral-900 to-transparent pt-8 pb-4 px-4">
        <div className="flex gap-3">
          <Button
            onClick={onQuiz}
            disabled={!canQuiz || isQuizLoading}
            size="lg"
            variant="secondary"
            className="flex-1"
          >
            {isQuizLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : (
              'Quiz'
            )}
          </Button>

          <Button
            onClick={onStudy}
            disabled={isStudyLoading}
            size="lg"
            className="flex-1"
          >
            {isStudyLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
            ) : (
              'Study'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
