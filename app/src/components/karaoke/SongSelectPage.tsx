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
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export interface Song {
  id: string
  title: string
  artist: string
  artworkUrl?: string
  isFree?: boolean           // Maps to !requiresPayment in contract
  isProcessed?: boolean      // Has karaoke segments been generated?
  soundcloudPermalink?: string // For external links
  geniusId?: number          // For external links
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
  /** Called when a song is clicked (for navigation) */
  onSongClick?: (song: Song) => void
  /** Optional className */
  className?: string
}

/**
 * SongSelectPage - Full-page song selection interface
 * Features:
 * - Trending/Favorites tabs
 * - Search functionality
 * - Scrollable song list
 * - Simple navigation - credit/unlock logic handled on individual song pages
 */
export function SongSelectPage({
  open,
  onClose,
  trendingSongs = [],
  favoriteSongs = [],
  searchResults = [],
  isSearching = false,
  onSearch,
  onSongClick,
  className,
}: SongSelectPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const handleSongClick = (song: Song) => {
    console.log('[SongSelectPage] handleSongClick called for:', song.title, 'geniusId:', song.id)
    console.log('[SongSelectPage] onSongClick prop exists:', !!onSongClick)
    onSongClick?.(song)
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

  // Don't filter while typing - only show search results after user triggers search
  const filterSongs = (songs: Song[]) => {
    if (hasSearched) return [] // Don't show local results when showing search results
    return songs // Show all songs until user actually searches
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
          <h1 className="text-center font-semibold text-base md:text-xl text-foreground flex-1">
            Select a song
          </h1>
          <div className="w-12" />
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col min-h-0 p-4 max-w-6xl mx-auto w-full">
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
                      onClick={handleClearSearch}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear
                    </InputGroupButton>
                  ) : (
                    <InputGroupButton
                      variant="secondary"
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
                      <p className="text-muted-foreground text-sm md:text-base">
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
                      <p className="text-muted-foreground text-sm md:text-base">
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
    </>
  )
}
