import { type Component, Show, For, createMemo } from 'solid-js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icons'
import { BackButton } from '@/components/ui/back-button'
import { useTranslation } from '@/lib/i18n'
import { LineResultRow, type LineResult } from './LineResultRow'
import { GradeSlotMachine, type PracticeGrade } from './GradeSlotMachine'

export type { PracticeGrade } from './GradeSlotMachine'

export interface KaraokeResultsPageProps {
  /** Session ID for reference */
  sessionId?: string
  /** Per-line results (reactive - updates as grades come in) */
  lineResults: LineResult[]
  /** Expected text for each line */
  expectedTexts: string[]
  /** Callback when user wants to play again */
  onPlayAgain?: () => void
  /** Callback when user wants to close/go back */
  onClose?: () => void
  class?: string
}

function scoreToGrade(score: number): PracticeGrade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

/**
 * Karaoke results/completion page.
 * Shows final grade, line-by-line results, and allows replay.
 *
 * Key feature: Line results update in real-time as grades come in,
 * so the user sees progress even if some lines are still being graded.
 */
export const KaraokeResultsPage: Component<KaraokeResultsPageProps> = (props) => {
  const { t } = useTranslation()

  // Compute stats from line results
  const stats = createMemo(() => {
    const results = props.lineResults
    const completed = results.filter(r => r.status === 'done')
    const processing = results.filter(r => r.status === 'processing')
    const errors = results.filter(r => r.status === 'error')
    const pending = results.filter(r => r.status === 'pending')

    const scores = completed
      .filter(r => typeof r.score === 'number')
      .map(r => r.score as number)

    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null

    return {
      total: results.length,
      completed: completed.length,
      processing: processing.length,
      errors: errors.length,
      pending: pending.length,
      averageScore,
      allDone: processing.length === 0 && pending.length === 0,
    }
  })

  const grade = createMemo(() => {
    const avg = stats().averageScore
    if (avg === null) return null
    return scoreToGrade(avg)
  })

  const isStillGrading = createMemo(() => stats().processing > 0 || stats().pending > 0)

  // Sort results: pending/processing first, then graded in original order
  const sortedResults = createMemo(() => {
    const results = props.lineResults.map((result, index) => ({
      result,
      index,
      expectedText: props.expectedTexts[index] || `Line ${index + 1}`,
    }))

    const pending = results.filter(r => r.result.status === 'pending' || r.result.status === 'processing')
    const graded = results.filter(r => r.result.status === 'done' || r.result.status === 'error')

    return [...pending, ...graded]
  })

  return (
    <div class={cn('relative w-full h-screen bg-background flex flex-col overflow-hidden', props.class)}>
      {/* Header */}
      <div class="flex-none px-4 h-16 border-b border-border flex items-center bg-background/95 backdrop-blur relative z-20">
        <BackButton variant="close" onClick={() => props.onClose?.()} />
      </div>

      {/* Grade display - fixed at top */}
      <div class="flex-none text-center py-6 px-4 bg-background relative z-10">
        <p class="text-base uppercase tracking-wider text-muted-foreground mb-2">
          Score
        </p>

        <GradeSlotMachine
          grade={stats().allDone ? grade() : null}
          isSpinning={isStillGrading()}
        />

        <Show when={isStillGrading()}>
          <p class="text-base text-muted-foreground mt-2">{t('common.grading')}</p>
        </Show>

        {/* Show completion stats */}
        <Show when={!isStillGrading()}>
          <p class="text-sm text-muted-foreground mt-2">
            {stats().completed}/{stats().total} lines graded
            <Show when={stats().errors > 0}>
              <span class="text-amber-400 ml-1">
                ({stats().errors} skipped due to errors)
              </span>
            </Show>
          </p>
        </Show>
      </div>

      {/* Scrollable line results - fills remaining space, scrolls behind footer */}
      <div class="flex-1 overflow-y-auto px-4 pb-28">
        <div class="max-w-xl mx-auto space-y-2">
          <For each={sortedResults()}>
            {(item) => (
              <LineResultRow
                lineIndex={item.index}
                expectedText={item.expectedText}
                result={item.result}
                showTranscript={false}
              />
            )}
          </For>
        </div>
      </div>

      {/* Footer with actions - sticky at bottom */}
      <div
        class="absolute bottom-0 left-0 right-0 z-30 bg-background/90 backdrop-blur-md border-t border-border p-4"
        style={{ 'padding-bottom': 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div class="max-w-xl mx-auto flex gap-4">
          <Button
            variant="outline"
            size="lg"
            class="flex-1 text-lg py-6"
            onClick={() => props.onClose?.()}
          >
            <Icon name="x" class="mr-2 text-xl" />
            {t('common.close')}
          </Button>
          <Button
            variant="gradient"
            size="lg"
            class="flex-1 text-lg py-6"
            onClick={() => props.onPlayAgain?.()}
            disabled={isStillGrading()}
          >
            <Icon name="arrow-clockwise" class="mr-2 text-xl" />
            {t('common.playAgain')}
          </Button>
        </div>
      </div>
    </div>
  )
}
