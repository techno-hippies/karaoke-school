import { useTranslation } from 'react-i18next'
import { DotsThree, MusicNote } from '@phosphor-icons/react'
import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Leaderboard, type LeaderboardEntry } from '@/components/leaderboard/Leaderboard'
import { cn } from '@/lib/utils'

export interface ArtistSong {
  id: string
  title: string
  coverUrl?: string
  onClick?: () => void
}

// Re-export LeaderboardEntry as StudentEntry for backwards compatibility
export type StudentEntry = LeaderboardEntry

export interface ArtistPageProps {
  artistName: string
  imageUrl?: string
  songs: ArtistSong[]
  isLoadingSongs?: boolean
  students: StudentEntry[]
  isLoadingStudents?: boolean
  currentUser?: StudentEntry
  onBack?: () => void
  onSongClick?: (song: ArtistSong) => void
  onStudentsTabClick?: () => void
  className?: string
}

/**
 * Artist detail page with songs and student leaderboard
 * Matches SongPage structure with tabs
 */
export function ArtistPage({
  artistName,
  imageUrl,
  songs,
  isLoadingSongs,
  students,
  isLoadingStudents,
  currentUser,
  onBack,
  onSongClick,
  onStudentsTabClick,
  className,
}: ArtistPageProps) {
  const { t } = useTranslation()

  const handleTabChange = (value: string) => {
    if (value === 'students' && onStudentsTabClick) {
      onStudentsTabClick()
    }
  }

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
              className="shrink-0 opacity-0 pointer-events-none"
              aria-hidden
            >
              <DotsThree className="w-6 h-6" weight="bold" />
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Artist Hero */}
          <div className="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={artistName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <MusicNote className="w-24 h-24 text-primary/40" weight="fill" />
              </div>
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
                  <h1 className="text-foreground text-2xl md:text-4xl font-bold">
                    {artistName}
                  </h1>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 mt-4 space-y-4 pb-8">
            {/* Tabs: Songs | Students */}
            <Tabs defaultValue="songs" className="w-full" onValueChange={handleTabChange}>
              <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                <TabsTrigger value="songs">{t('artist.songsTab', 'Songs')}</TabsTrigger>
                <TabsTrigger value="students">{t('artist.studentsTab', 'Students')}</TabsTrigger>
              </TabsList>

              <TabsContent value="songs" className="mt-4">
                {isLoadingSongs ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" />
                  </div>
                ) : songs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {t('artist.noSongs', 'No songs available')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {songs.map((song) => (
                      <button
                        key={song.id}
                        onClick={() => {
                          song.onClick?.()
                          onSongClick?.(song)
                        }}
                        className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        {/* Song Cover */}
                        <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                          {song.coverUrl ? (
                            <img
                              src={song.coverUrl}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <MusicNote className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Song Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{song.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="students" className="mt-4">
                <Leaderboard
                  entries={students}
                  currentUser={currentUser}
                  isLoading={isLoadingStudents}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
