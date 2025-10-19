/**
 * StudentLeaderboard Component
 *
 * Displays student leaderboard for a song using data from:
 * 1. KaraokeCatalogV2 contract (leaderboard URI)
 * 2. Grove storage (leaderboard JSON data)
 *
 * Data is populated by a background indexer that listens for SongUnlocked events.
 *
 * Features:
 * - Shows all students who have practiced this song
 * - Displays completion percentage and timestamp
 * - Shows Lens profile data (username, avatar) if available
 * - Handles loading, empty, and error states
 */

import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useStudentLeaderboard } from '@/hooks/useStudentLeaderboard'
import { Leaderboard, type LeaderboardEntry } from './Leaderboard'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface StudentLeaderboardProps {
  geniusId: number | undefined
  className?: string
  onProfileClick?: (address: string) => void
}

/**
 * StudentLeaderboard: Fetches and displays student leaderboard from Grove storage
 */
export function StudentLeaderboard({
  geniusId,
  className,
  onProfileClick,
}: StudentLeaderboardProps) {
  const { address: userAddress } = useAccount()
  const { leaderboard, isLoading, error, hasData } = useStudentLeaderboard(geniusId)

  // Transform StudentScore[] to LeaderboardEntry[]
  const leaderboardEntries = useMemo<LeaderboardEntry[]>(() => {
    if (!leaderboard) return []

    return leaderboard.students
      .sort((a, b) => {
        // Sort by completion percentage (descending), then by unlock time (ascending)
        if (b.completionPercentage !== a.completionPercentage) {
          return b.completionPercentage - a.completionPercentage
        }
        return a.unlockedAt - b.unlockedAt
      })
      .map((student, index) => ({
        rank: index + 1,
        username: student.lensUsername || `${student.address.slice(0, 6)}...${student.address.slice(-4)}`,
        score: student.completionPercentage,
        avatarUrl: student.lensAvatar,
        isCurrentUser: userAddress?.toLowerCase() === student.address.toLowerCase(),
        onProfileClick: onProfileClick ? () => onProfileClick(student.address) : undefined,
      }))
  }, [leaderboard, userAddress, onProfileClick])

  // Find current user entry
  const currentUserEntry = useMemo<LeaderboardEntry | undefined>(() => {
    if (!userAddress) return undefined
    return leaderboardEntries.find(entry => entry.isCurrentUser)
  }, [leaderboardEntries, userAddress])

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <div className="space-y-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="w-12 h-12 rounded-sm" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('w-full', className)}>
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="text-destructive mb-2">❌</div>
          <p className="text-sm text-muted-foreground">
            Failed to load leaderboard
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {error.message || 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  // Empty state - no students yet
  if (!hasData || leaderboardEntries.length === 0) {
    return (
      <div className={cn('w-full', className)}>
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="text-4xl mb-3">🎤</div>
          <h3 className="text-lg font-semibold mb-2">No Students Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Be the first to practice this song! Unlock it to appear on the leaderboard.
          </p>
        </div>
      </div>
    )
  }

  // Display leaderboard
  return (
    <div className={cn('w-full', className)}>
      <Leaderboard
        entries={leaderboardEntries}
        currentUser={currentUserEntry}
      />
    </div>
  )
}

/**
 * StudentLeaderboardSkeleton: Loading state for StudentLeaderboard
 */
export function StudentLeaderboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    </div>
  )
}
