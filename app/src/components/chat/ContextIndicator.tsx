import { cn } from '@/lib/utils'

export interface ContextIndicatorProps {
  /** Current token count */
  tokensUsed: number
  /** Maximum tokens supported */
  maxTokens: number
  /** Optional className for custom styling */
  className?: string
}

/**
 * ContextIndicator - Shows a circular progress indicator for LLM context window usage
 *
 * Displays a circle that fills up as the context window fills, with percentage label
 * On hover, shows "Context usage: X%"
 */
export function ContextIndicator({
  tokensUsed,
  maxTokens,
  className,
}: ContextIndicatorProps) {
  const percentage = Math.min(100, Math.round((tokensUsed / maxTokens) * 100))
  const circumference = 2 * Math.PI * 8 // radius = 8
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div
      className={cn('flex items-center gap-1.5 group', className)}
      title={`Context usage: ${percentage}%`}
    >
      {/* Circle progress */}
      <svg
        className="transform -rotate-90"
        width="20"
        height="20"
        viewBox="0 0 20 20"
      >
        {/* Background circle */}
        <circle
          cx="10"
          cy="10"
          r="8"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="text-muted-foreground/20"
        />
        {/* Progress circle */}
        <circle
          cx="10"
          cy="10"
          r="8"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            'transition-all duration-300',
            percentage < 70 ? 'text-muted-foreground' : '',
            percentage >= 70 && percentage < 90 ? 'text-yellow-500' : '',
            percentage >= 90 ? 'text-red-500' : ''
          )}
        />
      </svg>

      {/* Percentage label */}
      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
        {percentage}%
      </span>
    </div>
  )
}
