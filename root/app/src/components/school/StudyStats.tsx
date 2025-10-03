import { Book, Clock, Fire } from '@phosphor-icons/react'
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
    <div className={cn('flex items-center gap-4 md:gap-6', className)}>
      {/* New Cards */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20">
          <Book size={20} weight="duotone" className="text-blue-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg md:text-xl font-semibold text-foreground">
            {newCount}
          </span>
          <span className="text-xs text-muted-foreground">New</span>
        </div>
      </div>

      {/* Learning Cards */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20">
          <Clock size={20} weight="duotone" className="text-yellow-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg md:text-xl font-semibold text-foreground">
            {learningCount}
          </span>
          <span className="text-xs text-muted-foreground">Learning</span>
        </div>
      </div>

      {/* Due Cards */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20">
          <Fire size={20} weight="duotone" className="text-green-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg md:text-xl font-semibold text-foreground">
            {dueCount}
          </span>
          <span className="text-xs text-muted-foreground">Due</span>
        </div>
      </div>
    </div>
  )
}
