import { useState } from 'react'
import { Play, MusicNotes, LockKey } from '@phosphor-icons/react'
import { Leaderboard } from './Leaderboard'
import { ExternalLinksSheet } from './ExternalLinksSheet'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/ui/back-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from '@/components/ui/item'
import type { LeaderboardEntry } from './Leaderboard'
import { cn } from '@/lib/utils'

interface ExternalLink {
  label: string
  url: string
}

export interface SongSegment {
  id: string
  displayName: string
  startTime: number
  endTime: number
  duration: number
  audioUrl?: string
  isOwned?: boolean
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
  // Leaderboard
  leaderboardEntries: LeaderboardEntry[]
  currentUser?: LeaderboardEntry
  // Karaoke segments
  segments?: SongSegment[]
  onSelectSegment?: (segment: SongSegment) => void
  onUnlockAll?: () => void
  isGenerating?: boolean
  generatingProgress?: number // 0-100
  isFree?: boolean // Is this a free song (no credits required)?
  isUnlocking?: boolean
  onAuthRequired?: () => void // Called when user needs to authenticate
  isAuthenticated?: boolean
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
  leaderboardEntries,
  currentUser,
  segments = [],
  onSelectSegment,
  onUnlockAll,
  isGenerating = false,
  generatingProgress = 0,
  isFree = false,
  isUnlocking = false,
  onAuthRequired,
  isAuthenticated = false,
  className,
}: SongPageProps) {
  const [isExternalSheetOpen, setIsExternalSheetOpen] = useState(false)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const handleSegmentAction = (segment: SongSegment) => {
    if (!isAuthenticated && onAuthRequired) {
      onAuthRequired()
      return
    }
    if (onSelectSegment) {
      onSelectSegment(segment)
    }
  }

  const handleUnlockAction = () => {
    if (!isAuthenticated && onAuthRequired) {
      onAuthRequired()
      return
    }
    if (onUnlockAll) {
      onUnlockAll()
    }
  }

  // Check if unlock button should be shown
  // Show unlock button if not free AND either:
  // - segments is empty (unprocessed song)
  // - OR segments has at least one unowned segment
  const showUnlockButton = !isFree && (segments.length === 0 || segments.some(seg => !seg.isOwned))

  console.log('[SongPage] Unlock button logic:', {
    isFree,
    segmentsLength: segments.length,
    hasUnownedSegments: segments.some(seg => !seg.isOwned),
    showUnlockButton
  })

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
      <ScrollArea className={cn("absolute top-0 left-0 right-0", showUnlockButton ? "bottom-24" : "bottom-0")}>
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

        {/* Progress bar - positioned below hero image */}
        {isGenerating && (
          <div className="w-full">
            <Progress value={generatingProgress} className="h-1 rounded-none bg-black/30" />
          </div>
        )}

        <div className="px-4 mt-4 space-y-4 pb-8">
          {/* Tabs: Segments | Leaderboard */}
          <Tabs defaultValue="clips" className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-muted/50">
              <TabsTrigger value="clips">Segments</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="clips" className="mt-4">
              {showUnlockButton ? (
                // Locked state - show lock icon and message (for unprocessed or locked songs)
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <LockKey className="w-10 h-10 text-muted-foreground" weight="duotone" />
                  </div>
                  <p className="text-muted-foreground text-base">
                    Once unlocked, anyone can karaoke to the song.
                  </p>
                </div>
              ) : segments.length > 0 ? (
                // Unlocked state - show segment list
                <div className="space-y-4">
                  <ScrollArea className="max-h-[50vh]">
                    <div className="space-y-1">
                      {segments.map((segment) => (
                        <Item
                          key={segment.id}
                          variant="default"
                          className="gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => !isGenerating && handleSegmentAction(segment)}
                        >
                          <ItemContent>
                            <ItemTitle className={isGenerating ? "text-muted-foreground" : ""}>
                              {segment.displayName}
                            </ItemTitle>
                            <ItemDescription>
                              {segment.startTime === 0 && segment.endTime === 0
                                ? '\u00A0'
                                : `${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}`}
                              </ItemDescription>
                          </ItemContent>
                        </Item>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="leaderboard" className="mt-4">
              <Leaderboard
                entries={leaderboardEntries}
                currentUser={currentUser}
              />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* Sticky Footer with Unlock Button */}
      {showUnlockButton && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
          <Button
            size="lg"
            variant="default"
            onClick={handleUnlockAction}
            className="w-full"
            disabled={isGenerating || isUnlocking}
          >
            {isUnlocking && <Spinner size="sm" />}
            {isUnlocking ? 'Unlocking...' : 'Unlock (1 credit)'}
          </Button>
        </div>
      )}

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
