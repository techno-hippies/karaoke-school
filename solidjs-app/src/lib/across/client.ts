/**
 * Across Protocol Client Configuration
 *
 * Enables cross-chain purchases - users can pay from any supported chain
 * and the funds bridge to Base Sepolia for song/subscription purchases.
 */

import { createAcrossClient, type AcrossClient } from '@across-protocol/app-sdk'
import {
  arbitrumSepolia,
  baseSepolia,
  optimismSepolia,
  sepolia,
} from 'viem/chains'

// Testnet chains supported by Across
export const SUPPORTED_ORIGIN_CHAINS = [
  sepolia, // Ethereum Sepolia
  arbitrumSepolia, // Arbitrum Sepolia
  optimismSepolia, // Optimism Sepolia
  baseSepolia, // Base Sepolia (same-chain, no bridge needed)
] as const

// Destination chain for all purchases
export const DESTINATION_CHAIN = baseSepolia

// Token addresses on each testnet
export const TESTNET_TOKENS = {
  // USDC addresses (for song purchases)
  usdc: {
    [sepolia.id]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC on Sepolia
    [arbitrumSepolia.id]: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // USDC on Arb Sepolia
    [optimismSepolia.id]: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // USDC on OP Sepolia
    [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
  },
  // Native ETH (for premium subscription)
  eth: {
    [sepolia.id]: '0x0000000000000000000000000000000000000000',
    [arbitrumSepolia.id]: '0x0000000000000000000000000000000000000000',
    [optimismSepolia.id]: '0x0000000000000000000000000000000000000000',
    [baseSepolia.id]: '0x0000000000000000000000000000000000000000',
  },
} as const

// Chain metadata for UI
export const CHAIN_INFO = {
  [sepolia.id]: {
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
    icon: '/images/ethereum-chain.svg',
    color: '#627EEA',
  },
  [arbitrumSepolia.id]: {
    name: 'Arbitrum Sepolia',
    shortName: 'Arbitrum',
    icon: '/images/arbitrum-chain.svg',
    color: '#28A0F0',
  },
  [optimismSepolia.id]: {
    name: 'Optimism Sepolia',
    shortName: 'Optimism',
    icon: '/images/optimism-chain.svg',
    color: '#FF0420',
  },
  [baseSepolia.id]: {
    name: 'Base Sepolia',
    shortName: 'Base',
    icon: '/images/base-chain.svg',
    color: '#0052FF',
  },
} as const

export type SupportedChainId = (typeof SUPPORTED_ORIGIN_CHAINS)[number]['id']

// Singleton client instance
let acrossClient: AcrossClient | null = null

/**
 * Get or create the Across client singleton
 *
 * Note: On testnet, fills take ~1 minute (vs ~2 seconds on mainnet)
 * due to lack of relayer competition and economic incentives.
 */
export function getAcrossClient(): AcrossClient {
  if (!acrossClient) {
    acrossClient = createAcrossClient({
      integratorId: '0x4b53', // "KS" in hex (Karaoke School)
      chains: [...SUPPORTED_ORIGIN_CHAINS],
      useTestnet: true,
    })
  }
  return acrossClient
}

/**
 * Check if a chain is the destination (Base Sepolia)
 * If true, no bridging needed - direct purchase
 */
export function isDestinationChain(chainId: number): boolean {
  return chainId === DESTINATION_CHAIN.id
}

/**
 * Get USDC address for a given chain
 */
export function getUsdcAddress(chainId: number): `0x${string}` | undefined {
  return TESTNET_TOKENS.usdc[chainId as SupportedChainId]
}

/**
 * Get chain info for UI display
 */
export function getChainInfo(chainId: number) {
  return CHAIN_INFO[chainId as SupportedChainId]
}
