import type { Address } from 'viem'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

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

// === PUBLIC CLIENT ===
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
})

export const BASE_SEPOLIA_CONTRACTS = {
  usdc: (import.meta.env.VITE_BASE_SEPOLIA_USDC || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as Address,
  karaokeCredits: (import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT || '0xf897bf9246abb53477b9986940b46e5db886a27f') as Address,
  karaokeCatalog: (import.meta.env.VITE_KARAOKE_CATALOG_CONTRACT || '0x8e57ce8FdBc727C65235E322E0F46D07235ca37c') as Address, // V2: Added sectionsUri + alignmentUri
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
