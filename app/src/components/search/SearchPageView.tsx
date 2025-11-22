import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from '@phosphor-icons/react'
import { SongItem } from '@/components/ui/SongItem'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'

export interface Song {
  id: string
  geniusId: number
  title: string
  artist: string
  artworkUrl?: string
  isProcessed?: boolean
}

export interface SearchPageViewProps {
  /** Trending songs */
  trendingSongs?: Song[]
  /** Search results */
  searchResults?: Song[]
  /** Whether search is loading */
  isSearching?: boolean
  /** Called when user searches */
  onSearch?: (query: string) => void
  /** Called when user clears search */
  onClearSearch?: () => void
  /** Called when a song is clicked */
  onSongClick?: (song: Song) => void
  /** Initial search query */
  initialSearchQuery?: string
}

/**
 * SearchPageView - Full-page song search interface
 * Features:
 * - Trending songs display
 * - Search functionality
 * - Scrollable song list
 */
export function SearchPageView({
  trendingSongs = [],
  searchResults = [],
  isSearching = false,
  onSearch,
  onClearSearch,
  onSongClick,
  initialSearchQuery = '',
}: SearchPageViewProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [hasSearched, setHasSearched] = useState(!!initialSearchQuery)

  const handleSearch = () => {
    if (!searchQuery.trim()) return

    setHasSearched(true)
    onSearch?.(searchQuery)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setHasSearched(false)
    onClearSearch?.()
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Display search results if user has searched, otherwise show trending
  const displaySongs = hasSearched ? searchResults : trendingSongs

  return (
    <div className='min-h-screen bg-background flex flex-col'>
      {/* Content area */}
      <div className="flex-1 flex flex-col min-h-0 p-4 max-w-6xl mx-auto w-full">
        {/* Search */}
        <div className="flex-shrink-0 space-y-3">
          <InputGroup>
            <InputGroupInput
              type="text"
              placeholder={t('search.placeholder')}
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
                  {t('search.clear')}
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  variant="secondary"
                  onClick={handleSearch}
                  disabled={!searchQuery.trim()}
                >
                  {t('nav.search')}
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Song List */}
        <div className="flex-1 mt-4 min-h-0">
          <ScrollArea className="h-full">
            <div className="space-y-1">
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
                    onClick={() => onSongClick?.(song)}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground text-base md:text-lg">
                    {hasSearched ? t('search.noSongsFound') : t('search.noSongsAvailable')}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
