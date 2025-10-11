import type { Address } from 'viem'

/**
 * Contract addresses organized by network
 * Base Sepolia: Payments (USDC, KaraokeCredits)
 * Lens Testnet: Social/Study (SongCatalog, StudyProgress, etc.)
 */

// === BASE SEPOLIA (Chain ID: 84532) ===
export const BASE_SEPOLIA_CHAIN_ID = 84532

export const BASE_SEPOLIA_CONTRACTS = {
  usdc: (import.meta.env.VITE_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as Address,
  karaokeCredits: (import.meta.env.VITE_KARAOKE_CREDITS_ADDRESS || '0xb072a10814eE18bafe9725F171450FD6188397B6') as Address,
  karaokeSegmentRegistry: (import.meta.env.VITE_KARAOKE_SEGMENT_REGISTRY_ADDRESS || '0xd74F1874B1346Ce1a4958FA5304c376bE0209Fa8') as Address,
  karaokeCatalog: (import.meta.env.VITE_KARAOKE_CATALOG_ADDRESS || '0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6') as Address,
} as const

// === LENS TESTNET (Chain ID: 37111) ===
export const LENS_TESTNET_CHAIN_ID = 37111

export const LENS_TESTNET_CONTRACTS = {
  songCatalog: (import.meta.env.VITE_SONG_CATALOG_ADDRESS || '0x88996135809cc745E6d8966e3a7A01389C774910') as Address,
  studyProgress: (import.meta.env.VITE_STUDY_PROGRESS_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  karaokeScoreboard: (import.meta.env.VITE_KARAOKE_SCOREBOARD_ADDRESS || '0x8301E4bbe0C244870a4BC44ccF0241A908293d36') as Address,
} as const

// === HELPER FUNCTIONS ===

/**
 * Get contract address by network and name
 */
export function getContractAddress(chainId: number, contractName: string): Address {
  if (chainId === BASE_SEPOLIA_CHAIN_ID) {
    return BASE_SEPOLIA_CONTRACTS[contractName as keyof typeof BASE_SEPOLIA_CONTRACTS]
  }
  if (chainId === LENS_TESTNET_CHAIN_ID) {
    return LENS_TESTNET_CONTRACTS[contractName as keyof typeof LENS_TESTNET_CONTRACTS]
  }
  throw new Error(`Unknown chain ID: ${chainId}`)
}

/**
 * Check if contract is deployed (not zero address)
 */
export function isContractDeployed(address: Address): boolean {
  return address !== '0x0000000000000000000000000000000000000000'
}
