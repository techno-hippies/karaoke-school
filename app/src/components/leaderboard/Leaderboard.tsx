import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export interface LeaderboardEntry {
  rank: number
  username: string
  score: number
  avatarUrl?: string
  isCurrentUser?: boolean
}

export interface LeaderboardProps {
  entries: LeaderboardEntry[]
  currentUser?: LeaderboardEntry
  isLoading?: boolean
  emptyMessage?: string
  className?: string
}

/**
 * Reusable leaderboard component for displaying student rankings
 * Used by SongPage and ArtistPage
 */
export function Leaderboard({
  entries,
  currentUser,
  isLoading,
  emptyMessage,
  className,
}: LeaderboardProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (entries.length === 0 && !currentUser) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <p className="text-muted-foreground">
          {emptyMessage || t('song.noStudentsYet')}
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.username}
            className={cn(
              'flex items-center gap-4 px-5 py-4 rounded-2xl',
              entry.isCurrentUser ? 'bg-muted/50' : 'bg-muted/30'
            )}
          >
            <div className="w-10 text-center text-lg font-bold text-muted-foreground">
              #{entry.rank}
            </div>
            {entry.avatarUrl && (
              <img
                src={entry.avatarUrl}
                alt={entry.username}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <p className="flex-1 min-w-0 text-lg font-semibold truncate">
              {entry.username}
            </p>
            <p className="text-lg font-bold tabular-nums">
              {entry.score.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {currentUser && !entries.some((e) => e.isCurrentUser) && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-primary/10">
            <div className="w-10 text-center text-lg font-bold text-muted-foreground">
              #{currentUser.rank}
            </div>
            {currentUser.avatarUrl && (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.username}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <p className="flex-1 min-w-0 text-lg font-semibold truncate">
              {currentUser.username}
            </p>
            <p className="text-lg font-bold tabular-nums">
              {currentUser.score.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
