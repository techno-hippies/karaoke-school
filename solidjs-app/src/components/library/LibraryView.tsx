/**
 * LibraryView - Horizontal scrolling song sections
 */

import { For, Show, type Component } from 'solid-js'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { SongTile } from '@/components/song/SongTile'

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
  showArtist?: boolean
}

export interface LibraryViewProps {
  sections: LibrarySection[]
  isLoading?: boolean
  onSongClick?: (song: LibrarySong) => void
}

const SongTileSkeleton: Component = () => (
  <div class="shrink-0 w-28 sm:w-32 md:w-36">
    <Skeleton class="aspect-square w-full rounded-2xl" />
    <Skeleton class="h-5 w-3/4 mt-2" />
    <Skeleton class="h-5 w-1/2 mt-1" />
  </div>
)

const SectionSkeleton: Component = () => (
  <div class="space-y-3">
    <Skeleton class="h-6 w-32 mx-4" />
    <div class="flex gap-2 sm:gap-3 px-4">
      <For each={[1, 2, 3, 4]}>{() => <SongTileSkeleton />}</For>
    </div>
  </div>
)

const LibrarySectionRow: Component<{
  section: LibrarySection
  onSongClick?: (song: LibrarySong) => void
}> = (props) => (
  <div class="space-y-3">
    <h2 class="text-lg font-semibold px-4">{props.section.title}</h2>
    <ScrollArea orientation="horizontal" hideScrollbar class="w-full">
      <div class="flex gap-2 sm:gap-3 px-4 pb-2">
        <For each={props.section.songs}>
          {(song) => (
            <SongTile
              title={song.title}
              artist={song.artist}
              artworkUrl={song.artworkUrl}
              showArtist={props.section.showArtist ?? true}
              onClick={() => props.onSongClick?.(song)}
            />
          )}
        </For>
      </div>
    </ScrollArea>
  </div>
)

export const LibraryView: Component<LibraryViewProps> = (props) => {
  return (
    <Show
      when={!props.isLoading}
      fallback={
        <div class="min-h-screen bg-background py-4">
          <div class="max-w-6xl mx-auto w-full space-y-6">
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        </div>
      }
    >
      <div class="min-h-screen bg-background py-4">
        <div class="max-w-6xl mx-auto w-full space-y-6">
          <For each={props.sections}>
            {(section) => (
              <LibrarySectionRow
                section={section}
                onSongClick={props.onSongClick}
              />
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}
