/**
 * SongItem - Reusable list item for songs
 * Pure presentational component - no business logic
 */

import { Show, type Component } from 'solid-js'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { MusicNote } from '@/components/icons'
import { cn } from '@/lib/utils'

export interface SongItemProps {
  /** Song title */
  title: string
  /** Artist name */
  artist: string
  /** Optional album art URL */
  artworkUrl?: string
  /** Called when the entire row is clicked */
  onClick?: () => void
  /** Optional rank number to show on the left */
  rank?: number
  /** Optional badge (e.g., due count) to show on the right */
  badge?: number
  /** Optional className for additional styling */
  class?: string
}

export const SongItem: Component<SongItemProps> = (props) => {
  return (
    <Item
      class={cn('gap-3 p-2 cursor-pointer hover:bg-secondary/50 transition-colors', props.class)}
      onClick={props.onClick}
    >
      {/* Rank */}
      <Show when={props.rank !== undefined}>
        <div class="flex items-center justify-center w-6 flex-shrink-0">
          <span class="text-base font-semibold text-muted-foreground">
            {props.rank}
          </span>
        </div>
      </Show>

      <ItemMedia variant="image" class="size-12 self-center">
        <Show
          when={props.artworkUrl}
          fallback={
            <div class="w-full h-full rounded-lg bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center">
              <MusicNote class="w-6 h-6 text-foreground/80" weight="fill" />
            </div>
          }
        >
          <img
            src={props.artworkUrl}
            alt={`${props.title} artwork`}
            class="w-full h-full object-cover rounded-lg"
          />
        </Show>
      </ItemMedia>

      <ItemContent class="min-w-0 gap-0.5 flex-1">
        <ItemTitle class="w-full truncate text-left">{props.title}</ItemTitle>
        <ItemDescription class="w-full truncate text-left line-clamp-1">
          {props.artist}
        </ItemDescription>
      </ItemContent>

      {/* Badge (e.g., due count) */}
      <Show when={props.badge !== undefined}>
        <div class="flex items-center justify-center flex-shrink-0 pr-2">
          <span class="text-lg font-bold text-red-500">
            {props.badge}
          </span>
        </div>
      </Show>
    </Item>
  )
}
