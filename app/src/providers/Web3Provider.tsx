import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LensProvider } from '@lens-protocol/react'
import { WagmiProvider, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { lensClient } from '@/lib/lens/client'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Locale } from '@rainbow-me/rainbowkit'

import '@rainbow-me/rainbowkit/styles.css'
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from '@rainbow-me/rainbowkit'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// RainbowKit + wagmi config
const wagmiConfig = getDefaultConfig({
  appName: 'Karaoke School',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
})

// Map i18next language codes to RainbowKit locales
const RAINBOWKIT_LOCALE_MAP: Record<string, Locale> = {
  en: 'en-US',
  zh: 'zh-CN',
  vi: 'vi-VN',
  id: 'id-ID',
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()

  // Get RainbowKit locale from current i18n language
  const rainbowKitLocale = RAINBOWKIT_LOCALE_MAP[i18n.language] || 'en-US'

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale={rainbowKitLocale}
          theme={darkTheme({
            accentColor: '#f97316', // orange-500 to match app theme
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          <LensProvider client={lensClient}>
            {children}
          </LensProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
