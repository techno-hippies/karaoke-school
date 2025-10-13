import { cn } from '@/lib/utils'

export interface StudyStatsProps {
  /** Number of new cards never studied */
  newCount: number
  /** Number of cards currently in learning phase */
  learningCount: number
  /** Number of cards due for review */
  dueCount: number
  /** Optional className for additional styling */
  className?: string
}

export function StudyStats({
  newCount,
  learningCount,
  dueCount,
  className,
}: StudyStatsProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Stats row */}
      <div className="bg-neutral-900/30 rounded-lg border border-neutral-800/50 flex relative">
        <div className="flex-1 p-3 md:p-4 text-center">
          <div className="text-xl md:text-2xl font-bold text-neutral-300">
            {newCount}
          </div>
          <div className="text-neutral-500 text-base font-medium mt-1">
            New
          </div>
        </div>

        {/* First divider */}
        <div className="absolute left-1/3 top-1/2 -translate-y-1/2 w-px h-1/2 bg-neutral-800/50" />

        <div className="flex-1 p-3 md:p-4 text-center">
          <div className="text-xl md:text-2xl font-bold text-neutral-300">
            {learningCount}
          </div>
          <div className="text-neutral-500 text-base font-medium mt-1">
            Learning
          </div>
        </div>

        {/* Second divider */}
        <div className="absolute left-2/3 top-1/2 -translate-y-1/2 w-px h-1/2 bg-neutral-800/50" />

        <div className="flex-1 p-3 md:p-4 text-center">
          <div
            className={cn(
              'text-xl md:text-2xl font-bold',
              dueCount > 0 ? 'text-red-400' : 'text-neutral-400'
            )}
          >
            {dueCount}
          </div>
          <div className="text-neutral-500 text-base font-medium mt-1">
            Due
          </div>
        </div>
      </div>
    </div>
  )
}
