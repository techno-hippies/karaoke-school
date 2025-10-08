import { MagnifyingGlass } from '@phosphor-icons/react'
import { SongItem } from '../ui/SongItem'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '../ui/input-group'

export interface ClassSong {
  id: string
  title: string
  artist: string
  artworkUrl?: string
  isNative?: boolean
}

export interface ClassPageProps {
  /** List of songs being studied */
  studySongs: ClassSong[]
  /** List of liked songs */
  likedSongs: ClassSong[]
  /** Search query */
  searchQuery?: string
  /** Called when search query changes */
  onSearchChange?: (query: string) => void
  /** Called when a song is clicked */
  onSongClick?: (songId: string) => void
  /** Called when play button is clicked on a song */
  onPlayClick?: (songId: string) => void
}

export function ClassPage({
  studySongs,
  likedSongs,
  searchQuery = '',
  onSearchChange,
  onSongClick,
  onPlayClick,
}: ClassPageProps) {
  return (
    <div className="w-full max-w-3xl mx-auto p-4 space-y-6">
      {/* Search Bar */}
      <InputGroup>
        <InputGroupInput
          type="text"
          placeholder="Search songs..."
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
        <InputGroupAddon>
          <MagnifyingGlass />
        </InputGroupAddon>
      </InputGroup>

      {/* Your Songs Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Your Songs</h2>
        <div className="space-y-2">
          {studySongs.map((song) => (
            <SongItem
              key={song.id}
              title={song.title}
              artist={song.artist}
              artworkUrl={song.artworkUrl}
              showPlayButton={song.isNative}
              onPlayClick={() => onPlayClick?.(song.id)}
              onClick={() => onSongClick?.(song.id)}
            />
          ))}
        </div>
      </div>

      {/* Liked Songs Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Liked Songs</h2>
        <div className="space-y-2">
          {likedSongs.map((song) => (
            <SongItem
              key={song.id}
              title={song.title}
              artist={song.artist}
              artworkUrl={song.artworkUrl}
              showPlayButton={song.isNative}
              onPlayClick={() => onPlayClick?.(song.id)}
              onClick={() => onSongClick?.(song.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
