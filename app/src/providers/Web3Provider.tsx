import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LensProvider } from '@lens-protocol/react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { lensClient } from '@/lib/lens/client'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Minimal wagmi setup so hooks like usePublicClient / useWalletClient work
const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
  },
})

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <LensProvider client={lensClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </LensProvider>
    </WagmiProvider>
  )
}
