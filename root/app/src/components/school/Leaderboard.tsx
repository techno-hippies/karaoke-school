import { cn } from '@/lib/utils'

export type LeaderboardEntry = {
  rank: number
  username: string
  score: number
  avatarUrl?: string
  isCurrentUser?: boolean
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
        {displayEntries.map((entry, index) => (
          <div
            key={`${entry.rank}-${entry.username}`}
            className="flex items-center gap-3 py-2 pr-3 rounded-lg bg-neutral-900/50 transition-colors"
          >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-400 to-purple-600 flex-shrink-0">
              {entry.avatarUrl ? (
                <img
                  src={entry.avatarUrl}
                  alt={entry.username}
                  className="w-full h-full rounded-lg object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-lg bg-neutral-700" />
              )}
            </div>

            {/* Username */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">
                {entry.username}
              </p>
            </div>

            {/* Score */}
            <div className="font-semibold text-neutral-300">
              {entry.score.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
