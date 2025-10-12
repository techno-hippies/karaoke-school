import type { Address } from 'viem'

/**
 * Contract addresses for Base Sepolia
 *
 * Architecture:
 * - Karaoke generation happens on Base Sepolia (user pays gas)
 * - Social posting happens on Lens (gas abstracted via Lens SDK)
 * - No custom Lens contracts needed - pure SDK/API integration
 */

// === BASE SEPOLIA (Chain ID: 84532) ===
export const BASE_SEPOLIA_CHAIN_ID = 84532

export const BASE_SEPOLIA_CONTRACTS = {
  usdc: (import.meta.env.VITE_BASE_SEPOLIA_USDC || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as Address,
  karaokeCredits: (import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT || '0x6de183934E68051c407266F877fafE5C20F74653') as Address,
  karaokeCatalog: (import.meta.env.VITE_KARAOKE_CATALOG_CONTRACT || '0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa') as Address,
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
