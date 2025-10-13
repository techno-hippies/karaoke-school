import { SongItem } from '../ui/SongItem'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { StudyStats } from './StudyStats'
import { cn } from '@/lib/utils'

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
  /** Number of new cards */
  newCount: number
  /** Number of learning cards */
  learningCount: number
  /** Number of due cards */
  dueCount: number
  /** Called when a song is clicked */
  onSongClick?: (songId: string) => void
  /** Called when play button is clicked on a song */
  onPlayClick?: (songId: string) => void
  /** Called when Study button is clicked */
  onStudy?: () => void
  className?: string
}

export function ClassPage({
  studySongs,
  likedSongs,
  newCount,
  learningCount,
  dueCount,
  onSongClick,
  onPlayClick,
  onStudy,
  className,
}: ClassPageProps) {
  return (
    <div className={cn('relative w-full h-screen bg-background overflow-hidden flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-2xl">
        {/* Main content */}
        <ScrollArea className="absolute top-0 left-0 right-0 bottom-24">
          <div className="p-4 space-y-6">
            {/* Study Stats */}
            <StudyStats
              newCount={newCount}
              learningCount={learningCount}
              dueCount={dueCount}
            />

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
        </ScrollArea>

        {/* Sticky Footer with Study Button */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
          <Button
            size="lg"
            variant="default"
            onClick={onStudy}
            className="w-full"
            disabled={dueCount === 0}
          >
            Study
          </Button>
        </div>
      </div>
    </div>
  )
}
