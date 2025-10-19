/**
 * Artist Registry Contract Integration
 *
 * Replaces the static artist-mapping.ts with dynamic contract lookups.
 * Provides bidirectional mapping between Genius artist IDs and Lens usernames.
 *
 * Contract: ArtistRegistryV2 (Base Sepolia)
 * Address: 0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7
 */

import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

const ARTIST_REGISTRY_ADDRESS = '0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7' as const
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

const ARTIST_REGISTRY_ABI = [
  {
    name: 'getGeniusIdByLensHandle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'lensHandle', type: 'string' }],
    outputs: [{ name: '', type: 'uint32' }]
  },
  {
    name: 'artistExists',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusArtistId', type: 'uint32' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'getLensHandle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusArtistId', type: 'uint32' }],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'getArtist',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusArtistId', type: 'uint32' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'geniusArtistId', type: 'uint32' },
        { name: 'pkpAddress', type: 'address' },
        { name: 'lensHandle', type: 'string' },
        { name: 'lensAccountAddress', type: 'address' },
        { name: 'source', type: 'uint8' },
        { name: 'verified', type: 'bool' },
        { name: 'hasContent', type: 'bool' },
        { name: 'createdAt', type: 'uint64' },
        { name: 'updatedAt', type: 'uint64' }
      ]
    }]
  }
] as const

// Singleton public client
let publicClient: ReturnType<typeof createPublicClient> | null = null

function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC),
      batch: {
        multicall: true
      }
    })
  }
  return publicClient
}

/**
 * Check if artist has a registered profile
 * Replaces: hasLensProfile() from artist-mapping.ts
 */
export async function hasLensProfile(geniusArtistId: number): Promise<boolean> {
  try {
    const client = getPublicClient()
    const exists = await client.readContract({
      address: ARTIST_REGISTRY_ADDRESS,
      abi: ARTIST_REGISTRY_ABI,
      functionName: 'artistExists',
      args: [geniusArtistId]
    })
    return exists
  } catch (error) {
    console.error('[hasLensProfile] Error checking artist:', error)
    return false
  }
}

/**
 * Get Lens username for a Genius artist
 * Replaces: getLensUsername() from artist-mapping.ts
 *
 * @returns Lens username (without @) or null if not registered
 */
export async function getLensUsername(geniusArtistId: number): Promise<string | null> {
  try {
    const client = getPublicClient()
    const handle = await client.readContract({
      address: ARTIST_REGISTRY_ADDRESS,
      abi: ARTIST_REGISTRY_ABI,
      functionName: 'getLensHandle',
      args: [geniusArtistId]
    })
    return handle || null
  } catch (error) {
    console.error('[getLensUsername] Error fetching handle:', error)
    return null
  }
}

/**
 * Get the best route for an artist
 * Replaces: getArtistRoute() from artist-mapping.ts
 *
 * Returns:
 * - /u/:username if artist has PKP profile
 * - /artist/:geniusArtistId if artist has no PKP
 */
export async function getArtistRoute(geniusArtistId: number): Promise<string> {
  const username = await getLensUsername(geniusArtistId)
  return username ? `/u/${username}` : `/artist/${geniusArtistId}`
}

/**
 * Reverse lookup: Lens username → Genius artist ID
 * Returns 0 if not found
 *
 * @param username - Lens username (without @)
 */
export async function getGeniusIdByUsername(username: string): Promise<number> {
  try {
    const client = getPublicClient()
    const geniusId = await client.readContract({
      address: ARTIST_REGISTRY_ADDRESS,
      abi: ARTIST_REGISTRY_ABI,
      functionName: 'getGeniusIdByLensHandle',
      args: [username]
    })
    return Number(geniusId)
  } catch (error) {
    console.error('[getGeniusIdByUsername] Error:', error)
    return 0
  }
}

/**
 * Get full artist data from contract
 *
 * @returns Artist object or null if not found
 */
export async function getArtistByGeniusId(geniusArtistId: number) {
  try {
    const client = getPublicClient()
    const artist = await client.readContract({
      address: ARTIST_REGISTRY_ADDRESS,
      abi: ARTIST_REGISTRY_ABI,
      functionName: 'getArtist',
      args: [geniusArtistId]
    })

    if (!artist || artist.geniusArtistId === 0) {
      return null
    }

    return {
      geniusArtistId: Number(artist.geniusArtistId),
      pkpAddress: artist.pkpAddress,
      lensHandle: artist.lensHandle,
      lensAccountAddress: artist.lensAccountAddress,
      source: artist.source === 0 ? 'MANUAL' : 'GENERATED' as const,
      verified: artist.verified,
      hasContent: artist.hasContent,
      createdAt: Number(artist.createdAt),
      updatedAt: Number(artist.updatedAt)
    }
  } catch (error) {
    console.error('[getArtistByGeniusId] Error:', error)
    return null
  }
}

/**
 * Batch check: Do multiple artists have profiles?
 *
 * @param geniusArtistIds - Array of Genius artist IDs
 * @returns Map of geniusArtistId -> hasProfile
 */
export async function batchCheckArtists(geniusArtistIds: number[]): Promise<Map<number, boolean>> {
  const results = new Map<number, boolean>()

  try {
    // Fetch all in parallel
    const promises = geniusArtistIds.map(id => hasLensProfile(id))
    const batchResults = await Promise.all(promises)

    geniusArtistIds.forEach((id, index) => {
      results.set(id, batchResults[index])
    })
  } catch (error) {
    console.error('[batchCheckArtists] Error:', error)
  }

  return results
}
