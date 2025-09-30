import { http, createConfig, createStorage } from 'wagmi'
import { baseSepolia, mainnet } from 'wagmi/chains'
import { defineChain } from 'viem'
import { 
  connectorsForWallets,
} from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { createJoyIdWallet } from '@joyid/rainbowkit'

// Define Lens Chain Testnet
export const lensChainTestnet = defineChain({
  id: 37111,
  name: 'Lens Chain Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'GRASS',
    symbol: 'GRASS',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.lens.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Lens Chain Explorer',
      url: 'https://block-explorer.testnet.lens.xyz',
    },
  },
  testnet: true,
})

// WalletConnect project ID - you should replace this with your own
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

// JoyID configuration
const joyidWallet = createJoyIdWallet({
  // JoyID app URL - using testnet for development
  joyidAppURL: 'https://testnet.joyid.dev',
})

// Configure wallet groups
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Wallets',
      wallets: [
        joyidWallet,
        metaMaskWallet,
        walletConnectWallet,
        coinbaseWallet,
        rainbowWallet,
      ],
    },
  ],
  {
    appName: 'Karaoke School',
    projectId,
  }
)

// Create config for wagmi
export const wagmiConfig = createConfig({
  chains: [lensChainTestnet, baseSepolia, mainnet], // Lens Chain Testnet primary, others for ENS
  connectors,
  storage: createStorage({ storage: localStorage }),
  transports: {
    [lensChainTestnet.id]: http(),
    [baseSepolia.id]: http(),
    [mainnet.id]: http(), // Add mainnet transport for ENS
  },
})

// Export chains for use in components
export { baseSepolia, mainnet }