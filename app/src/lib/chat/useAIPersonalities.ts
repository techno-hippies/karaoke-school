/**
 * Hook to fetch AI personality data from Lens
 * Fetches avatars and metadata for Scarlett and Violet
 */

import { useLensAccount } from '@/hooks/useLensCreator'
import { LENS_CUSTOM_NAMESPACE } from '@/lib/lens/config'
import { convertLensImage } from '@/lib/lens/utils'
import { useMemo } from 'react'

// AI personality definitions with Lens usernames
const AI_PERSONALITY_DEFS = [
  {
    id: 'scarlett',
    lensUsername: 'scarlett-ks',
    name: 'Scarlett',
    description: '20F digital nomad who loves yoga',
    fallbackAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
  },
  {
    id: 'violet',
    lensUsername: 'violet-karaoke',
    name: 'Violet',
    description: '25F Tokyo DJ, edgy but caring',
    fallbackAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=violet',
  },
] as const

export interface AIPersonality {
  id: string
  name: string
  avatarUrl: string
  description: string
  lensUsername: string
}

/**
 * Fetch AI personalities with real avatars from Lens
 */
export function useAIPersonalities() {
  // Fetch both accounts from Lens
  const scarlettAccount = useLensAccount('scarlett-ks', LENS_CUSTOM_NAMESPACE)
  const violetAccount = useLensAccount('violet-karaoke', LENS_CUSTOM_NAMESPACE)

  const personalities = useMemo<AIPersonality[]>(() => {
    return AI_PERSONALITY_DEFS.map((def) => {
      // Don't return any URL while loading - let UI show skeleton
      // This prevents flash of fallback → real avatar
      let avatarUrl = ''

      if (def.id === 'scarlett') {
        if (scarlettAccount.data?.metadata?.picture) {
          avatarUrl = convertLensImage(scarlettAccount.data.metadata.picture)
        } else if (!scarlettAccount.loading) {
          // Only use fallback after loading complete and no Lens data
          avatarUrl = def.fallbackAvatar
        }
      } else if (def.id === 'violet') {
        if (violetAccount.data?.metadata?.picture) {
          avatarUrl = convertLensImage(violetAccount.data.metadata.picture)
        } else if (!violetAccount.loading) {
          avatarUrl = def.fallbackAvatar
        }
      }

      return {
        id: def.id,
        name: def.name,
        avatarUrl,
        description: def.description,
        lensUsername: def.lensUsername,
      }
    })
  }, [scarlettAccount.data, violetAccount.data, scarlettAccount.loading, violetAccount.loading])

  return {
    personalities,
    isLoading: scarlettAccount.loading || violetAccount.loading,
  }
}
