import { Button } from '@/components/ui/button'
import { AvatarWithSkeleton } from '@/components/ui/avatar-with-skeleton'
import { cn } from '@/lib/utils'

export interface SurveyOption {
  id: string
  label: string
}

export interface ChatSurveyMessageProps {
  /** Question text */
  question: string
  /** Available options */
  options: SurveyOption[]
  /** Called when an option is selected */
  onSelect?: (option: SurveyOption) => void
  /** Currently selected option (if any) */
  selectedId?: string
  /** Disable selection (after answered) */
  disabled?: boolean
  /** Avatar URL */
  avatarUrl?: string
  className?: string
}

/**
 * ChatSurveyMessage - Onboarding-style survey question with clickable options
 *
 * Used for soft onboarding flow:
 * - Favorite musicians
 * - Favorite anime
 * - Age range
 * etc.
 */
export function ChatSurveyMessage({
  question,
  options,
  onSelect,
  selectedId,
  disabled = false,
  avatarUrl,
  className,
}: ChatSurveyMessageProps) {
  return (
    <div className={cn('flex gap-3 w-full justify-start', className)}>
      {/* AI Avatar */}
      <AvatarWithSkeleton src={avatarUrl} alt="AI" size="sm" />

      {/* Question and options */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Question bubble */}
        <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-secondary text-secondary-foreground text-base leading-relaxed w-fit max-w-[85%]">
          {question}
        </div>

        {/* Options - stacked vertically, fixed width */}
        <div className="mt-3 flex flex-col gap-2 w-64 md:w-72">
          {options.map((option) => {
            const isSelected = selectedId === option.id
            return (
              <Button
                key={option.id}
                variant={isSelected ? 'default' : 'outline'}
                size="default"
                onClick={() => !disabled && onSelect?.(option)}
                disabled={disabled && !isSelected}
                className={cn(
                  'w-full justify-start',
                  disabled && !isSelected && 'opacity-40'
                )}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
