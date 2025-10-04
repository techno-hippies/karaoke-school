import React, { useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { Input } from './input'

interface SearchInputProps {
  placeholder?: string
  onSearch: (query: string) => void
  isLoading?: boolean
  className?: string
  onFocus?: () => void
  autoFocus?: boolean
  isConnected?: boolean
  onConnectClick?: () => void
}

export function SearchInput({
  placeholder = "Search for songs...",
  onSearch,
  isLoading = false,
  className = "",
  onFocus,
  autoFocus = false,
  isConnected = true,
  onConnectClick,
}: SearchInputProps) {
  const [query, setQuery] = useState('')

  const handleSearch = () => {
    if (query.trim() && !isLoading && isConnected) {
      onSearch(query.trim())
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleInputClick = () => {
    if (!isConnected && onConnectClick) {
      onConnectClick()
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Input
        type="text"
        placeholder={!isConnected ? 'Connect wallet to search' : placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        onFocus={onFocus}
        onClick={handleInputClick}
        disabled={isLoading || !isConnected}
        className="flex-1 h-14 text-base px-4 text-neutral-200 placeholder:text-neutral-500 bg-neutral-900/80 dark:bg-neutral-900/80 border-neutral-800 dark:border-neutral-800 focus-visible:border-neutral-700 dark:focus-visible:border-neutral-700 focus-visible:ring-0"
        autoFocus={autoFocus}
      />
      <button
        onClick={handleSearch}
        disabled={!query.trim() || isLoading || !isConnected}
        aria-label="Search"
        className="h-14 w-14 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center justify-center transition-colors"
      >
        <MagnifyingGlass size={24} weight="bold" className="text-neutral-100" />
      </button>
    </div>
  )
}
