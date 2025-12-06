/**
 * Leaderboard - Reusable leaderboard component for displaying student rankings
 * SolidJS implementation
 */

import { type Component, Show, For } from 'solid-js'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/lib/i18n'
import { Icon } from '@/components/icons'

// Use the shared display type
export type { LeaderboardDisplayEntry as LeaderboardEntry } from '@/types/leaderboard'
import type { LeaderboardDisplayEntry } from '@/types/leaderboard'

type LeaderboardEntry = LeaderboardDisplayEntry

export interface LeaderboardProps {
  entries: LeaderboardEntry[]
  currentUser?: LeaderboardEntry
  isLoading?: boolean
  emptyMessage?: string
  class?: string
  showTitle?: boolean
  /** Called when a user entry is clicked */
  onUserClick?: (entry: LeaderboardEntry) => void
}

/**
 * Reusable leaderboard component for displaying student rankings
 * Used by SongPage and ArtistPage
 */
export const Leaderboard: Component<LeaderboardProps> = (props) => {
  const { t } = useTranslation()

  return (
    <>
      {/* Loading state */}
      <Show when={props.isLoading}>
        <div class={cn('flex items-center justify-center py-12', props.class)}>
          <Spinner size="lg" />
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!props.isLoading && props.entries.length === 0 && !props.currentUser}>
        <div class={cn('flex flex-col items-center justify-center py-12 text-center', props.class)}>
          {/* Title with crown icon */}
          <Show when={props.showTitle !== false}>
            <div class="flex items-center gap-2 mb-6">
              <Icon name="crown-cross" weight="fill" class="text-2xl text-yellow-500" />
              <h2 class="text-xl font-bold">{t('leaderboard.rankings')}</h2>
            </div>
          </Show>
          <p class="text-muted-foreground">
            {props.emptyMessage || 'No students yet. Be the first to practice!'}
          </p>
        </div>
      </Show>

      {/* Leaderboard list */}
      <Show when={!props.isLoading && (props.entries.length > 0 || props.currentUser)}>
        <div class={props.class}>
          {/* Title with crown icon */}
          <Show when={props.showTitle !== false}>
            <div class="flex items-center gap-2 mb-4">
              <Icon name="crown-cross" weight="fill" class="text-2xl text-yellow-500" />
              <h2 class="text-xl font-bold">{t('leaderboard.rankings')}</h2>
            </div>
          </Show>
          <div class="space-y-2">
            <For each={props.entries}>
              {(entry) => {
                const isClickable = () => props.onUserClick && (entry.handle || entry.username)
                const handleClick = () => {
                  if (isClickable()) {
                    props.onUserClick?.(entry)
                  }
                }

                return (
                  <div
                    class={cn(
                      'flex items-center gap-4 px-5 py-4 rounded-2xl',
                      entry.isCurrentUser ? 'bg-muted/50' : 'bg-muted/30',
                      isClickable() && 'cursor-pointer hover:bg-muted/60 transition-colors'
                    )}
                    onClick={handleClick}
                  >
                    <div class="w-10 text-center text-lg font-bold text-muted-foreground">
                      #{entry.rank}
                    </div>
                    <Show when={entry.avatarUrl}>
                      <img
                        src={entry.avatarUrl}
                        alt={entry.username}
                        class="w-12 h-12 rounded-full object-cover"
                      />
                    </Show>
                    <p class="flex-1 min-w-0 text-lg font-semibold truncate">
                      {entry.username}
                    </p>
                    <p class="text-lg font-bold tabular-nums">
                      {entry.score.toLocaleString()}
                    </p>
                  </div>
                )
              }}
            </For>
          </div>

          {/* Current user (if not in top 10) */}
          <Show when={props.currentUser && !props.entries.some((e) => e.isCurrentUser)}>
            {(() => {
              const currentUserEntry = props.currentUser!
              const isClickable = () => props.onUserClick && (currentUserEntry.handle || currentUserEntry.username)
              const handleClick = () => {
                if (isClickable()) {
                  props.onUserClick?.(currentUserEntry)
                }
              }

              return (
                <div class="mt-4 pt-4 border-t border-border">
                  <div
                    class={cn(
                      'flex items-center gap-4 px-5 py-4 rounded-2xl bg-primary/10',
                      isClickable() && 'cursor-pointer hover:bg-primary/20 transition-colors'
                    )}
                    onClick={handleClick}
                  >
                    <div class="w-10 text-center text-lg font-bold text-muted-foreground">
                      #{currentUserEntry.rank}
                    </div>
                    <Show when={currentUserEntry.avatarUrl}>
                      <img
                        src={currentUserEntry.avatarUrl}
                        alt={currentUserEntry.username}
                        class="w-12 h-12 rounded-full object-cover"
                      />
                    </Show>
                    <p class="flex-1 min-w-0 text-lg font-semibold truncate">
                      {currentUserEntry.username}
                    </p>
                    <p class="text-lg font-bold tabular-nums">
                      {currentUserEntry.score.toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })()}
          </Show>
        </div>
      </Show>
    </>
  )
}
