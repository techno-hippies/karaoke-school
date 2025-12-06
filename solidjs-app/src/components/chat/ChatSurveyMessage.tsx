/**
 * ChatSurveyMessage Component
 *
 * Onboarding-style survey question with clickable options
 * Used for soft onboarding flow (favorite musicians, anime, age range, etc.)
 */

import { Component, For, splitProps } from 'solid-js'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

/**
 * Survey option with resolved display label
 * (id: internal key, label: translated display text)
 */
export interface SurveyOptionWithLabel {
  id: string
  label: string
  labelKey?: string
}

export interface ChatSurveyMessageProps {
  /** Question text */
  question: string
  /** Available options with labels */
  options: SurveyOptionWithLabel[]
  /** Called when an option is selected */
  onSelect?: (option: SurveyOptionWithLabel) => void
  /** Currently selected option (if any) */
  selectedId?: string
  /** Disable selection (after answered) */
  disabled?: boolean
  /** Avatar URL */
  avatarUrl?: string
  class?: string
}

/**
 * ChatSurveyMessage - Onboarding-style survey question with clickable options
 */
export const ChatSurveyMessage: Component<ChatSurveyMessageProps> = (props) => {
  const [local, others] = splitProps(props, [
    'question',
    'options',
    'onSelect',
    'selectedId',
    'disabled',
    'avatarUrl',
    'class',
  ])

  return (
    <div
      class={cn('flex gap-3 w-full justify-start', local.class)}
      {...others}
    >
      {/* AI Avatar */}
      <Avatar src={local.avatarUrl} fallback="AI" size="sm" />

      {/* Question and options */}
      <div class="flex flex-col flex-1 min-w-0">
        {/* Question bubble */}
        <div class="px-4 py-3 rounded-2xl rounded-tl-md bg-secondary text-secondary-foreground text-base leading-relaxed w-fit max-w-[85%]">
          {local.question}
        </div>

        {/* Options - stacked vertically, fixed width */}
        <div class="mt-3 flex flex-col gap-2 w-64 md:w-72">
          <For each={local.options}>
            {(option) => {
              const isSelected = () => local.selectedId === option.id
              return (
                <Button
                  variant={isSelected() ? 'default' : 'outline'}
                  size="default"
                  onClick={() => !local.disabled && local.onSelect?.(option)}
                  disabled={local.disabled && !isSelected()}
                  class={cn(
                    'w-full justify-start',
                    local.disabled && !isSelected() && 'opacity-40'
                  )}
                >
                  {option.label}
                </Button>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}

export default ChatSurveyMessage
