import { type Component, Show } from 'solid-js'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/icons'
import { useTranslation } from '@/lib/i18n'

export type LineStatus = 'pending' | 'processing' | 'done' | 'error'

export interface LineResult {
  status: LineStatus
  score?: number // basis points (0-10000) or percentage (0-100)
  rating?: 'Easy' | 'Good' | 'Hard' | 'Again' | string
  transcript?: string
  expectedText?: string
  error?: string
}

export interface LineResultRowProps {
  lineIndex: number
  /** The expected text for this line */
  expectedText: string
  /** Current result state */
  result: LineResult
  /** Whether to show transcript comparison */
  showTranscript?: boolean
  class?: string
}

// 60% is passing threshold (Hard or better in FSRS terms)
const PASS_THRESHOLD = 60

function isPassing(result: LineResult): boolean {
  if (result.rating) {
    // Rating-based: Again = fail, everything else = pass
    return result.rating !== 'Again'
  }
  if (typeof result.score === 'number') {
    // Score-based: normalize from basis points if needed
    const score = result.score > 100 ? result.score / 100 : result.score
    return score >= PASS_THRESHOLD
  }
  return false
}

/**
 * Individual line result row for the karaoke completion page.
 * Shows status (pending, processing, done, error) with pass/fail indicator.
 */
export const LineResultRow: Component<LineResultRowProps> = (props) => {
  const { t } = useTranslation()
  const truncateText = (text: string, maxLength = 35) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  const passing = () => props.result.status === 'done' && isPassing(props.result)
  const failing = () => props.result.status === 'done' && !isPassing(props.result)

  return (
    <div
      class={cn(
        'flex items-center gap-2 py-3 px-4 rounded-xl transition-all duration-300',
        passing() && 'bg-emerald-400/10',
        failing() && 'bg-red-400/10',
        props.result.status === 'processing' && 'bg-blue-500/10',
        props.result.status === 'error' && 'bg-amber-500/10',
        props.result.status === 'pending' && 'bg-white/5',
        props.class
      )}
    >
      {/* Line number */}
      <span class="text-base text-muted-foreground font-mono w-5 shrink-0">
        {props.lineIndex + 1}
      </span>

      {/* Text content */}
      <div class="flex-1 min-w-0">
        <p class={cn(
          'text-base font-medium truncate',
          props.result.status === 'done' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {truncateText(props.expectedText)}
        </p>

        {/* Show transcript if available and different */}
        <Show when={props.showTranscript && props.result.transcript && props.result.status === 'done'}>
          <p class="text-base text-muted-foreground mt-1 truncate">
            {t('exercise.youSaid')} {truncateText(props.result.transcript || '')}
          </p>
        </Show>

        {/* Show error message */}
        <Show when={props.result.status === 'error' && props.result.error}>
          <p class="text-base text-amber-400 mt-1">
            {props.result.error}
          </p>
        </Show>
      </div>

      {/* Status indicator - right aligned */}
      <div class="shrink-0 w-8 flex justify-end">
        <Show when={props.result.status === 'pending'}>
          <span class="text-base text-muted-foreground">—</span>
        </Show>

        <Show when={props.result.status === 'processing'}>
          <div class="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full" />
        </Show>

        <Show when={props.result.status === 'done'}>
          <Show
            when={passing()}
            fallback={
              <Icon name="x-circle" class="text-2xl text-red-400" weight="fill" />
            }
          >
            <Icon name="check-circle" class="text-2xl text-emerald-400" weight="fill" />
          </Show>
        </Show>

        <Show when={props.result.status === 'error'}>
          <Icon name="warning" class="text-2xl text-amber-400" weight="fill" />
        </Show>
      </div>
    </div>
  )
}
