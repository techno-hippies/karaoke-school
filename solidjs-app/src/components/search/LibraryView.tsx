/**
 * LibraryView Component
 *
 * Displays songs organized into horizontal scrolling sections
 * (e.g., by artist, trending, etc.)
 */

import { Component, For, Show, splitProps } from 'solid-js'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

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
  class?: string
}

// ============================================================
// Song Tile
// ============================================================

interface SongTileProps {
  song: LibrarySong
  onClick?: () => void
  showArtist?: boolean
}

const SongTile: Component<SongTileProps> = (props) => {
  return (
    <button
      onClick={props.onClick}
      class="shrink-0 w-28 sm:w-32 md:w-36 text-left cursor-pointer group"
    >
      <div class="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        <Show
          when={props.song.artworkUrl}
          fallback={
            <div class="w-full h-full bg-gradient-to-br from-pink-400 to-purple-600" />
          }
        >
          <img
            src={props.song.artworkUrl}
            alt=""
            class="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        </Show>
      </div>
      <p class="mt-2 text-base font-semibold truncate">{props.song.title}</p>
      <Show when={props.showArtist ?? true}>
        <p class="text-base text-muted-foreground truncate">{props.song.artist}</p>
      </Show>
    </button>
  )
}

// ============================================================
// Skeletons
// ============================================================

const SongTileSkeleton: Component = () => {
  return (
    <div class="shrink-0 w-28 sm:w-32 md:w-36">
      <Skeleton class="aspect-square w-full rounded-2xl" />
      <Skeleton class="h-5 w-3/4 mt-2" />
      <Skeleton class="h-5 w-1/2 mt-1" />
    </div>
  )
}

const SectionSkeleton: Component = () => {
  return (
    <div class="space-y-3">
      <Skeleton class="h-6 w-32 mx-4" />
      <div class="flex gap-2 sm:gap-3 px-4">
        <For each={[1, 2, 3, 4]}>{() => <SongTileSkeleton />}</For>
      </div>
    </div>
  )
}

// ============================================================
// Section Row
// ============================================================

interface SectionRowProps {
  section: LibrarySection
  onSongClick?: (song: LibrarySong) => void
}

const LibrarySectionRow: Component<SectionRowProps> = (props) => {
  return (
    <div class="space-y-3">
      <h2 class="text-lg font-semibold px-4">{props.section.title}</h2>
      <div class="w-full overflow-x-auto scrollbar-hide">
        <div class="flex gap-2 sm:gap-3 px-4 pb-2">
          <For each={props.section.songs}>
            {(song) => (
              <SongTile
                song={song}
                onClick={() => props.onSongClick?.(song)}
                showArtist={props.section.showArtist ?? true}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export const LibraryView: Component<LibraryViewProps> = (props) => {
  const [local, others] = splitProps(props, ['sections', 'isLoading', 'onSongClick', 'class'])

  return (
    <Show
      when={!local.isLoading}
      fallback={
        <div class={cn('min-h-screen bg-background py-4', local.class)} {...others}>
          <div class="max-w-6xl mx-auto w-full space-y-6">
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        </div>
      }
    >
      <div class={cn('min-h-screen bg-background py-4', local.class)} {...others}>
        <div class="max-w-6xl mx-auto w-full space-y-6">
          <For each={local.sections}>
            {(section) => (
              <LibrarySectionRow
                section={section}
                onSongClick={local.onSongClick}
              />
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}

export default LibraryView
