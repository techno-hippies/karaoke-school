import { http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(import.meta.env.VITE_BASE_MAINNET_RPC),
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC),
  },
})
