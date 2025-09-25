import React, { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { 
  TransactionProvider, 
  TransactionModal,
  TranslationProvider 
} from 'ethereum-identity-kit'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { wagmiConfig } from '../config/wagmi.config'
import 'ethereum-identity-kit/css'
import '../styles/rainbowkit-overrides.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    },
  },
})

interface WalletProviderProps {
  children: ReactNode
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={darkTheme({
            accentColor: '#FE2C55',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
          modalSize="compact"
          locale="zh-CN"  // Set to Mandarin Chinese
        >
          <TranslationProvider>
            <TransactionProvider>
              {children}
              <TransactionModal />
            </TransactionProvider>
          </TranslationProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}