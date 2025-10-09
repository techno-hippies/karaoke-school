import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { SongItem } from '@/components/ui/SongItem'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from '@/components/ui/input-group'
import { SegmentPickerDrawer, type SongSegment } from './SegmentPickerDrawer'
import { PurchaseCreditsDialog } from './PurchaseCreditsDialog'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

// Re-export for convenience
export type { SongSegment } from './SegmentPickerDrawer'

export interface Song {
  id: string
  title: string
  artist: string
  artworkUrl?: string
  isFree?: boolean           // Maps to !requiresPayment in KaraokeCatalogV1 contract
  isProcessed?: boolean      // Has karaoke segments been generated?
  segments?: SongSegment[]   // Available segments
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
  /** Search results */
  searchResults?: Song[]
  /** Whether search is loading */
  isSearching?: boolean
  /** Called when user searches */
  onSearch?: (query: string) => void
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
  searchResults = [],
  isSearching = false,
  onSearch,
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
  const [drawerMode, setDrawerMode] = useState<'segment' | 'purchase'>('segment')
  const [hasSearched, setHasSearched] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState(0)

  const hasCredits = userCredits > 0

  // Placeholder segments for loading state
  const placeholderSegments: SongSegment[] = [
    { id: 'placeholder-1', displayName: 'Verse 1', startTime: 0, endTime: 0, duration: 0 },
    { id: 'placeholder-2', displayName: 'Chorus', startTime: 0, endTime: 0, duration: 0 },
    { id: 'placeholder-3', displayName: 'Verse 2', startTime: 0, endTime: 0, duration: 0 },
  ]

  // Simulate progress bar for generation (10 seconds)
  useEffect(() => {
    if (!isGenerating) return

    const interval = setInterval(() => {
      setGeneratingProgress((prev) => {
        if (prev >= 95) {
          // Stop at 95% and wait for actual completion
          return prev
        }
        return prev + 1
      })
    }, 100) // 100ms * 95 = ~9.5 seconds

    return () => clearInterval(interval)
  }, [isGenerating])

  // Detect when generation completes (song gets segments)
  useEffect(() => {
    if (isGenerating && selectedSong?.isProcessed && selectedSong?.segments) {
      // Generation complete!
      setGeneratingProgress(100)
      setTimeout(() => {
        setIsGenerating(false)
      }, 300) // Brief delay to show 100%
    }
  }, [isGenerating, selectedSong?.isProcessed, selectedSong?.segments])

  const handleSongClick = (song: Song) => {
    // Set selected song
    setSelectedSong(song)
    setSelectedSegment(null) // Reset segment

    // Free songs (requiresPayment=false in contract)
    if (song.isFree) {
      // Free songs: Process immediately, no credit check
      if (!song.isProcessed) {
        setIsGenerating(true)
        setGeneratingProgress(0)
        // Trigger generation in background
        onGenerateKaraoke?.(song)
      } else {
        setIsGenerating(false)
        setGeneratingProgress(0)
      }
      setDrawerMode('segment')
      setShowSheet(true)
      return
    }

    // Paid songs (requiresPayment=true in contract): Check credits FIRST
    if (!hasCredits) {
      // No credits - show purchase dialog immediately (don't waste time generating)
      setDrawerMode('purchase')
      setShowSheet(true)
      return
    }

    // Has credits - proceed with generation/segment picker
    if (!song.isProcessed) {
      setIsGenerating(true)
      setGeneratingProgress(0)
      // Trigger generation in background
      onGenerateKaraoke?.(song)
    } else {
      setIsGenerating(false)
      setGeneratingProgress(0)
    }

    setDrawerMode('segment')
    setShowSheet(true)
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

    // After purchase, if selected song needs generation, start it
    if (selectedSong && !selectedSong.isProcessed) {
      setIsGenerating(true)
      setGeneratingProgress(0)
      onGenerateKaraoke?.(selectedSong)
      setDrawerMode('segment')
      // Keep drawer open, transition to segment picker with loading state
    } else if (selectedSong && selectedSong.isProcessed) {
      // Song already processed, just show segment picker
      setDrawerMode('segment')
    } else {
      // No selected song, close everything
      setShowSheet(false)
      onClose()
    }
  }

  const handleSearch = () => {
    if (!searchQuery.trim()) return

    setHasSearched(true)
    onSearch?.(searchQuery)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setHasSearched(false)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Local filtering for trending/favorites when not using search Lit Action
  const filterSongs = (songs: Song[]) => {
    if (hasSearched) return [] // Don't show local results when showing search results
    return searchQuery && !hasSearched
      ? songs.filter(
          (song) =>
            song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            song.artist.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : songs
  }

  const filteredTrending = filterSongs(trendingSongs)
  const filteredFavorites = filterSongs(favoriteSongs)

  // Display search results if user has searched
  const displaySongs = hasSearched ? searchResults : filteredTrending

  if (!open) return null

  return (
    <>
      {/* Page content (not overlay - renders within AppLayout) */}
      <div className={cn('min-h-screen bg-background flex flex-col', className)}>
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="w-12" />
          <h1 className="text-center font-semibold text-base text-foreground flex-1">
            Select a song
          </h1>
          <div className="w-12" />
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col min-h-0 p-4 max-w-2xl mx-auto w-full">
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
                  onKeyDown={handleSearchKeyDown}
                />
                <InputGroupAddon align="inline-end">
                  {isSearching ? (
                    <div className="px-3">
                      <Spinner size="sm" />
                    </div>
                  ) : hasSearched ? (
                    <InputGroupButton
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSearch}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear
                    </InputGroupButton>
                  ) : (
                    <InputGroupButton
                      variant="secondary"
                      size="sm"
                      onClick={handleSearch}
                      disabled={!searchQuery.trim()}
                    >
                      Search
                    </InputGroupButton>
                  )}
                </InputGroupAddon>
              </InputGroup>
            </div>

            {/* Trending Tab Content */}
            <TabsContent value="trending" className="flex-1 mt-4 min-h-0">
              <ScrollArea className="h-full">
                <div className="space-y-1 pr-4">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner size="md" />
                    </div>
                  ) : displaySongs.length > 0 ? (
                    displaySongs.map((song) => (
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
                        {hasSearched ? 'No songs found' : searchQuery ? 'No songs found' : 'No songs available'}
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

      {/* Segment Picker Drawer */}
      {selectedSong && (
        <SegmentPickerDrawer
          open={showSheet && drawerMode === 'segment'}
          onOpenChange={setShowSheet}
          songTitle={selectedSong.title}
          songArtist={selectedSong.artist}
          songArtwork={selectedSong.artworkUrl}
          segments={isGenerating ? placeholderSegments : (selectedSong.segments || [])}
          onSelectSegment={handleSegmentSelect}
          isGenerating={isGenerating}
          generatingProgress={generatingProgress}
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
