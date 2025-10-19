import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { baseSepolia } from 'viem/chains'

/**
 * ArtistRegistryV2 contract address on Base Sepolia
 */
const REGISTRY_CONTRACT_ADDRESS = (import.meta.env.VITE_ARTIST_REGISTRY_ADDRESS || '0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7') as `0x${string}`

/**
 * Minimal ABI for ArtistRegistryV2
 */
const REGISTRY_ABI = [
  parseAbiItem('function artistExists(uint32 geniusArtistId) external view returns (bool)'),
  parseAbiItem('function getLensHandle(uint32 geniusArtistId) external view returns (string memory)'),
  // getArtist returns Artist struct (9 fields)
  {
    name: 'getArtist',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusArtistId', type: 'uint32' }],
    outputs: [
      {
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
          { name: 'updatedAt', type: 'uint64' },
        ],
      },
    ],
  },
] as const

/**
 * Artist registry data
 */
export interface RegistryArtist {
  geniusArtistId: number
  pkpAddress: string
  lensHandle: string
  lensAccountAddress: string
  source: 'MANUAL' | 'GENERATED'
  verified: boolean
  hasContent: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Check if artist is registered in contract
 */
export function useArtistExists(geniusArtistId: number | undefined) {
  return useQuery({
    queryKey: ['artistRegistry', 'exists', geniusArtistId],
    queryFn: async () => {
      if (!geniusArtistId) {
        return false
      }

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      return await publicClient.readContract({
        address: REGISTRY_CONTRACT_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'artistExists',
        args: [geniusArtistId],
      })
    },
    enabled: !!geniusArtistId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Get Lens handle for artist
 */
export function useArtistLensHandle(geniusArtistId: number | undefined) {
  return useQuery({
    queryKey: ['artistRegistry', 'lensHandle', geniusArtistId],
    queryFn: async () => {
      if (!geniusArtistId) {
        return null
      }

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      try {
        const lensHandle = await publicClient.readContract({
          address: REGISTRY_CONTRACT_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'getLensHandle',
          args: [geniusArtistId],
        })

        return lensHandle
      } catch (error) {
        // Artist not found
        return null
      }
    },
    enabled: !!geniusArtistId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Get full artist data from registry
 */
export function useArtistRegistry(geniusArtistId: number | undefined) {
  return useQuery({
    queryKey: ['artistRegistry', 'artist', geniusArtistId],
    queryFn: async (): Promise<RegistryArtist | null> => {
      if (!geniusArtistId) {
        return null
      }

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      try {
        const result = await publicClient.readContract({
          address: REGISTRY_CONTRACT_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'getArtist',
          args: [geniusArtistId],
        })

        return {
          geniusArtistId: result[0],
          pkpAddress: result[1],
          lensHandle: result[2],
          lensAccountAddress: result[3],
          source: result[4] === 0 ? 'MANUAL' : 'GENERATED',
          verified: result[5],
          hasContent: result[6],
          createdAt: new Date(Number(result[7]) * 1000),
          updatedAt: new Date(Number(result[8]) * 1000),
        }
      } catch (error) {
        // Artist not found
        return null
      }
    },
    enabled: !!geniusArtistId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Get profile URL for artist
 * Returns Lens profile URL if registered, null otherwise
 */
export function useArtistProfileUrl(geniusArtistId: number | undefined): string | null {
  const { data: lensHandle } = useArtistLensHandle(geniusArtistId)

  if (!lensHandle) return null

  // Return Lens v3 style URL
  return `/u/${lensHandle}`
}
