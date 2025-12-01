import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface LibrarySong {
  id: string
  title: string
  artist: string
  artworkUrl?: string
}

export interface LibrarySection {
  id: string
  title: string
  songs: LibrarySong[]
  /** Show artist name on each tile (default: true for mixed sections like Trending) */
  showArtist?: boolean
}

export interface LibraryViewProps {
  sections: LibrarySection[]
  isLoading?: boolean
  onSongClick?: (song: LibrarySong) => void
}

function SongTile({
  song,
  onClick,
  showArtist = true,
}: {
  song: LibrarySong
  onClick?: () => void
  showArtist?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 w-28 sm:w-32 md:w-36 text-left cursor-pointer group"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        {song.artworkUrl ? (
          <img
            src={song.artworkUrl}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-600" />
        )}
      </div>
      <p className="mt-2 text-base font-semibold truncate">{song.title}</p>
      {showArtist && (
        <p className="text-base text-muted-foreground truncate">{song.artist}</p>
      )}
    </button>
  )
}

function SongTileSkeleton() {
  return (
    <div className="shrink-0 w-28 sm:w-32 md:w-36">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <Skeleton className="h-5 w-3/4 mt-2" />
      <Skeleton className="h-5 w-1/2 mt-1" />
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-32 mx-4" />
      <div className="flex gap-2 sm:gap-3 px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SongTileSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function LibrarySectionRow({
  section,
  onSongClick,
}: {
  section: LibrarySection
  onSongClick?: (song: LibrarySong) => void
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold px-4">{section.title}</h2>
      <ScrollArea className="w-full">
        <div className="flex gap-2 sm:gap-3 px-4 pb-2">
          {section.songs.map((song) => (
            <SongTile
              key={song.id}
              song={song}
              onClick={() => onSongClick?.(song)}
              showArtist={section.showArtist ?? true}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}

export function LibraryView({
  sections,
  isLoading = false,
  onSongClick,
}: LibraryViewProps) {
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-4">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-4">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {sections.map((section) => (
          <LibrarySectionRow
            key={section.id}
            section={section}
            onSongClick={onSongClick}
          />
        ))}
      </div>
    </div>
  )
}
