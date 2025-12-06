/**
 * ScenarioPicker Component
 *
 * Display a grouped list of scenarios by AI personality
 */

import { Component, For, splitProps } from 'solid-js'
import { cn } from '@/lib/utils'
import { ScenarioCard } from './ScenarioCard'

/**
 * UI-ready scenario with resolved display strings
 * (as opposed to Scenario which has i18n keys)
 */
export interface ScenarioItem {
  id: string
  title: string
  description: string
  image: string
  isAdult?: boolean
  isRoleplay?: boolean
}

export interface PersonalityGroup {
  /** Personality name */
  name: string
  /** Personality ID */
  id: string
  /** Scenarios for this personality */
  scenarios: ScenarioItem[]
}

export interface ScenarioPickerProps {
  /** Groups of scenarios by personality */
  groups: PersonalityGroup[]
  /** Called when a scenario is selected */
  onSelect?: (scenario: ScenarioItem) => void
  class?: string
}

/**
 * ScenarioPicker - Grouped scenario selection grid
 */
export const ScenarioPicker: Component<ScenarioPickerProps> = (props) => {
  const [local, others] = splitProps(props, ['groups', 'onSelect', 'class'])

  return (
    <div class={cn('min-h-screen bg-background p-4', local.class)} {...others}>
      <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <For each={local.groups}>
          {(group) => (
            <section>
              <h2 class="text-2xl font-bold text-foreground mb-4">{group.name}</h2>
              <div class="space-y-3">
                <For each={group.scenarios}>
                  {(scenario) => (
                    <ScenarioCard
                      id={scenario.id}
                      title={scenario.title}
                      description={scenario.description}
                      image={scenario.image}
                      isAdult={scenario.isAdult}
                      onClick={() => local.onSelect?.(scenario)}
                    />
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </div>
    </div>
  )
}

export default ScenarioPicker
