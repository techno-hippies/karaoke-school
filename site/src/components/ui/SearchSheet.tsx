import React, { useState } from 'react'
import { X } from '@phosphor-icons/react'
import { SearchInput } from './SearchInput'

interface SearchResult {
  genius_id: number
  title: string
  title_with_featured: string
  artist: string
  genius_slug: string
  url: string
  artwork_thumbnail: string | null
  lyrics_state: string
}

interface SearchSheetProps {
  isOpen: boolean
  onClose: () => void
  isConnected?: boolean
  onConnectClick?: () => void
  onSearch?: (query: string) => void
  searchResults?: SearchResult[]
  isLoading?: boolean
  error?: string | null
}

export function SearchSheet({
  isOpen,
  onClose,
  isConnected = true,
  onConnectClick,
  onSearch,
  searchResults = [],
  isLoading = false,
  error = null,
}: SearchSheetProps) {
  const [localQuery, setLocalQuery] = useState('')

  const handleSearch = (query: string) => {
    setLocalQuery(query)
    onSearch?.(query)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-neutral-900 border-b border-neutral-800">
        <h2 className="text-xl font-semibold text-white">Search Songs</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          aria-label="Close search"
        >
          <X size={24} className="text-neutral-400" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800">
        <SearchInput
          placeholder="Search for songs, artists, or albums..."
          onSearch={handleSearch}
          isLoading={isLoading}
          isConnected={isConnected}
          onConnectClick={onConnectClick}
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto bg-neutral-950">
        {error && (
          <div className="p-4 text-center text-red-400">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-4 text-neutral-400">Searching...</p>
          </div>
        )}

        {!isLoading && !error && searchResults.length === 0 && localQuery && (
          <div className="p-8 text-center text-neutral-400">
            No results found for "{localQuery}"
          </div>
        )}

        {!isLoading && !error && searchResults.length === 0 && !localQuery && (
          <div className="p-8 text-center text-neutral-500">
            <p className="text-lg mb-2">Start searching for music</p>
            <p className="text-sm">Try searching for your favorite artist or song</p>
          </div>
        )}

        {!isLoading && !error && searchResults.length > 0 && (
          <div className="divide-y divide-neutral-800">
            {searchResults.map((result) => (
              <div
                key={result.genius_id}
                className="p-4 hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {result.artwork_thumbnail ? (
                    <img
                      src={result.artwork_thumbnail}
                      alt={result.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-neutral-800 flex items-center justify-center">
                      <span className="text-neutral-600 text-2xl">🎵</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">
                      {result.title_with_featured || result.title}
                    </h3>
                    <p className="text-neutral-400 text-sm truncate">
                      {result.artist}
                    </p>
                    {result.lyrics_state && (
                      <p className="text-neutral-600 text-xs mt-1">
                        {result.lyrics_state}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
