import { useMemo } from 'react'
import type { Address } from 'viem'
import { ARTIST_SUBSCRIPTION_LOCKS, SONG_PURCHASE_LOCKS } from '@/lib/contracts/addresses'

export interface SubscriptionLockData {
  unlockLockAddress?: Address
  unlockChainId?: number
}

interface UseCreatorSubscriptionLockArgs {
  spotifyTrackId?: string
  artistSlug?: string
  metadataLockAddress?: string
  metadataLockChainId?: number
}

/**
 * Resolve subscription/purchase lock for a song (song-level preferred, artist fallback)
 * Uses static config mapping and optional metadata override.
 */
export function useCreatorSubscriptionLock(params?: UseCreatorSubscriptionLockArgs) {
  const spotifyTrackId = params?.spotifyTrackId
  const artistSlug = params?.artistSlug
  const metadataLockAddress = params?.metadataLockAddress
  const metadataLockChainId = params?.metadataLockChainId

  return useMemo(() => {
    if (!spotifyTrackId && !artistSlug && !metadataLockAddress) {
      return {
        data: { unlockLockAddress: undefined, unlockChainId: undefined },
        isLoading: false,
      }
    }

    const lockFromMetadata = metadataLockAddress && metadataLockChainId
      ? { lockAddress: metadataLockAddress, chainId: metadataLockChainId }
      : undefined

    const lockFromSong = spotifyTrackId
      ? SONG_PURCHASE_LOCKS[spotifyTrackId]
      : undefined

    const lockFromArtist = artistSlug
      ? ARTIST_SUBSCRIPTION_LOCKS[artistSlug.toLowerCase()]
      : undefined

    const lockConfig = lockFromMetadata || lockFromSong || lockFromArtist

    if (!lockConfig) {
      console.log('[useCreatorSubscriptionLock] No subscription lock configured for song/artist:', {
        spotifyTrackId,
        artistSlug,
      })
      return {
        data: { unlockLockAddress: undefined, unlockChainId: undefined },
        isLoading: false,
      }
    }

    console.log('[useCreatorSubscriptionLock] Found subscription lock:', {
      spotifyTrackId,
      artistSlug,
      unlockLockAddress: lockConfig.lockAddress,
      unlockChainId: lockConfig.chainId,
    })

    return {
      data: {
        unlockLockAddress: lockConfig.lockAddress as Address,
        unlockChainId: lockConfig.chainId,
      },
      isLoading: false,
    }
  }, [artistSlug, metadataLockAddress, metadataLockChainId, spotifyTrackId])
}
