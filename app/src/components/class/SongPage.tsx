import { useState } from 'react'
import { Play, MusicNotes } from '@phosphor-icons/react'
import { StudyStats } from './StudyStats'
import { Leaderboard } from './Leaderboard'
import { ExternalLinksSheet } from './ExternalLinksSheet'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/ui/back-button'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LeaderboardEntry } from './Leaderboard'
import { cn } from '@/lib/utils'

interface ExternalLink {
  label: string
  url: string
}

export interface SongPageProps {
  songTitle: string
  artist: string
  artworkUrl?: string
  onBack?: () => void
  onPlay: () => void // Required - play button is always shown
  isExternal?: boolean // true = external song (opens sheet), false = local (plays directly)
  externalSongLinks?: ExternalLink[]
  externalLyricsLinks?: ExternalLink[]
  // Study stats
  newCount: number
  learningCount: number
  dueCount: number
  // Leaderboard
  leaderboardEntries: LeaderboardEntry[]
  currentUser?: LeaderboardEntry
  // Actions
  onStudy?: () => void
  onKaraoke?: () => void
  isStudyLoading?: boolean
  isKaraokeLoading?: boolean
  className?: string
}

// Song detail page with stats, leaderboard, and study/karaoke actions
export function SongPage({
  songTitle,
  artist,
  artworkUrl,
  onBack,
  onPlay,
  isExternal = false,
  externalSongLinks = [],
  externalLyricsLinks = [],
  newCount,
  learningCount,
  dueCount,
  leaderboardEntries,
  currentUser,
  onStudy,
  onKaraoke,
  isStudyLoading = false,
  isKaraokeLoading = false,
  className,
}: SongPageProps) {
  const [isExternalSheetOpen, setIsExternalSheetOpen] = useState(false)
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
                <h1 className="text-foreground text-2xl font-bold mb-1">
                  {songTitle}
                </h1>
                <p className="text-muted-foreground text-base">
                  {artist}
                </p>
              </div>
              <button
                onClick={() => {
                  if (isExternal) {
                    setIsExternalSheetOpen(true)
                  } else {
                    onPlay()
                  }
                }}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer",
                  isExternal ? "bg-purple-600 hover:bg-purple-700" : "bg-primary hover:opacity-90"
                )}
              >
                {isExternal ? (
                  <MusicNotes className="w-7 h-7 text-foreground" weight="fill" />
                ) : (
                  <Play className="w-7 h-7 text-foreground" weight="fill" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4 space-y-4 pb-32">
          {/* Study Stats */}
          <StudyStats
            newCount={newCount}
            learningCount={learningCount}
            dueCount={dueCount}
          />

          {/* Top Fans */}
          <div>
            <h2 className="text-foreground text-lg font-semibold mb-3">Top Fans</h2>
            <Leaderboard
              entries={leaderboardEntries}
              currentUser={currentUser}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Sticky Footer with Study and Karaoke Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
        <div className="flex gap-3">
          <Button
            onClick={onStudy}
            disabled={isStudyLoading}
            size="lg"
            variant="secondary"
            className="flex-1"
          >
            {isStudyLoading && <Spinner />}
            Study
          </Button>

          <Button
            onClick={onKaraoke}
            disabled={isKaraokeLoading}
            size="lg"
            className="flex-1"
          >
            {isKaraokeLoading && <Spinner />}
            Karaoke
          </Button>
        </div>
      </div>

      {/* External Links Sheet */}
      <ExternalLinksSheet
        open={isExternalSheetOpen}
        onOpenChange={setIsExternalSheetOpen}
        songLinks={externalSongLinks}
        lyricsLinks={externalLyricsLinks}
      />
      </div>
    </div>
  )
}
