import { http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'

const isMainnet = import.meta.env.VITE_NETWORK === 'mainnet'
const currentChain = isMainnet ? base : baseSepolia

const rpcUrl = isMainnet
  ? import.meta.env.VITE_BASE_MAINNET_RPC
  : import.meta.env.VITE_BASE_SEPOLIA_RPC

export const config = createConfig({
  chains: [currentChain],
  transports: {
    [currentChain.id]: http(rpcUrl),
  },
})
