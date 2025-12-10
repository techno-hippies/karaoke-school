/**
 * Chat scenario definitions
 * Defines available AI personalities and their conversation scenarios
 */

export interface ScenarioDef {
  id: string
  titleKey: string
  descriptionKey: string
  image: string
  isAdult?: boolean
  /** Roleplays are ephemeral (signal state only), default chats persist to IDB */
  isRoleplay?: boolean
}

export const SCARLETT_SCENARIOS: ScenarioDef[] = [
  {
    id: 'scarlett-chat',
    titleKey: 'Default Chat',
    descriptionKey: 'Learn English through music and casual conversation',
    image: '/images/scarlett/default.webp',
    isRoleplay: false,
  },
  {
    id: 'scarlett-surfing',
    titleKey: 'Beach Day',
    descriptionKey: 'Join Scarlett for a day at the beach! Practice casual conversation while learning to surf.',
    image: '/images/scarlett/beach.webp',
    isRoleplay: true,
  },
  {
    id: 'scarlett-cafe',
    titleKey: 'Coffee Shop',
    descriptionKey: 'Meet Scarlett at a cozy café. Practice ordering and small talk.',
    image: '/images/scarlett/cafe.webp',
    isRoleplay: true,
  },
]

export const VIOLET_SCENARIOS: ScenarioDef[] = [
  {
    id: 'violet-chat',
    titleKey: 'Default Chat',
    descriptionKey: 'Chat about anime, gaming, and Japanese culture',
    image: '/images/violet/default.webp',
    isRoleplay: false,
  },
  {
    id: 'violet-nightclub',
    titleKey: 'Late Night',
    descriptionKey: 'A more mature conversation setting for adult learners.',
    image: '/images/violet/nightclub.webp',
    isAdult: true,
    isRoleplay: true,
  },
  {
    id: 'violet-ramen',
    titleKey: 'Ramen Shop',
    descriptionKey: 'Visit a cozy ramen shop with Violet. Learn food vocabulary!',
    image: '/images/violet/ramen.webp',
    isRoleplay: true,
  },
]

export const ALL_SCENARIOS: ScenarioDef[] = [...SCARLETT_SCENARIOS, ...VIOLET_SCENARIOS]

/** Get scenario definition by ID */
export function getScenarioDef(scenarioId: string | null): ScenarioDef | undefined {
  if (!scenarioId) return undefined
  return ALL_SCENARIOS.find((s) => s.id === scenarioId)
}

/** Extract personality ID from scenario ID (e.g., "scarlett-surfing" -> "scarlett") */
export function getPersonalityIdFromScenario(scenarioId: string | null): string | null {
  if (!scenarioId) return null
  return scenarioId.split('-')[0]
}
