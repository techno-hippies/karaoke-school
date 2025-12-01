import type { Preview } from '@storybook/react-vite'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { LensProvider, PublicClient, testnet } from '@lens-protocol/react'
import { AuthProvider } from '../src/contexts/AuthContext'
import { LanguagePreferenceProvider } from '../src/contexts/LanguagePreferenceContext'
import '../src/index.css'

// Minimal wagmi config for Storybook (no real wallet connections)
const storybookWagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
})

// QueryClient for React Query (required by wagmi)
const storybookQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

// Lens Protocol client for Storybook
const storybookLensClient = PublicClient.create({
  environment: testnet,
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
})

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    backgrounds: {
      options: {
        dark: { name: 'dark', value: 'oklch(0.145 0 0)' },
        light: { name: 'light', value: 'oklch(1.0000 0 0)' },
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
  initialGlobals: {
    backgrounds: { value: 'dark' },
  },
  decorators: [
    // Wrap all stories with app providers (wagmi, react-query, Lens, Auth, etc.)
    // This allows components using these hooks to render in Storybook
    (Story) =>
      createElement(
        WagmiProvider,
        { config: storybookWagmiConfig },
        createElement(
          QueryClientProvider,
          { client: storybookQueryClient },
          createElement(
            LensProvider,
            { client: storybookLensClient },
            createElement(
              AuthProvider,
              null,
              createElement(
                LanguagePreferenceProvider,
                null,
                createElement(Story)
              )
            )
          )
        )
      ),
  ],
};

export default preview;
