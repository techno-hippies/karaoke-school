import { ArrowRight, Flag } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface NavigationControlsProps {
  /** Callback when next button is clicked */
  onNext: () => void
  /** Callback when report button is clicked */
  onReport?: (reason: string) => void
  /** Whether the next button is disabled */
  disabled?: boolean
  /** Label for the next button */
  label?: string
  /** Exercise key for reporting (required if onReport is provided) */
  exerciseKey?: string
  /** Custom className */
  className?: string
}

export function NavigationControls({
  onNext,
  onReport,
  disabled = false,
  label = 'Next',
  exerciseKey,
  className,
}: NavigationControlsProps) {
  const [showReportMenu, setShowReportMenu] = useState(false)

  const reportReasons = [
    { id: 'incorrect_answer', label: 'Incorrect answer' },
    { id: 'unclear_question', label: 'Unclear question' },
    { id: 'technical_issue', label: 'Technical issue' },
    { id: 'inappropriate_content', label: 'Inappropriate content' },
    { id: 'other', label: 'Other' },
  ]

  const handleReport = (reason: string) => {
    if (onReport && exerciseKey) {
      onReport(reason)
      setShowReportMenu(false)
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {showReportMenu ? (
        // Report menu
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-3">
            What's wrong with this exercise?
          </div>
          {reportReasons.map((reason) => (
            <button
              key={reason.id}
              onClick={() => handleReport(reason.id)}
              className="w-full p-3 text-left bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors text-sm"
            >
              {reason.label}
            </button>
          ))}
          <button
            onClick={() => setShowReportMenu(false)}
            className="w-full p-3 text-center text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      ) : (
        // Navigation buttons
        <div className="flex gap-3">
          {onReport && exerciseKey && (
            <Button
              onClick={() => setShowReportMenu(true)}
              variant="outline"
              size="lg"
              className="h-12"
              aria-label="Report issue"
            >
              <Flag size={20} weight="bold" />
            </Button>
          )}

          <Button
            onClick={onNext}
            disabled={disabled}
            size="lg"
            className="flex-1 h-12"
          >
            {label}
            <ArrowRight size={20} weight="bold" />
          </Button>
        </div>
      )}
    </div>
  )
}
