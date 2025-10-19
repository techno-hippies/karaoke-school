import type { Address } from 'viem'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

/**
 * Contract Address Management - SINGLE SOURCE OF TRUTH
 *
 * IMPORTANT: All contract addresses MUST be imported from this file.
 * DO NOT use `import.meta.env.VITE_*_CONTRACT` directly in code.
 *
 * Why centralized?
 * - Single source of truth prevents address mismatches
 * - Environment variables with fallbacks for development
 * - Type-safe access via TypeScript
 * - Easy to audit and update
 *
 * Architecture:
 * - Karaoke generation happens on Base Sepolia (user pays gas)
 * - Social posting happens on Lens (gas abstracted via Lens SDK)
 * - No custom Lens contracts needed - pure SDK/API integration
 *
 * Contract Roles:
 * - karaokeCatalog: Stores song metadata, sections, alignments, translations
 * - karaokeCredits: Manages credits, purchases, and song ownership
 * - usdc: Base Sepolia testnet USDC token
 */

// === BASE SEPOLIA (Chain ID: 84532) ===
export const BASE_SEPOLIA_CHAIN_ID = 84532

// === PUBLIC CLIENT ===
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
})

/**
 * Base Sepolia Contract Addresses
 *
 * Environment variables allow for easy network switching:
 * - Production: Set in .env.production
 * - Development: Set in .env.local or use defaults
 * - Testing: Override in test setup
 */
export const BASE_SEPOLIA_CONTRACTS = {
  usdc: (import.meta.env.VITE_BASE_SEPOLIA_USDC || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as Address,
  karaokeCredits: (import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT || '0xf897bf9246abb53477b9986940b46e5db886a27f') as Address,
  karaokeCatalog: (import.meta.env.VITE_KARAOKE_CATALOG_CONTRACT || '0xa3fE1628c6FA4B93df76e070fdCd103626D83039') as Address, // V2: getRecentSongs(), deleteSong(), enhanced events, geniusArtistId
} as const

// === HELPER FUNCTIONS ===

/**
 * Get contract address by name (Base Sepolia only)
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
