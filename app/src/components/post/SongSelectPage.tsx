import { useState } from 'react'
import { MagnifyingGlass, X, Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { SongItem } from '@/components/ui/SongItem'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

export interface Song {
  id: string
  title: string
  artist: string
  artworkUrl?: string
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
  onSelectSong?: (song: Song) => void
  /** Number of credits user currently has */
  userCredits?: number
  /** Called when user purchases credits */
  onPurchaseCredits?: () => void
  /** Called when user confirms credit usage */
  onConfirmCredit?: (song: Song) => void
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
  className,
}: SongSelectPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSheet, setShowSheet] = useState(false)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)

  const hasCredits = userCredits > 0

  const handleSongClick = (song: Song) => {
    setSelectedSong(song)
    setShowSheet(true)
  }

  const handlePurchase = () => {
    onPurchaseCredits?.()
    setShowSheet(false)
    // Optionally select the song after purchase
    if (selectedSong) {
      onSelectSong?.(selectedSong)
    }
    onClose()
  }

  const handleConfirm = () => {
    if (selectedSong) {
      onConfirmCredit?.(selectedSong)
      onSelectSong?.(selectedSong)
    }
    setShowSheet(false)
    onClose()
  }

  const handleCancel = () => {
    setShowSheet(false)
    setSelectedSong(null)
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

      {/* Credits Drawer - Purchase or Confirm */}
      <Drawer open={showSheet} onOpenChange={setShowSheet}>
        <DrawerContent className="p-4 flex flex-col">
          {/* Confirm Credit Usage */}
          {hasCredits && selectedSong ? (
            <div className="flex flex-col items-center gap-4">
                {/* Song artwork */}
                <div className="w-32 h-32 rounded-lg overflow-hidden">
                  {selectedSong.artworkUrl ? (
                    <img
                      src={selectedSong.artworkUrl}
                      alt={selectedSong.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center">
                      <span className="text-5xl">🎤</span>
                    </div>
                  )}
                </div>

                {/* Song details */}
                <div className="w-full text-center">
                  <h3 className="text-xl font-bold text-foreground">
                    {selectedSong.title}
                  </h3>
                  <p className="text-base text-muted-foreground mt-1">
                    {selectedSong.artist}
                  </p>
                </div>

                {/* Credit info */}
                <div className="w-full bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Use 1 credit for this song
                  </p>
                  <p className="text-base font-semibold text-foreground mt-1">
                    {userCredits - 1} credits remaining after
                  </p>
                </div>

                {/* Action buttons */}
                <div className="w-full space-y-2">
                  <Button
                    size="lg"
                    onClick={handleConfirm}
                    className="w-full"
                  >
                    Confirm
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleCancel}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
          ) : (
            /* Purchase Credits */
            <div className="flex flex-col items-center gap-4 text-center">
                {/* Header */}
                <div className="w-full">
                  <h2 className="text-2xl font-bold text-foreground">Get Karaoke Credits</h2>
                  <p className="text-base text-muted-foreground mt-1">$5 for 10 songs</p>
                </div>

                {/* Purchase Button */}
                <Button
                  size="lg"
                  onClick={handlePurchase}
                  className="w-full"
                >
                  Buy
                </Button>
              </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
