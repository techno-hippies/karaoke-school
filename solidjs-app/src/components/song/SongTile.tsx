/**
 * SongTile - Square tile for horizontal scroll sections
 * Used in LibraryView for "Trending", "By Artist" sections
 */

import { Show, type Component } from 'solid-js'
import { cn } from '@/lib/utils'

export interface SongTileProps {
  /** Song title */
  title: string
  /** Artist name */
  artist?: string
  /** Album artwork URL */
  artworkUrl?: string
  /** Show artist name below title */
  showArtist?: boolean
  /** Called when tile is clicked */
  onClick?: () => void
  /** Optional className */
  class?: string
}

export const SongTile: Component<SongTileProps> = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class={cn(
        'shrink-0 w-28 sm:w-32 md:w-36 text-left cursor-pointer group',
        props.class
      )}
    >
      <div class="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        <Show
          when={props.artworkUrl}
          fallback={
            <div class="w-full h-full bg-gradient-to-br from-pink-400 to-purple-600" />
          }
        >
          <img
            src={props.artworkUrl}
            alt=""
            class="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        </Show>
      </div>
      <p class="mt-2 text-base font-semibold truncate">{props.title}</p>
      <Show when={props.showArtist !== false && props.artist}>
        <p class="text-base text-muted-foreground truncate">{props.artist}</p>
      </Show>
    </button>
  )
}
