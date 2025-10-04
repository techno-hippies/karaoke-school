import { cn } from '@/lib/utils'

export interface ProfileStatsProps {
  following: number
  followers: number
  className?: string
}

/**
 * ProfileStats - Following and followers counts
 * Auto-responsive: horizontal on mobile (centered), horizontal on desktop (left-aligned)
 */
export function ProfileStats({
  following,
  followers,
  className
}: ProfileStatsProps) {
  // Format numbers with K/M suffixes
  const formatNumber = (num: number): string => {
    if (!num && num !== 0) return '0'
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  return (
    <div className={cn(
      'flex gap-6 mb-4 text-base md:text-lg justify-center md:justify-start',
      className
    )}>
      <div className="flex items-center gap-2">
        <span className="font-bold text-white">
          {formatNumber(following)}
        </span>
        <span className="text-neutral-400">Following</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-white">
          {formatNumber(followers)}
        </span>
        <span className="text-neutral-400">Followers</span>
      </div>
    </div>
  )
}
