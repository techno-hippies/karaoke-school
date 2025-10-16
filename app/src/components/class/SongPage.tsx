import { useState, memo } from 'react'
import { Play, MusicNotes, Lock } from '@phosphor-icons/react'
import { Leaderboard } from './Leaderboard'
import { ExternalLinksDrawer } from './ExternalLinksDrawer'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/ui/back-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
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
  geniusArtistId?: number // Genius artist ID for linking to artist page
  artworkUrl?: string
  onBack?: () => void
  onPlay: () => void // Required - play button is always shown
  onArtistClick?: () => void // Called when artist name is clicked (if geniusArtistId is provided)
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
  isOwned?: boolean // Is this song already owned by the user?
  isUnlocking?: boolean // Cataloging in progress (match-and-segment)
  isProcessing?: boolean // Paid processing in progress (audio/alignment/translation)
  onAuthRequired?: () => void // Called when user needs to authenticate
  isAuthenticated?: boolean
  className?: string
  // Cataloging
  catalogError?: string | null
  hasFullAudio?: boolean | null // true = full audio, false = 30s snippet only, null = not yet checked
  isLocked?: boolean // true = segments are locked (cataloged but not aligned yet)
}

// Song detail page with stats, leaderboard, and study/karaoke actions
export const SongPage = memo(function SongPage({
  songTitle,
  artist,
  geniusArtistId,
  artworkUrl,
  onBack,
  onPlay,
  onArtistClick,
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
  // isFree = false, // TODO: Use this when implementing free songs
  isOwned = false,
  isUnlocking = false,
  isProcessing = false,
  onAuthRequired,
  isAuthenticated = false,
  className,
  catalogError,
  hasFullAudio,
  isLocked = false,
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
    console.log('[SongPage] handleUnlockAction called', {
      isAuthenticated,
      hasOnUnlockAll: !!onUnlockAll,
      hasOnAuthRequired: !!onAuthRequired
    })

    if (!isAuthenticated && onAuthRequired) {
      console.log('[SongPage] Not authenticated, calling onAuthRequired')
      onAuthRequired()
      return
    }
    if (onUnlockAll) {
      console.log('[SongPage] Calling onUnlockAll')
      onUnlockAll()
    } else {
      console.warn('[SongPage] onUnlockAll is not defined!')
    }
  }

  // Check if unlock button should be shown
  // Show button if:
  // 1. No segments yet (not cataloged) - will show skeleton
  // 2. OR segments are locked (cataloged but not aligned yet)
  // 3. Show even if owned IF segments are locked (need to run base-alignment)
  const showUnlockButton = segments.length === 0 || isLocked

  return (
    <div className={cn('relative w-full h-screen bg-background overflow-hidden flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-6xl">
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
                <h1 className="text-foreground text-2xl md:text-4xl font-bold mb-1">
                  {songTitle}
                </h1>
                {geniusArtistId && geniusArtistId > 0 && onArtistClick ? (
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

        {/* Warning: 30-second snippet only */}
        {hasFullAudio === false && (
          <div className="mx-4 mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-yellow-500 mt-0.5">⚠️</div>
              <div className="flex-1">
                <h3 className="text-yellow-500 font-semibold mb-1">30-Second Preview Only</h3>
                <p className="text-muted-foreground text-sm">
                  Not all segments will be available for karaoke after unlock. This song only has a 30-second preview audio available.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error: Cataloging failed */}
        {catalogError && (
          <div className="mx-4 mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-destructive mt-0.5">❌</div>
              <div className="flex-1">
                <h3 className="text-destructive font-semibold mb-1">
                  {catalogError.includes('No SoundCloud audio available') ? 'Not Available' : 'Catalog Failed'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {catalogError.includes('No SoundCloud audio available')
                    ? 'Check back later, maybe this song will be available in the future.'
                    : catalogError}
                </p>
              </div>
            </div>
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
              {isUnlocking || (showUnlockButton && segments.length === 0) ? (
                // Cataloging state OR waiting for segments to load - show skeleton
                <div className="space-y-4">
                  <ScrollArea className="max-h-[50vh]">
                    <div className="space-y-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="px-4 py-3 space-y-2">
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : segments.length > 0 ? (
                // Show segment list (locked or unlocked)
                <div className="space-y-4">
                  <ScrollArea className="max-h-[50vh]">
                    <div className="space-y-1">
                      {segments.map((segment) => (
                        <Item
                          key={segment.id}
                          variant="default"
                          className={cn(
                            "gap-3 px-4 py-3 transition-colors",
                            isLocked || isGenerating
                              ? "opacity-60 cursor-not-allowed"
                              : "cursor-pointer hover:bg-muted/50"
                          )}
                          onClick={() => !isGenerating && !isLocked && handleSegmentAction(segment)}
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
                          {isLocked && (
                            <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" weight="regular" />
                          )}
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
      {showUnlockButton && !isUnlocking && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
          <Button
            size="lg"
            variant="default"
            onClick={handleUnlockAction}
            className="w-full"
            disabled={isGenerating || isProcessing}
          >
            {isProcessing && <Spinner size="sm" />}
            {isProcessing
              ? 'Processing...'
              : isOwned && isLocked
                ? 'Complete Setup (Free)'
                : isOwned
                  ? 'Unlocked'
                  : 'Unlock (1 credit)'}
          </Button>
        </div>
      )}

      {/* External Links Drawer */}
      <ExternalLinksDrawer
        open={isExternalSheetOpen}
        onOpenChange={setIsExternalSheetOpen}
        songLinks={externalSongLinks}
        lyricsLinks={externalLyricsLinks}
      />
      </div>
    </div>
  )
})
