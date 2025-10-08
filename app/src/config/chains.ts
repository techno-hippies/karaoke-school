import { defineChain } from 'viem'

/**
 * Base Sepolia (Testnet)
 * Used for: USDC payments, KaraokeCredits
 */
export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: {
      name: 'BaseScan',
      url: 'https://sepolia.basescan.org',
    },
  },
  testnet: true,
})

/**
 * Lens Testnet
 * Used for: Social features, SongCatalog, StudyProgress
 */
export const lensTestnet = defineChain({
  id: 37111,
  name: 'Lens Network Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'GRASS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.lens.dev'] },
  },
  blockExplorers: {
    default: {
      name: 'Lens Explorer',
      url: 'https://block-explorer.testnet.lens.dev',
    },
  },
  testnet: true,
})
