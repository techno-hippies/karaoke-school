import { ArrowRight, Flag } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  label,
  exerciseKey,
  className,
}: NavigationControlsProps) {
  const { t } = useTranslation()
  const [showReportMenu, setShowReportMenu] = useState(false)
  const displayLabel = label || t('study.next')

  const reportReasons = [
    { id: 'incorrect_answer', label: t('study.incorrectAnswer') },
    { id: 'unclear_question', label: t('study.unclearQuestion') },
    { id: 'technical_issue', label: t('study.technicalIssue') },
    { id: 'inappropriate_content', label: t('study.inappropriateContent') },
    { id: 'other', label: t('study.other') },
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
          <div className="text-base text-muted-foreground mb-3">
            {t('study.whatsWrong')}
          </div>
          {reportReasons.map((reason) => (
            <button
              key={reason.id}
              onClick={() => handleReport(reason.id)}
              className="w-full p-3 text-left bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors text-base"
            >
              {reason.label}
            </button>
          ))}
          <button
            onClick={() => setShowReportMenu(false)}
            className="w-full p-3 text-center text-muted-foreground hover:text-foreground transition-colors text-base"
          >
            {t('common.cancel')}
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
              aria-label={t('study.reportIssue')}
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
            {displayLabel}
            <ArrowRight size={20} weight="bold" />
          </Button>
        </div>
      )}
    </div>
  )
}
