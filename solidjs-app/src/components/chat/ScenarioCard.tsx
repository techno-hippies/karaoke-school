/**
 * ScenarioCard Component
 *
 * Display a chat scenario (default conversation or roleplay)
 * with image, title, description, and 18+ badge
 */

import { Component, Show, splitProps } from 'solid-js'
import { cn } from '@/lib/utils'
import { Warning } from '@/components/icons'

export interface ScenarioCardProps {
  /** Scenario ID */
  id: string
  /** Scene title (e.g., "Beach Bar", "Default") */
  title: string
  /** Character name (e.g., "Scarlett") */
  character?: string
  /** Short description */
  description: string
  /** Scene image URL (optional - shows gradient placeholder if missing) */
  image?: string
  /** Gradient colors for placeholder [from, to] */
  gradient?: [string, string]
  /** Is this 18+ content */
  isAdult?: boolean
  /** Called when card is clicked */
  onClick?: () => void
  class?: string
}

/**
 * ScenarioCard - Display a chat scenario
 */
export const ScenarioCard: Component<ScenarioCardProps> = (props) => {
  const [local, others] = splitProps(props, [
    'id',
    'title',
    'character',
    'description',
    'image',
    'gradient',
    'isAdult',
    'onClick',
    'class',
  ])

  const gradientColors = () => local.gradient ?? ['#6366f1', '#8b5cf6']

  return (
    <button
      onClick={local.onClick}
      class={cn(
        'w-full text-left rounded-2xl border border-border bg-card overflow-hidden transition-all cursor-pointer',
        'hover:shadow-lg hover:border-white/30',
        'focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-background',
        local.class
      )}
      {...others}
    >
      {/* Image or gradient placeholder */}
      <div class="aspect-[16/9] overflow-hidden relative">
        <Show
          when={local.image}
          fallback={
            <div
              class="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${gradientColors()[0]}, ${gradientColors()[1]})`,
              }}
            />
          }
        >
          <img src={local.image} alt={local.title} class="w-full h-full object-cover" />
        </Show>

        {/* Title overlay */}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div class="absolute bottom-3 left-4 right-4">
          <h3 class="text-xl font-semibold text-white">
            {local.title}
            <Show when={local.character}>
              <span class="font-normal"> with {local.character}</span>
            </Show>
            <Show when={local.isAdult}>
              <span class="text-orange-400 ml-2 inline-flex items-center gap-1">
                <Warning class="w-4 h-4" />
                18+
              </span>
            </Show>
          </h3>
        </div>
      </div>

      {/* Description */}
      <div class="p-4">
        <p class="text-base text-foreground/70 leading-relaxed">{local.description}</p>
      </div>
    </button>
  )
}

export default ScenarioCard
