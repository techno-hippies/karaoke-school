import { createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Minimal wagmi config for Lens testnet-compatible network (Base Sepolia for auth demo)
export const config = createConfig({
  // NOTE: Change to the chain you actually want once Lens connectors are updated.
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
  },
})

export default config
