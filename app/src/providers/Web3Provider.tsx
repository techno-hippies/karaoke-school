import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LensProvider } from '@lens-protocol/react'
import { lensClient } from '@/lib/lens/client'
import type { ReactNode } from 'react'

const queryClient = new QueryClient()

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <LensProvider client={lensClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </LensProvider>
  )
}
