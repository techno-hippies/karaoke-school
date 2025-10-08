import { useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { SongItem } from '@/components/ui/SongItem'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { SegmentPickerDrawer, type SongSegment } from './SegmentPickerDrawer'
import { GenerateKaraokeDrawer } from './GenerateKaraokeDrawer'
import { PurchaseCreditsDialog } from './PurchaseCreditsDialog'
import { cn } from '@/lib/utils'

// Re-export for convenience
export type { SongSegment } from './SegmentPickerDrawer'

export interface Song {
  id: string
  title: string
  artist: string
  artworkUrl?: string
  isFree?: boolean
  isProcessed?: boolean  // Has karaoke segments been generated?
  segments?: SongSegment[]  // Available segments
}

export interface SongSelectPageProps {
  /** Whether the page is open */
  open: boolean
  /** Called when the page should close */
  onClose: () => void
  /** Trending songs */
  trendingSongs?: Song[]
  /** User's favorite songs */
  favoriteSongs?: Song[]
  /** Called when a song is selected (after confirmation/purchase) */
  onSelectSong?: (song: Song, segment: SongSegment) => void
  /** Number of credits user currently has */
  userCredits?: number
  /** Called when user purchases credits */
  onPurchaseCredits?: () => void
  /** Called when user confirms credit usage */
  onConfirmCredit?: (song: Song, segment: SongSegment) => void
  /** Called when user initiates karaoke generation for a song */
  onGenerateKaraoke?: (song: Song) => void
  /** Optional className */
  className?: string
}

/**
 * SongSelectPage - Full-page song selection interface
 * Features:
 * - Trending/Favorites tabs (TikTok-style)
 * - Search functionality
 * - Scrollable song list
 * - Opens credits purchase sheet when needed
 */
export function SongSelectPage({
  open,
  onClose,
  trendingSongs = [],
  favoriteSongs = [],
  onSelectSong,
  userCredits = 0,
  onPurchaseCredits,
  onConfirmCredit,
  onGenerateKaraoke,
  className,
}: SongSelectPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSheet, setShowSheet] = useState(false)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<SongSegment | null>(null)
  const [drawerMode, setDrawerMode] = useState<'generate' | 'segment' | 'purchase'>('segment')

  const hasCredits = userCredits > 0

  const handleSongClick = (song: Song) => {
    // Free songs skip credit flow
    if (song.isFree) {
      // TODO: Still need segment picker for free songs?
      // For now, skip everything
      onClose()
      return
    }

    // Set selected song
    setSelectedSong(song)
    setSelectedSegment(null) // Reset segment

    // Determine which drawer to show
    if (!song.isProcessed) {
      // Song needs karaoke generation first
      setDrawerMode('generate')
    } else {
      // Song is processed - show segment picker
      setDrawerMode('segment')
    }

    setShowSheet(true)
  }

  const handleGenerate = () => {
    if (selectedSong) {
      onGenerateKaraoke?.(selectedSong)
    }
    setShowSheet(false)
    onClose()
  }

  const handleSegmentSelect = (segment: SongSegment) => {
    setSelectedSegment(segment)

    // If segment is already owned, skip payment and proceed directly
    if (segment.isOwned) {
      if (selectedSong) {
        onSelectSong?.(selectedSong, segment)
      }
      setShowSheet(false)
      onClose()
      return
    }

    // For locked segments, check if user has credits
    if (hasCredits) {
      // User has credits - trigger payment/confirm directly
      if (selectedSong) {
        onConfirmCredit?.(selectedSong, segment)
        onSelectSong?.(selectedSong, segment)
      }
      setShowSheet(false)
      onClose()
    } else {
      // User needs to buy credits first
      setDrawerMode('purchase')
    }
  }

  const handlePurchase = () => {
    onPurchaseCredits?.()
    setShowSheet(false)
    onClose()
  }

  const filterSongs = (songs: Song[]) => {
    return searchQuery
      ? songs.filter(
          (song) =>
            song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            song.artist.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : songs
  }

  const filteredTrending = filterSongs(trendingSongs)
  const filteredFavorites = filterSongs(favoriteSongs)

  if (!open) return null

  return (
    <>
      {/* Full-page overlay */}
      <div className={cn('fixed inset-0 bg-background z-50 flex flex-col', className)}>
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button
            variant="ghost"
            size="lg"
            onClick={onClose}
            className="w-12 px-0 text-foreground hover:bg-black/30 hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-6 h-6" weight="regular" />
          </Button>
          <h1 className="text-xl font-semibold flex-1 text-center mr-12">
            Select a song
          </h1>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <Tabs defaultValue="trending" className="flex-1 flex flex-col min-h-0">
            {/* Tabs */}
            <TabsList className="w-full flex-shrink-0">
              <TabsTrigger value="trending" className="flex-1">
                Trending
              </TabsTrigger>
              <TabsTrigger value="favorites" className="flex-1">
                Favorites
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            <div className="mt-4 flex-shrink-0">
              <InputGroup>
                <InputGroupInput
                  type="text"
                  placeholder="Search songs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <InputGroupAddon>
                  <MagnifyingGlass />
                </InputGroupAddon>
              </InputGroup>
            </div>

            {/* Trending Tab Content */}
            <TabsContent value="trending" className="flex-1 mt-4 min-h-0">
              <ScrollArea className="h-full">
                <div className="space-y-1 pr-4">
                  {filteredTrending.length > 0 ? (
                    filteredTrending.map((song) => (
                      <SongItem
                        key={song.id}
                        title={song.title}
                        artist={song.artist}
                        artworkUrl={song.artworkUrl}
                        isFree={song.isFree}
                        onClick={() => handleSongClick(song)}
                      />
                    ))
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <p className="text-muted-foreground text-sm">
                        {searchQuery ? 'No songs found' : 'No songs available'}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Favorites Tab Content */}
            <TabsContent value="favorites" className="flex-1 mt-4 min-h-0">
              <ScrollArea className="h-full">
                <div className="space-y-1 pr-4">
                  {filteredFavorites.length > 0 ? (
                    filteredFavorites.map((song) => (
                      <SongItem
                        key={song.id}
                        title={song.title}
                        artist={song.artist}
                        artworkUrl={song.artworkUrl}
                        isFree={song.isFree}
                        onClick={() => handleSongClick(song)}
                      />
                    ))
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <p className="text-muted-foreground text-sm">
                        {searchQuery ? 'No songs found' : 'No songs available'}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Generate Karaoke Drawer */}
      <GenerateKaraokeDrawer
        open={showSheet && drawerMode === 'generate'}
        onOpenChange={setShowSheet}
        onGenerate={handleGenerate}
      />

      {/* Segment Picker Drawer */}
      {selectedSong && selectedSong.segments && (
        <SegmentPickerDrawer
          open={showSheet && drawerMode === 'segment'}
          onOpenChange={setShowSheet}
          songTitle={selectedSong.title}
          songArtist={selectedSong.artist}
          songArtwork={selectedSong.artworkUrl}
          segments={selectedSong.segments}
          onSelectSegment={handleSegmentSelect}
        />
      )}

      {/* Purchase Credits Dialog */}
      <PurchaseCreditsDialog
        open={showSheet && drawerMode === 'purchase'}
        onOpenChange={setShowSheet}
        price="$10"
        creditAmount={20}
        onPurchase={handlePurchase}
      />
    </>
  )
}
