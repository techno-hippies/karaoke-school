import { type Component, createSignal, Show, For } from 'solid-js'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

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
  class?: string
}

export const NavigationControls: Component<NavigationControlsProps> = (props) => {
  const { t } = useTranslation()
  const [showReportMenu, setShowReportMenu] = createSignal(false)
  const displayLabel = () => props.label || t('exercise.next')

  const reportReasons = [
    { id: 'incorrect_answer', label: 'Incorrect answer' },
    { id: 'unclear_question', label: 'Unclear question' },
    { id: 'technical_issue', label: 'Technical issue' },
    { id: 'inappropriate_content', label: 'Inappropriate content' },
    { id: 'other', label: 'Other' },
  ]

  const handleReport = (reason: string) => {
    if (props.onReport && props.exerciseKey) {
      props.onReport(reason)
      setShowReportMenu(false)
    }
  }

  return (
    <div class={cn('w-full', props.class)}>
      <Show
        when={!showReportMenu()}
        fallback={
          // Report menu
          <div class="space-y-2">
            <div class="text-base text-muted-foreground mb-3">
              What's wrong?
            </div>
            <For each={reportReasons}>
              {(reason) => (
                <button
                  onClick={() => handleReport(reason.id)}
                  class="w-full p-3 text-left bg-secondary hover:bg-secondary/90 text-foreground rounded-lg transition-colors text-base"
                >
                  {reason.label}
                </button>
              )}
            </For>
            <button
              onClick={() => setShowReportMenu(false)}
              class="w-full p-3 text-center text-muted-foreground hover:text-foreground transition-colors text-base"
            >
              Cancel
            </button>
          </div>
        }
      >
        {/* Navigation buttons */}
        <div class="flex gap-3">
          <Show when={props.onReport && props.exerciseKey}>
            <Button
              onClick={() => setShowReportMenu(true)}
              variant="outline"
              size="lg"
              class="h-12"
              aria-label="Report issue"
            >
              {/* Flag icon */}
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 256 256">
                <path d="M42.76,50A8,8,0,0,0,32,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,16.4,8.11,34.06,16.85,53,16.85,13.93,0,28.54-4.75,43.82-18a8,8,0,0,0,2.76-6V56a8,8,0,0,0-12.76-6.4c-26.79,21.16-49.87,9.75-76.45-3.41C88.79,30.06,46.47,11.65,42.76,50ZM48,183.72V68.29c26.79-21.16,49.87-9.75,76.45,3.41,23.24,11.5,48.35,24,75.55,12.74V99.56a82.63,82.63,0,0,0-10.69,3.38c-20.26,8.45-42.19,2.8-64-3.09-21.47-5.8-43.65-11.79-67.31-2.29V183.72Z" />
              </svg>
            </Button>
          </Show>

          <Button
            onClick={props.onNext}
            disabled={props.disabled}
            size="lg"
            class="flex-1 h-12"
          >
            {displayLabel()}
            {/* Arrow right icon */}
            <svg class="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 256 256">
              <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69l-58.35-58.34a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
            </svg>
          </Button>
        </div>
      </Show>
    </div>
  )
}
