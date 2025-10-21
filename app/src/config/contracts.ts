import type { Address } from 'viem'
import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'

/**
 * Contract Address Management - SINGLE SOURCE OF TRUTH
 *
 * Architecture:
 * - All contracts on Base Sepolia (user pays gas)
 * - No KaraokeCredits (no payment flow needed)
 * - Songs pre-seeded in KaraokeCatalog
 * - Artists pre-seeded in ArtistRegistry
 */

// === BASE SEPOLIA (Chain ID: 84532) ===
export const BASE_SEPOLIA_CHAIN_ID = 84532

// === PUBLIC CLIENT ===
const isMainnet = import.meta.env.VITE_NETWORK === 'mainnet'
const currentChain = isMainnet ? base : baseSepolia
const rpcUrl = isMainnet
  ? import.meta.env.VITE_BASE_MAINNET_RPC
  : import.meta.env.VITE_BASE_SEPOLIA_RPC

export const publicClient = createPublicClient({
  chain: currentChain,
  transport: http(rpcUrl),
})

/**
 * Base Sepolia Contract Addresses
 */
export const BASE_SEPOLIA_CONTRACTS = {
  karaokeCatalog: (import.meta.env.VITE_KARAOKE_CATALOG_CONTRACT || '0xa3fE1628c6FA4B93df76e070fdCd103626D83039') as Address,
  fsrsTracker: (import.meta.env.VITE_FSRS_TRACKER_CONTRACT || '0xcB208EFA5B615472ee9b8Dea913624caefB6C1F3') as Address,
  artistRegistry: (import.meta.env.VITE_ARTIST_REGISTRY_ADDRESS || '0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7') as Address,
} as const

// === HELPER FUNCTIONS ===

/**
 * Get contract address by name
 */
export function getContractAddress(contractName: keyof typeof BASE_SEPOLIA_CONTRACTS): Address {
  return BASE_SEPOLIA_CONTRACTS[contractName]
}

/**
 * Check if contract is deployed (not zero address)
 */
export function isContractDeployed(address: Address): boolean {
  return address !== '0x0000000000000000000000000000000000000000'
}

/**
 * All contracts are on Base Sepolia
 */
export const DEFAULT_CHAIN_ID = BASE_SEPOLIA_CHAIN_ID
