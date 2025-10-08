import { cn } from '@/lib/utils'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item'

export type LeaderboardEntry = {
  rank: number
  username: string
  score: number
  avatarUrl?: string
  isCurrentUser?: boolean
  onProfileClick?: () => void
}

export type LeaderboardProps = {
  entries: LeaderboardEntry[]
  currentUser?: LeaderboardEntry
  className?: string
}

// Minimalistic leaderboard: top 3 + current user as 4th slot
export function Leaderboard({
  entries,
  currentUser,
  className,
}: LeaderboardProps) {
  // Get top 3 entries
  const topThree = entries.slice(0, 3)

  // Display entries: top 3 + current user (if provided and not in top 3)
  const displayEntries = [...topThree]
  if (currentUser && !topThree.find(e => e.username === currentUser.username)) {
    displayEntries.push(currentUser)
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="space-y-0.5">
        {displayEntries.map((entry) => (
          <Item
            key={`${entry.rank}-${entry.username}`}
            variant="default"
            asChild
            className="gap-3 p-2 hover:bg-secondary/50 transition-colors"
          >
            <button onClick={entry.onProfileClick} className="w-full cursor-pointer">
              {/* Rank */}
              <div className="flex items-center justify-center w-6 flex-shrink-0">
                <span className="text-base font-semibold text-muted-foreground">
                  {entry.rank}
                </span>
              </div>

              {/* Avatar */}
              <ItemMedia variant="image" className="size-12 self-center translate-y-0">
                {entry.avatarUrl ? (
                  <img
                    src={entry.avatarUrl}
                    alt={entry.username}
                    className="w-full h-full rounded-sm object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-sm bg-gradient-to-br from-pink-400 to-purple-600" />
                )}
              </ItemMedia>

              {/* Username */}
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full truncate text-left text-base font-semibold">
                  {entry.username}
                </ItemTitle>
              </ItemContent>

              {/* Score */}
              <ItemActions>
                <div className="font-semibold text-muted-foreground text-base">
                  {entry.score.toLocaleString()}
                </div>
              </ItemActions>
            </button>
          </Item>
        ))}
      </div>
    </div>
  )
}
