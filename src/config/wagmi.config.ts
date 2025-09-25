import { http, createConfig, createStorage } from 'wagmi'
import { baseSepolia, mainnet } from 'wagmi/chains'
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
  chains: [baseSepolia, mainnet], // Include mainnet for ENS resolution
  connectors,
  storage: createStorage({ storage: localStorage }),
  transports: {
    [baseSepolia.id]: http(),
    [mainnet.id]: http(), // Add mainnet transport for ENS
  },
})

// Export chains for use in components
export { baseSepolia, mainnet }