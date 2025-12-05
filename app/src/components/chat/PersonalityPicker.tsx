import { cn } from '@/lib/utils'
import { ScenarioCard, type ScenarioCardProps } from './PersonalityCard'
import type { Interest } from '@/lib/chat/useAIPersonalities'

// ============================================================
// NEW: Scenario-based picker (for roleplay scenarios)
// ============================================================

export type Scenario = Omit<ScenarioCardProps, 'onClick' | 'className'>

export interface ScenarioPickerProps {
  scenarios: Scenario[]
  onSelect?: (scenario: Scenario) => void
  className?: string
}

/**
 * ScenarioPicker - Grid of scenario cards (default + roleplays)
 */
export function ScenarioPicker({
  scenarios,
  onSelect,
  className,
}: ScenarioPickerProps) {
  return (
    <div className={cn('p-4', className)}>
      <div className="grid grid-cols-1 gap-4 max-w-md mx-auto">
        {scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            {...scenario}
            onClick={() => onSelect?.(scenario)}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// LEGACY: Personality picker (for existing ChatContainer)
// ============================================================

export interface Personality {
  id: string
  name: string
  avatarUrl?: string
  ageGender?: string
  tagline?: string
  images?: string[]
  interests?: Interest[]
  contentLevel?: number
}

export interface PersonalityPickerProps {
  personalities: Personality[]
  onSelect?: (personality: Personality) => void
  className?: string
}

/**
 * PersonalityPicker - Legacy grid for ChatContainer
 * TODO: Migrate to ScenarioPicker
 */
export function PersonalityPicker({
  personalities,
  onSelect,
  className,
}: PersonalityPickerProps) {
  return (
    <div className={cn('p-4', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {personalities.map((personality) => (
          <button
            key={personality.id}
            onClick={() => onSelect?.(personality)}
            className={cn(
              'w-full max-w-sm text-left rounded-2xl border bg-card overflow-hidden transition-all p-4',
              'hover:shadow-lg hover:border-primary/50',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            )}
          >
            <div className="flex items-center gap-3">
              {personality.avatarUrl && (
                <img
                  src={personality.avatarUrl}
                  alt={personality.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                <h3 className="text-lg font-semibold">{personality.name}</h3>
                {personality.tagline && (
                  <p className="text-sm text-muted-foreground">{personality.tagline}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
