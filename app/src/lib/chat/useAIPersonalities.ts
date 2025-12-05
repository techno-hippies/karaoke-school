/**
 * Hook to fetch AI personality data from Lens
 * Fetches avatars and metadata for Scarlett and Violet
 */

import { useLensAccount } from '@/hooks/useLensCreator'
import { LENS_CUSTOM_NAMESPACE } from '@/lib/lens/config'
import { convertLensImage } from '@/lib/lens/utils'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// Define Interest type here to avoid circular imports
export interface Interest {
  category: 'music' | 'anime' | 'travel' | 'gaming' | 'fashion'
  favorites: string[]
}

// Interest definition with i18n keys
interface InterestDef {
  category: Interest['category']
  favoritesKey: string // i18n key for favorites array
}

// AI personality definitions with Lens usernames
const AI_PERSONALITY_DEFS = [
  {
    id: 'scarlett',
    lensUsername: 'scarlett-ks',
    name: 'Scarlett',
    ageGender: '20',
    taglineKey: 'personalities.scarlett.tagline',
    fallbackAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    images: [
      'https://picsum.photos/seed/scarlett1/400/400',
      'https://picsum.photos/seed/scarlett2/400/400',
      'https://picsum.photos/seed/scarlett3/400/400',
    ],
    interests: [
      { category: 'music', favoritesKey: 'personalities.scarlett.interests.music' },
      { category: 'anime', favoritesKey: 'personalities.scarlett.interests.anime' },
      { category: 'travel', favoritesKey: 'personalities.scarlett.interests.travel' },
      { category: 'gaming', favoritesKey: 'personalities.scarlett.interests.gaming' },
      { category: 'fashion', favoritesKey: 'personalities.scarlett.interests.fashion' },
    ] as InterestDef[],
    contentLevel: 4,
  },
  {
    id: 'violet',
    lensUsername: 'violet-karaoke',
    name: 'Violet',
    ageGender: '18',
    taglineKey: 'personalities.violet.tagline',
    fallbackAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=violet',
    images: [
      'https://picsum.photos/seed/violet1/400/400',
      'https://picsum.photos/seed/violet2/400/400',
      'https://picsum.photos/seed/violet3/400/400',
    ],
    interests: [
      { category: 'music', favoritesKey: 'personalities.violet.interests.music' },
      { category: 'anime', favoritesKey: 'personalities.violet.interests.anime' },
      { category: 'travel', favoritesKey: 'personalities.violet.interests.travel' },
      { category: 'gaming', favoritesKey: 'personalities.violet.interests.gaming' },
      { category: 'fashion', favoritesKey: 'personalities.violet.interests.fashion' },
    ] as InterestDef[],
    contentLevel: 7,
  },
] as const

export interface AIPersonality {
  id: string
  name: string
  ageGender: string
  tagline: string
  avatarUrl: string
  images: string[]
  interests: Interest[]
  contentLevel: number
  lensUsername: string
}

/**
 * Fetch AI personalities with real avatars from Lens
 */
export function useAIPersonalities() {
  const { t } = useTranslation()

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

      // Translate interests
      const interests: Interest[] = def.interests.map((interest) => ({
        category: interest.category,
        favorites: t(interest.favoritesKey, { returnObjects: true }) as string[],
      }))

      return {
        id: def.id,
        name: def.name,
        ageGender: def.ageGender,
        tagline: t(def.taglineKey),
        avatarUrl,
        images: [...def.images],
        interests,
        contentLevel: def.contentLevel,
        lensUsername: def.lensUsername,
      }
    })
  }, [scarlettAccount.data, violetAccount.data, scarlettAccount.loading, violetAccount.loading, t])

  return {
    personalities,
    isLoading: scarlettAccount.loading || violetAccount.loading,
  }
}
